# 审计清单排序风险:方案对比

日期:2026-10-28
作者:Claude(方案对比,不实现、不合并)
性质:设计比较。**不是部署授权,也不是代码评审。** 灰度、VPS、L2/Q12 仍为 HOLD。
结论与决定见 `docs/tasks/decision-log.md` D-36。

## 1. 问题
`lib/team/audit-integrity.ts` 用 `(created_at,id)` 给清单划边界并排序。`created_at` 由应用端 `new Date().toISOString()` 生成,`id` 多数是随机 UUID,所以这个顺序不是写入顺序。清单覆盖前 N 行之后,合法追加可能插到边界之前:

- **情形 B:** 新行 `created_at` 与清单末行相同,但 `id` 更小。
- **情形 C:** 新行 `created_at` 更早,但是后写入的(跨实例时钟差、批量写入)。

两种情形都会让"前 N 行"变成另一组行,摘要不一致,`verifyManifest` 报"被篡改"。
追加限制:`team_audit_no_update`、`team_audit_no_delete`(`drizzle/0025`)禁止 UPDATE/DELETE,所以不能回填序号列,除非迁移里临时删再重建触发器。

## 2. 现场事实(来自 main `9d56824`)
- `team_audit` 是普通 rowid 表:`id TEXT PRIMARY KEY`,不是 WITHOUT ROWID。索引 `team_audit_tenant_date(tenant_id,created_at)`。
- 清单表 `team_audit_manifests` 已有 `last_id`(`drizzle/0054`)和 `last_created_at`;只追加,有 no_update/no_delete 触发器。
- 约 16 处写入点 `INSERT INTO team_audit`,分布在 13 个文件(`lib/team/server.ts`、`lib/team/auth.ts`、`lib/kyc/*`、`lib/notifications/server.ts`、`app/api/team/auth/route.ts` 等)。代码里没有 `INSERT OR REPLACE INTO team_audit`,没有 `VACUUM`,没有 `recursive_triggers`。
- 摘要版本前缀:现有清单为 `v2:`。

## 3. 本机复现(node:sqlite,内存库,复刻 `team_audit` 的表、索引与两个触发器)
清单覆盖 t1 的前两行 m、n;之后追加 a(情形 B)和 late(情形 C):

| 排序方式 | t1 的全部行顺序 | 取前 2 行 | 与清单一致 |
|---|---|---|---|
| 现状 `(created_at,id)` | late, m, a, n | late, m | **否** |
| `rowid` | m, n, a, late | m, n | 是 |

- 以 `last_id`(n)查出 rowid,取 `tenant_id=? AND rowid<=? ORDER BY rowid`,得 m、n。
- `VACUUM` 之后 rowid 被重编(4,5,6,2,3),但相对顺序不变。
- 查询计划:`SEARCH ... USING INDEX team_audit_tenant_date (tenant_id=?)` 加 `USE TEMP B-TREE FOR ORDER BY`(临时排序)。

## 4. 方案
**R:按 rowid 排序,免迁移。**
- 清单新增 `v3:` 摘要版本:边界为 `last_id` 对应的 rowid,按 rowid 排序取该租户 rowid ≤ 边界的行。
- 不改写入点,不改表。可选(各为一次可加性迁移,不影响触发器):清单表加 `last_rowid` 列,用于区分"rowid 被重排"与"被篡改";`team_audit(tenant_id)` 加索引以免临时排序。

**A:显式序号列加计数表。**
- `team_audit` 加 `seq` 列,另建按租户的计数表,约 16 处写入点都改成同事务分配序号;老行回填要在迁移里临时删再重建 `team_audit_no_update`。

**D(提交标记):撤回。** 它同样需要一个全序来定义"标记之前",单独成立不了。

**E(写入时把 `created_at` 改成单调):不采用。** 要动约 16 处写入点、改变 `created_at` 的含义,且 id 仍随机,情形 B 不消失。

| | 现状 | R | A |
|---|---|---|---|
| 迁移 | — | 不需要;可选两项可加性迁移 | 需要(新列、计数表、临时改触发器) |
| 改写入点 | — | 0 处 | 约 16 处 |
| 并发 | 顺序不可靠 | 单写入者下 rowid 即提交顺序 | 计数表是热点;批量写入要同事务分配 |
| 老清单(v2) | — | 保持原算法,标"旧排序,有已知局限" | 同左 |
| 主要风险 | 误报篡改 | rowid 非永久稳定值(相对顺序实测保持);D1 上未验证 | 迁移期间审计空窗;触发器被临时拆除 |
| 回滚 | — | 读回旧算法即可 | 回退迁移 |

## 5. 同时发现:`INSERT OR REPLACE` 绕过 append-only 触发器
同一环境实测:对已有 id 执行 `INSERT OR REPLACE INTO team_audit ...` **成功**,没有被 `team_audit_no_update`/`team_audit_no_delete` 拦截,行内容被改写,且该行的 rowid 移到末尾。
- 业务代码里没有这种写法;只有能执行任意 SQL 的人才能利用。
- D1 上 `recursive_triggers` 的默认值**未验证**。
- 对 R 的影响:会扰动 rowid 顺序,但改动行的摘要变化会让校验报"被篡改"。
- 建议单独立项加固;不并入排序修复。加固方式需另议(例如对重复 id 的 BEFORE INSERT 触发器),要注意 `INSERT OR IGNORE`(`lib/kyc/followups.ts`)和 `ON CONFLICT(id) DO NOTHING`(`lib/kyc/material-read-audit.ts`)的既有语义。

## 6. 验收测试(只列,未实现)
1. 情形 B、情形 C 追加后,新清单与旧清单均校验为"匹配"(旧清单指 v3)。
2. 篡改任一行内容、删行(绕过触发器)、`INSERT OR REPLACE` 改行,均报"被篡改"。
3. v2 老清单行为不变,且在报告里标明排序局限。
4. `VACUUM` 之后 v3 仍匹配。
5. 多租户:其它租户的行不影响某租户的边界与摘要。
6. `last_id` 不存在、`row_count` 不一致、`v3:` 与 `v2:` 混用,均不得报成功。
7. 10 万行量级创建与校验耗时(查询计划含临时排序,**未测**)。

## 7. 未验证与限制
- 只在 node:sqlite 的内存库上验证;**没有在 Cloudflare D1 或灰度的 SQLite 文件上验证**。
- 没有读生产或灰度数据;没有评估 rowid 在 D1 导出/导入、时间点恢复后的行为。
- 实现代码、测试、迁移(若选加可选项)都**尚未写**。`lib/**`、`drizzle/**` 的改动按 H8 先评审后合并。
