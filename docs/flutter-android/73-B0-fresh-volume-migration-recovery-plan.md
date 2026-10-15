# B0 — Fresh-Volume Migration Recovery Plan

```
Document:  73-B0-fresh-volume-migration-recovery-plan.md
Date:      2026-10-09
Owner:     Claude（规划）
Status:    PROPOSED — READY FOR CODEX PLAN RE-REVIEW
Identity:  PROJECT IDENTITY CHECK: PASS · KhmerX · E:\KhmerX\KhmerX · git@github.com:leishen8806/KhmerX.git · HEAD d916b4515a93057d7dd2a0673ebbca39a7bfd242
Source:    72-Gate-A-B-implementation-plan-review.md（P1：B0 需要独立执行包）
Master:    69-backend-implementation-master-plan.md · Consumer: 71-Gate-B-financial-foundation-plan.md
Executor:  TRAE（仅在 GPT 授权后执行）
Acceptance:CODEX（独立验收）
Gate:      CODE NOT MODIFIED · DATABASE NOT MODIFIED · IMPLEMENTATION NOT AUTHORIZED · Trae = HOLD
```

> B0 **不是** Gate B。它是 Gate B 的**前置执行包**：目标是让迁移执行在**全新卷**与**既有卷**两条路径上都正确，然后才允许 Gate B 新增财务迁移。**B0 不新增任何财务表。**

## 1. 已知缺陷（已读真实代码）
| 事实 | 位置 |
|---|---|
| `splitSql` 逐字符扫描，仅跟踪单引号与 `BEGIN/END` 深度，**不识别 `--` 行注释与 `/* */` 块注释**；遇到注释里的 `;` 即切分 | `deploy/standalone/server.mjs:18` |
| `drizzle/0015_admin_password.sql` 第 2、6 行注释 `-- Credentials removed; see 0030_remove_hardcoded_uat_credentials.sql.` 含分号 → 切出一段 `see 0030_….sql.`（非 SQL）作为语句 → `db.prepare()` 失败 → **空卷启动失败** | `drizzle/0015_admin_password.sql` |
| 迁移在**一个 `db.batch([...语句, INSERT standalone_migrations])`** 中执行：失败整批回滚，记录不写入（天然无半迁移状态） | `server.mjs:29-30` |
| 已应用判定同时按文件名**和**数字前缀（`appliedNumbers`），未知已应用迁移 → 启动抛错 | `server.mjs:21-26` |
| 现有测试 `tests/migrations-integrity.test.mjs` 仅校验编号连续/唯一，**不回放 SQL** | `tests/` |
| 触发器 `BEGIN…END` 切分已正确（CLOSED）；`0030/0031` 不再删除 `team_audit`（CLOSED） | `server.mjs`、`drizzle/0030,0031` |
| 托管（Cloudflare）`wrangler.json` 中 `migrations: []`，托管迁移执行路径不明 | `dist/server/wrangler.json` |

## 2. 目标
```
fresh-volume migration = CONFIRMED OPEN  →  CONFIRMED CLOSED
```
空卷 0001→最新全部成功；既有代表性卷前向升级成功；触发器与 `team_audit` 保护不退化；迁移失败**可见地**终止部署；全部自动化。

## 3. 包含范围（仅规划，不实施）
1. 迁移解析器 / `splitSql` 修正（或同等安全的最小修复）
2. `0015` 回归（含分号注释夹具）
3. 空库 0001→latest 全量回放
4. 既有卷回放（代表性旧卷 → latest）
5. 触发器 `BEGIN/END` 行为回归
6. `0030/0031` 审计行为回归
7. 迁移执行器的失败行为（失败必须停止启动、不留半状态）
8. 迁移测试夹具/harness
9. **托管部署迁移路径发现**（§8）

**不包含**：任何财务表/列；Gate A/B 业务代码；对 `demo_workspaces` 的任何写入；生产库任何操作。

