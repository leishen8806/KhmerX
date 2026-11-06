# R-1(审计 `seq` 与清单 v3)独立评审

日期:2026-11-04
基线:`origin/main` `8eeee227c1639b9b17fbb14bc3faac27d6685623`
评审人:Claude(独立评审,不合并、不关闭、不标 Ready)
性质:只记录代码评审结论。**不构成部署授权**;灰度、VPS、L2/Q12 仍为 HOLD(D-41 也暂停 D-40)。

> **状态(2026-11-06 更新):** 本评审针对 `8eeee22`。main 已在 11-05(`9701b1e`、`01daad0`,大旺)改用共享写入器 `lib/team/audit-writer.ts`,下面的"NULL seq"发现和"后续 K-S1"对**当前 main 不再成立**。对当前 main 的复验见 §8。§1–§7 保留,作为 `8eeee22` 的记录。

## 结论
**不批准按现状部署,也不能把 v3 称为"已启用"。** R-1 已在 main,需要补 K-S1(给其余 `team_audit` 写入点补 `seq`)和针对真实代码的测试。没有发现数据破坏类问题。

## 方法与限制
- 对 `8eeee22` 做干净导出,断网,只读;依赖目录用只读目录链接,跑完即移除。
- 运行 `team-integration`、`audit-manifest-v3`、`r0-audit-fixtures`、`kyc-audit-manifest-eval`、`kyc-material-read-audit`:基线失败 0。
- 对 `lib/team/server.ts` 的 `audit()` 与 `lib/team/audit-integrity.ts` 做 12 个变异(精确字符串替换,还原后复核)。
- **没有做**:全量测试、类型检查、构建、真实浏览器;没有在 Cloudflare D1 或灰度库上验证;没有读灰度或生产数据。
- Windows 上 `tests/audit-seq-verify.test.mjs` 有 5 项失败,原因是测试用 `script.pathname`(在 Windows 变成 `/E:/...`);换成 `fileURLToPath` 后退出码符合预期。属测试可移植性问题,不是逻辑缺陷。

## 发现

### 1. 真实写入路径大量写出 NULL seq(已端到端复现)
- 静态扫描 `lib`、`app`、`scripts`、`deploy`、`db`:30 处 `INSERT INTO team_audit`,只有 `lib/team/server.ts:31` 的 `audit()` 带 `seq`,其余 29 处不带;数据库里没有触发器补 `seq`。
- 在 `team-integration` 的真实路径里,155 行审计记录中 **120 行 `seq` 为 NULL**(其中 2 行是测试故意写的合成 NULL 行)。主要动作:`create_member` 23、`auto_assign` 15、`staff_login` 8、`notification_delivery_manual_retry` 7、`bot_save` 6、`service_auto_assign` 6、`staff_sso_login` 5,以及 `approve`、`disburse`、`admin_repay`、`kyc_field_amend` 等。
- 带 `seq` 的动作:`add_unit`、`create_company`、`report_export`、`emergency_access_*`、`audit_manifest_created`、`platform_update_company` 等(走 `audit()`)。
- 后果:租户里一旦有 NULL seq 行,`createManifest` 回退到 v2;已有 v3 清单校验返回 `needsManualReview`。"v3 随新清单启用"(D-36)在真实使用下大概率达不到。
- 灰度库的历史行也都是 NULL;R-2 回填被限定为"本地/备份"(D-39),灰度是否回填尚无批准。

### 2. 真实代码的 v3 校验路径几乎没有测试
12 个变异:4 个被抓住,2 个等价或影响很小,其余存活。

| 变异 | 结果 | 判断 |
|---|---|---|
| A1 `audit()` 的 seq 改成 NULL | 被抓住 | — |
| I1 清单创建永远当"完整" | 被抓住 | — |
| I2 版本永远为 2 | 被抓住 | — |
| I9 不支持的版本当 v2 | 被抓住 | — |
| A2 去掉 `COALESCE`(空表第一行 seq 为 NULL) | 存活 | 真实缺口,影响小 |
| A3 `MAX(seq)+1` 改成 `+2` | 存活 | 只留空洞,排序仍对;"无空洞"测试只验证了测试自己拷贝的 SQL |
| I3 校验里去掉 NULL 检查 | 存活 | **真实缺口**:NULL 行被静默忽略,可能报"匹配" |
| I4 `seq<=?` 改成 `seq<?` | 存活 | **真实缺口**:少取最后一行 |
| I5 v3 排序改回 `created_at,id` | 存活 | **真实缺口**:排序风险重现,测试发现不了 |
| I6 `appendOnly` 的 `>=` 改成 `>` | 存活 | **真实缺口**:未追加时误报"被篡改" |
| I7 去掉 `last_seq` 边界 | 存活 | 等价(`slice(0,row_count)` 已兜底) |
| I8 摘要前缀 `v3:` 改成 `v2:` | 存活 | 只改存储格式,自洽;应有测试 |

- 原因:`tests/audit-manifest-v3.test.mjs` 用自己拷贝的 SQL,不调用 `lib/team/audit-integrity.ts`。
- 真实代码的 v3 用例(`expose versioned statuses`)用 UPDATE 补一个租户的 NULL 行,创建后只校验一次,没有"创建清单后追加、再校验"。
- I3、I4、I5、I6 我判断不是等价变异,依据是读代码;**没有逐个写出能杀死它们的测试来证明**。

