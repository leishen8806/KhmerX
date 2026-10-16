# L1-G3：把灰度 `db-check` 结果绑定到 manifest（小卡）

来源：L1-G 补审 P2-1。`db-check` 的 JSON 是操作员从源站带回压测机的，目前只靠 9 个计数字段与 `main` 数据集的客户数匹配；拿**别的运行**的同计数 JSON 也能通过 `verify-rows`。本卡让该 JSON **自带绑定**，`verify-rows` 校验绑定，否则拒绝。
前置契约：`L1-G-gray-fixture.md` §3.4、§4-5；基线：最新 `origin/main`。仅本地代码与测试，**不得操作灰度/VPS，不得访问任何 khmerx.org 域名**。

## 1. 现状（已核实）

- `scripts/loadtest/fixture/gray.mjs::dbCheck` 返回 9 个键：`customer_workspaces`、`loan_index`、`legacyLoans`、`assignments`、`audit`、`assignmentsMatch`、`modeMatches`、`uniqueOps`、`foreignCustomers`；输出已按契约不含 token、客户清单或配置字段。
- `scripts/loadtest/verify-rows.mjs::databaseEvidence(raw,m)` 要求键集合**恰好**是这 9 个，并按 manifest 客户数核对计数；`verify` 在灰度档读取 `--gray` 的 `dbCheckFile` 并写入报告 `database` 与 `databaseEvidence:'operator-supplied db-check JSON'`。
- 已有测试：`tests/loadtest-gray-fixture.test.mjs`（`dbCheck` 在 G1 主测试里被调用）、`tests/loadtest-gray-rows.test.mjs`（`databaseEvidence` 对额外键、计数不符的拒绝）。

## 2. 要求

### 2.1 `db-check` 输出新增三个绑定字段（共 12 个键，不得再多）
| 字段 | 内容 |
|---|---|
| `runId` | manifest 的 `runId` |
| `binding` | `sha256( runId + ':' + tenantId + ':' + dataset + ':' + manifest.integrity.sha256 )` 的十六进制（完整 64 位） |
| `checkedAt` | 执行 `db-check` 时刻的 ISO 字符串 |

- **不得**输出 `tenantId`、`integrity.sha256`、客户标识、会话 token 或其哈希清单；`binding` 是单向摘要，可以输出。
- 计算必须复用 `validateManifest` 之后的 manifest 字段，不得另读文件。

### 2.2 `verify-rows` 校验
`databaseEvidence(raw,m)` 在现有检查之外**全部**满足才接受：
1. 键集合恰好是 §2.1 的 12 个键，类型正确（`runId` 字符串、`binding` 为 64 位十六进制、`checkedAt` 可解析的 ISO 时间）。
2. `raw.runId===m.runId`；`raw.binding` 等于用 `m` 重新计算的值。
3. `checkedAt` 不早于 `m.createdAt`，且不晚于"当前时间 + 5 分钟"（防止伪造未来时间），且不晚于 `m.expiresAt + 6 小时`。
4. 报告 `database` 字段里保留 `runId`、`binding`、`checkedAt`，`databaseEvidence` 文案改为 `db-check JSON bound to manifest`。

### 2.3 兼容与边界
- 本地 harness 路径与现有本地测试**不变**；`db-check` 只在 `gray-config` 档使用。
- 旧格式（9 键）的 JSON 在灰度档必须被拒绝并给出明确的 `Invalid sanitized db-check artifact`。
- README 的灰度章节更新：操作员把 `db-check` 的输出（不含 token）带回压测机；说明它与 manifest 绑定，换运行会被拒。

## 3. 允许范围

- **允许修改**：`scripts/loadtest/fixture/gray.mjs`（仅 `dbCheck` 输出）、`scripts/loadtest/verify-rows.mjs`（仅 `databaseEvidence` 与灰度报告字段）、`tests/loadtest-gray-fixture.test.mjs`、`tests/loadtest-gray-rows.test.mjs`、`scripts/loadtest/README.md`（灰度章节）。
- **禁止修改**：`lib/**`、`app/**`、`drizzle/**`、`deploy/**`、`b0-main-flow.js`、`rows-flow.js`、`run-rows.sh`、`cleanup.mjs`、`core.mjs`。
- 分支：`feat/server/L1-G3`，`Line: server`；PR < 400 行（预计 < 100 行）。

## 4. 验收

1. L1-G 全部现有测试仍通过（容器内 `node:22.22.1-bookworm-slim`、`--network none`、uid 1000、`L1G_CONTAINER=1`，沿用评审时的命令）；本地 harness 测试不变。
2. 新增测试，每项各一个：
   - 正常：`dbCheck(o,m)` 输出恰好 12 键，`verify` 接受；
   - 旧格式 9 键 → 拒绝；
   - `runId` 不符 → 拒绝；
   - 同计数但取自**另一个 manifest** 的 JSON（不同 runId/tenantId/integrity）→ 拒绝；
   - `binding` 被改动一位 → 拒绝；
   - `checkedAt` 早于 `createdAt`、晚于当前 +5 分钟、晚于 `expiresAt`+6 小时 → 各自拒绝；
   - 额外键（如 `token`、`tenantId`）→ 拒绝；
   - 输出扫描：`dbCheck` 与 `verify` 的输出/报告不含 `tenantId`、`integrity.sha256`、客户标识、任何会话 token。
3. `git diff` 无禁止范围改动；不新增依赖。
4. 仅本地验证，不得声称灰度已验收。

## 5. 给 Codex 的提示词

```
【任务】L1-G3：灰度 db-check 结果绑定 manifest。严格按 docs/tasks/codex-prompts/L1-G3-dbcheck-binding.md 实现，改动只限 §3 允许范围。
先读：该文、scripts/loadtest/fixture/gray.mjs（dbCheck）、scripts/loadtest/verify-rows.mjs（databaseEvidence、灰度分支）、tests/loadtest-gray-fixture.test.mjs、tests/loadtest-gray-rows.test.mjs。
要求：dbCheck 输出恰好 12 键（新增 runId、binding、checkedAt）；verify 校验键集合、runId、binding 重算、checkedAt 范围；旧 9 键格式拒绝；不输出 tenantId、integrity.sha256、客户标识或 token。
只在本机验证（容器 node:22.22.1-bookworm-slim，--network none，--user 1000:1000，L1G_CONTAINER=1，/data 与 /out 用 tmpfs）；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名；不改 lib/**、app/**、drizzle/**、deploy/**。PR 小于 400 行；按固定格式汇报，假设写进 PR 描述。
```