## 4. 变更边界与方案选择
**优先方案（推荐）**：修正解析器（`splitSql`），**不改动任何已发布的迁移 SQL 文件**。
- 解析器须在**引号外**识别 `-- …\n` 行注释与 `/* … */` 块注释，并**把注释内容整体视为非语句分隔区域**（可保留或丢弃注释文本，但不得在注释内切分）；继续支持单引号（含 `''` 转义）、`BEGIN…END` 深度、`--> statement-breakpoint` 标记行（它本身是 `--` 注释）。
- 抽取为**可单元测试的独立模块**（例如 `scripts/lib/split-sql.mjs`，`server.mjs` 通过 import 使用；Dockerfile 需同步拷贝该文件——属执行期核对项）。**不得**复制出两份行为不同的解析器。

**不推荐的备选**：改写 `0015` 注释（去掉分号）。风险与要求：
- 已在生产/既有卷中被标记为已应用的 `0015` 不会重跑，因此**对既有卷无效果但也无害**；
- 但这改变了"已发布迁移文件"的字节内容，破坏"已应用迁移不可变"原则，且若将来引入迁移校验和（hash）会触发漂移；
- 因此**仅当**解析器方案被证明不可行时才可采用，并且必须在执行报告中给出**已应用该迁移的部署清单**与"不重跑"证明，经 Codex 明确同意。

## 5. 入口条件（Entry）
- [ ] 已捕获**当前全新卷复现**：在一次性空卷上运行 standalone 迁移，保存失败输出（语句文本、迁移文件名）
- [ ] **迁移清单冻结**：0001–0041 文件名与 SHA-256 清单已记录（用于证明 B0 未改动已发布文件）
- [ ] **不涉及生产库**：所有操作仅在一次性本地数据库
- [ ] 可用的本地一次性数据库（miniflare D1，持久化目录为临时目录）
- [ ] GPT 授权 B0 执行；Codex 已批准本计划

## 6. 测试计划（B0 强制，全部自动化）
| # | 测试 | 断言 |
|---|---|---|
| M1 | 分号注释夹具 | `-- a; b` 行注释、`/* a; b */` 块注释内的分号不切分 |
| M2 | 行注释 / 块注释（若支持）/ 注释与引号交错 | 引号内的 `--`、`/*` 不被当作注释；注释内的 `'` 不影响引号状态 |
| M3 | 触发器 `BEGIN…END` | 多语句触发器体不被切分；`RAISE(ABORT, '…;…')` 字符串内分号安全 |
| M4 | 多语句 | `a; b; c` 得到三条语句；尾部空白/纯注释片段被忽略（保持现有 `push` 的"仅注释则丢弃"行为） |
| M5 | `--> statement-breakpoint` 行 | 作为注释处理，不产生语句 |
| M6 | **空库 0001→latest 全量回放** | 全部迁移成功；`standalone_migrations` 含全部文件名；表/触发器/索引清单与预期快照一致 |
| M7 | **代表性既有卷 → latest** | 以"仅应用到 0040"的卷升级到最新：只执行缺失迁移，已应用的不重跑；结果与 M6 的结构一致 |
| M8 | 回归：`team_audit` UPDATE/DELETE 保护 | 全量回放后对 `team_audit` 的 UPDATE/DELETE 被 `RAISE(ABORT)`；其它追加表同理（按现有触发器清单） |
| M9 | 回归：`0030/0031` 回放 | 在包含 0030/0031 的全量回放中成功，且不删除 `team_audit` 表 |
| M10 | 失败行为 | 注入一份语法错误的迁移：启动抛错并**非零退出**；该迁移的任何语句均已回滚；`standalone_migrations` 无该记录；日志含迁移文件名与失败语句（不含机密） |
| M11 | 部分失败无状态腐蚀 | 迁移中途失败后重启：先前成功的迁移仍记录为已应用，失败的迁移从头安全重试 |
| M12 | 已发布迁移文件未改 | 0001–0041 的 SHA-256 与冻结清单一致（防止悄悄改文件） |
| M13 | 编号/重复/未知迁移守卫 | 保留现有"未知已应用迁移 → 抛错"；`migrations-integrity` 现有测试继续通过 |
| M14 | 容器/启动级冒烟（本地） | 以空卷启动 standalone 服务：监听成功、`GET` 一个只读公开路径返回预期；不触发任何写业务 |

**运行时测试**：仅本地一次性卷；**不使用**生产/任何共享环境；不使用真实 Telegram OTP；日志不输出机密。