### 3. 文档与现状不符
`docs/ops/plan-r-release-runbook.md` §5 写"新 writer 的 seq 应大于回填上限且递增"。实际只有 `audit()` 满足,其余 29 处不满足。

### 4. 已确认没问题的部分
- 0062 本身:加列、部分唯一索引、触发器只允许一次 NULL→值的更新;UPDATE 其它列和 DELETE 仍被拦截。
- `audit()` 这一个写入点的 `MAX(seq)+1` 分配逻辑。
- v2 老清单算法保持原样,R-0 的 4 个夹具通过。

## 后续(K-S1;**已作废**,见 §8。提示词只在聊天里给,不进仓库)
- 技术负责人 2026-11-04 确认默认值 A:补 `seq` 用"逐点改写",不加迁移、不加触发器(D-42)。
- 测试必须调用真实 `lib` 代码,并杀死上表的 A2、I3、I4、I5、I6。
- 顺手把 `audit-seq-verify.test.mjs` 的 `script.pathname` 改成 `fileURLToPath`。
- 实现 PR 按 D-37 先经我评审并写明"Claude 批准合并 #编号"。

## 仍未决定
- 灰度历史行回填是否批准、放在哪个窗口。
- 依赖漏洞(`next` critical,`zod`、`undici` high)的处置。
- Playwright 联网安装是否批准(H1 未覆盖)。

## 8. 补充:对当前 main 的复验(取代 K-S1)
日期:2026-11-06
基线:`origin/main` `3a9a348`。其后到 `b6a0381` 只多了文档 PR #186,`lib`、`app`、`drizzle`、`tests` 无差异,所以结论同样适用于 `b6a0381`。

### 8.1 发生了什么
- 11-05 的 `9701b1e`、`01daad0`(大旺)新增 `lib/team/audit-writer.ts`,所有 `team_audit` 写入都走它,`seq` 在这一处生成。`lib`、`app` 里只剩 1 处字面量 `INSERT INTO team_audit`。
- 同一批提交**原地修改了 `drizzle/0062_audit_manifest_v3_seq.sql`**:它在 10-30 的 `884aa36` 首次合入,11-05 又被改。
- 因此 K-S1(PR #198,`23e4c70`)与 main 在 11 个文件上冲突,而且解决的是同一个问题。

### 8.2 方法与限制
对 main 做干净导出,断网,依赖目录用只读目录链接,跑完即移除;没有碰灰度或 VPS,没有跑 lint 和构建;没有在 Cloudflare D1 或灰度库上验证。

### 8.3 结果
- 类型检查通过。
- 全量测试(Windows):548 项,522 通过,7 失败,19 跳过。7 个失败的原因:5 个是 `tests/audit-seq-verify.test.mjs` 的 Windows 路径问题(`script.pathname`);1 个是我的导出没有 `.git`,`git ls-files` 失败,补上后通过;1 个是 `H5 login renders copy…`(Khmer 字典含 CJK),与审计无关,原因未确认。
- 把 main 的真实 0062 应用到有数据的旧库:能应用;所有行有 `seq` 且连续;UPDATE、改 `seq`、DELETE 被拦截;重复 `seq` 被拒绝。
- 11 个变异,10 个被杀死:写入器 seq 改 NULL、去掉 `+1`;迁移里去掉回填、去掉第一条 `DROP TRIGGER`、回填排序被改(`rowid`、仅 `id`);校验里去掉 NULL 检查、边界 `seq<?`、排序改 `created_at,id`、`appendOnly` 改 `>`。唯一存活的是 `+1` 改 `+2`(只留空洞,不影响正确性)。

### 8.4 风险与待技术负责人决定(均不阻塞关闭 #198)
1. **0062 被原地修改。** 已应用旧版 0062 的数据库(本地库、任何跑过 10-30 至 11-05 的 main 的环境)不会再执行新版,拿不到回填和更严格的触发器。灰度和生产尚未部署过 0062。
2. **回填写在迁移里,部署时对所有行自动执行,并换掉了追加专用触发器。** D-39 批准的 R-2 是"仅对本地/备份做回填"。灰度部署前需要技术负责人对这个迁移单独批准。
3. **回填按 `(created_at,id)` 排序,不是插入顺序。** 演示中插入顺序 `z,a,m,k` 被回填为 `m,a,z,k`。D-36 推荐的 `rowid` 才是插入顺序。若要改,是迁移改动,需批准,且有测试固定了当前排序。
4. **`INSERT OR REPLACE` 绕过追加专用触发器**仍然开放(D-36 记录的未决事项)。
5. **治理:** `9701b1e`、`01daad0` 改了 `lib/**` 和 `drizzle/0062`。Claude 没有这两次提交的评审记录;D-37 要求代码合并有"Claude 批准合并 #编号"。
6. `audit-seq-verify.test.mjs` 的 Windows 路径修复(`fileURLToPath`)在 #198 里,main 上没有。

### 8.5 对 PR #198 和后续任务
- **不批准 #198**:与 main 冲突,且已被取代。建议由技术负责人关闭。
- 此前对 `23e4c70` 的复验结论(K-S1b 的变异结果)只适用于 `8eeee22` 的代码,**批准合并的表述作废**。
- K-S1c 取消:Codex 在 `b6a0381` 上核对,基线(`tests/audit-seq-coverage.test.mjs`)不存在,已暂停,未改任何文件。