## 7. 回滚 / 恢复
| 层 | 做法 |
|---|---|
| **代码回滚** | 恢复上一版迁移执行器/解析器（git 回退该提交）；因解析器抽取为独立模块，回退为单提交 |
| **数据库** | B0 **不修改历史已应用迁移**，不新增 schema；不需要数据库回滚。既有卷上 B0 不改变数据，仅改善"空卷"路径 |
| **历史迁移文件** | 默认**不改写**。仅当解析器方案被证明不可行时才考虑最小化修正 SQL 注释；此时计划**强制**评估"该迁移已被标记应用的部署"：它们不会重跑、不受影响；但文件字节变化须登记并经 Codex 同意（§4） |
| **全新卷修复策略** | 方案 A（推荐）：修解析器；方案 B（备选）：最小修正 0015 注释。执行报告必须写明采用哪一个及理由 |
| **既有卷路径** | 必须保持前向兼容：已应用迁移按名称/数字前缀跳过的现有逻辑**不改变** |
| **失败恢复** | 迁移失败 → 部署停止（M10）；修复后重新部署即可（M11），无需手工改 `standalone_migrations` |

## 8. 托管（Cloudflare）迁移路径发现（B0 必交付项）
`wrangler.json` 中 `migrations: []`，仓库内看不到托管 D1 的迁移执行路径。B0 退出前必须**书面记录**（不得用生产库实验）：
| 问题 | 要写明 |
|---|---|
| 谁调用迁移 | 人员/CI/平台自动 |
| 哪个命令 | 例如 `wrangler d1 migrations apply` / 平台内置 / 其他 |
| 针对哪个 D1 | 数据库名称/标识（**不含凭据**） |
| 凭据/环境 | 凭据存放位置（仅描述位置/责任人，**不写入任何凭据**） |
| 已应用版本如何追踪 | `d1_migrations` 表还是 `standalone_migrations` 或其他；与 `drizzle/` 目录的对应关系 |
| 同源测试 | 使托管路径与 standalone 路径对**同一份 `drizzle/*.sql`** 做空卷回放（至少在本地 `wrangler d1 ... --local` 或 miniflare 中复现一次） |
若发现托管路径存在**另一个**会因同一原因失败的解析器，纳入 B0 修复范围；若路径不可发现，则 B0 **不能 PASS**（升级为阻塞项上报）。

## 9. 出口条件（Exit）
- [ ] 全新数据库：全部迁移成功（M6）
- [ ] 代表性既有数据库：前向迁移成功（M7）
- [ ] 触发器体完好（M3、M8）
- [ ] `team_audit` UPDATE/DELETE 保护依然有效（M8）
- [ ] `0030/0031` 回放成功（M9）
- [ ] 解析器正确处理含分号的注释（M1、M2）
- [ ] 迁移失败可见地终止部署（M10、M11）
- [ ] 迁移测试套件已自动化并接入 `npm test`（M1–M14）
- [ ] 已发布迁移文件未被改动，或改动已按 §7 获批（M12）
- [ ] 托管迁移路径已文档化（§8）
- [ ] **Codex 独立验收 PASS** → 将"fresh-volume migration"标为 CONFIRMED CLOSED

## 10. P0 / P1 验收
| 级别 | 条件 |
|---|---|
| P0 | 空卷仍无法启动；迁移失败不终止部署或留下半迁移状态；对生产库做了任何操作 |
| P1 | 已发布迁移文件被无证明地改写；触发器或审计保护退化；托管路径未文档化；测试未自动化 |

## 11. 与 Gate B 的关系
Gate B **不得**提交 0042+ 迁移，直到：B0 PASS ＋ Codex 独立验收 ＋ "fresh-volume migration" 标为 CONFIRMED CLOSED。B0 与 Gate A 可在各自授权后并行。

## 12. 执行者与授权
- 执行者：**Trae**（仅在 GPT 授权 B0 后）；独立验收：**Codex**。
- 本文是计划；**未授权**任何执行。

```
B0 plan: PROPOSED — READY FOR CODEX PLAN RE-REVIEW
Implementation: NOT AUTHORIZED · Trae: HOLD
```
