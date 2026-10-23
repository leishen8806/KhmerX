# C1：员工端列表分页适配（原 P9/D6，升级为"开读开关前必须完成"）

基线：`origin/main` = `34d09d2`。分支：`feat/client/D6-staff-pagination`，提交末尾 `Line: client`。独立 worktree，一个任务一个分支一个 PR，PR < 400 行；超过按 §6 拆成有顺序的子 PR。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；不改限流、认证、数据库迁移、贷款规则、部署配置；只用虚构数据。
**为什么升级：** 原卡把它放在第三档"延期"。核对代码后发现：`CUSTOMER_ROWS=on` 时，员工端不传分页参数只会拿到**第 1 页（50 条）**，而界面没有分页控件，会**静默截断**。这是闸门 D（切读与对账）的前提，不是可选项。

## 1. 已核实事实（`34d09d2`）

| # | 事实 | 证据 |
|---|---|---|
| C1-F1 | `GET /api/state`（员工）：只有带 `page`/`pageSize`/`status` 时才传分页参数，否则 `scopedState(undefined)` | `app/api/state/route.ts:10-11` |
| C1-F2 | `CUSTOMER_ROWS=on` 时 `scopedState` 走 `readStaffPage`，默认 `page=1`、`pageSize=50`（上限 200），按角色可见范围过滤，并返回 `pagination`（贷款）与 `customerPagination`（客户）；`off` 时不传参数返回**整份**状态，旧行为 | `lib/team/workflow.ts:21-33`、`lib/customer-shards.ts:103-117` |
| C1-F3 | 员工端读取 `/api/state` 的前端入口不传任何分页参数、也没有分页控件；`app/workspace.tsx:34-35` 在非客户模式下拉取 `/api/state`，列表和统计直接用 `state.loans`；`components/crm-subpages.tsx`、`components/funding-panel.tsx` 等按 props 渲染 | 同上；`grep -n "pageSize\|pagination" app components` 无分页 UI |
| C1-F4 | 报表走服务端聚合：`reportState()` 在 `on` 时按 200 条逐页合并，不受本问题影响 | `lib/team/workflow.ts:14-20` |
| C1-F5 | ARC-01-lite §7 已写明员工列表分页（默认 50、最大 200、`pagination` 与 `customerPagination` 两套总数）；**服务端契约早已落地，前端从未适配**。队列里 P9 卡写的"不传分页参数时旧行为不变"只对 `off` 成立，`on` 时不带参数等价 `page=1,pageSize=50` | `docs/contracts/ARC-01-lite-customer-state-rows.md` §7；`su-chen.md` P9 卡 |
| C1-F6 | `/api/team/members` 已有独立分页（`pageSize` 默认 20），不在本卡范围 | `app/api/team/members/route.ts:9` |

## 2. 先读
`app/workspace.tsx`、`app/team/client.tsx`、`components/crm-subpages.tsx`、`components/funding-panel.tsx`、`components/crm-menu*`（若有）、`app/api/state/route.ts`、`lib/team/workflow.ts`（`scopedState`、`filtered`）、`lib/customer-shards.ts`（`readStaffPage`、`StaffPage`）、`docs/contracts/ARC-01-lite-customer-state-rows.md`、`tests/team-integration.test.mjs`（含 `Q7 actual state route pages 5000 customers and CSV export retains every page`）、`tests/customer-shards.test.mjs`、`tests/h5-navigation.test.mjs`（组件测试的 hook-mock + vm 做法）。

## 3. 允许 / 禁止修改
- **允许**：`app/workspace.tsx`、`app/team/client.tsx`（仅列表/统计相关）、`components/crm-subpages.tsx`、`components/funding-panel.tsx` 及其他员工端列表组件、`lib/api-client.ts` 仅限新增分页辅助类型（如需要）、新增 `tests/staff-pagination.test.mjs`、`docs/contracts/ARC-01-lite-customer-state-rows.md`（仅在 §7 补一句：`on` 时不带参数等价 `page=1,pageSize=50`，员工端必须分页）。
- **禁止**：`lib/customer-shards.ts`、`lib/team/**`、`app/api/**`、`drizzle/**`、`deploy/**`、`eslint.config.mjs`、依赖与 lock。**不改服务端**；若发现必须改服务端才能满足验收，停下来在 PR 里写明"发现—根因—最小服务端改动建议"，另开卡，不要混入。

## 4. 实施要求
1. 员工端所有以 `state.loans`/`customers` 渲染的**列表**：
   - 请求 `/api/state?page=<n>&pageSize=<50>[&status=<s>]`；响应里有 `pagination`（`on`）时显示"第 X / Y 页、共 N 条"，提供上一页/下一页，加载与失败状态完整；
   - **切换状态筛选时回到第 1 页**；
   - 响应没有 `pagination` 时（`off`）保持旧行为，不出现分页控件。
2. **所有统计、角标、"待处理 N 条"、仪表盘数字**：不得再用页内 `loans.length` 冒充总数。优先用 `pagination.total` / `customerPagination.total`；服务端没有现成聚合的指标，**明确标注为"本页"或隐藏**，并在 PR 里逐项列出（先 `grep` 出全部用到 `state.loans` 做计数的位置）。
3. 执行审批/放款等动作后，**刷新当前页**（保持页码与筛选），不要跳回第 1 页；动作对象不在当前页（深链接/刷新）时仍可操作。
4. 保持角色可见范围由服务端决定，前端不做越权过滤。
5. 不重构无关代码，不整文件格式化。
6. 在 `ARC-01-lite` §7 补一句：`off` 返回整份状态；`on` 不带参数等价 `page=1,pageSize=50`，员工端必须分页。

## 5. 验收（缺一不通过）
- 组件测试（沿用 hook-mock + vm，不新增依赖）：
  - `on`（响应含 `pagination`）：首次请求 URL 为 `…/api/state?page=1&pageSize=50`；点击下一页请求 `page=2`；切换状态筛选后请求 `page=1&status=…`；显示总数与页码；
  - `off`（响应无 `pagination`）：请求 URL 不带分页参数、无分页控件、行为与现在一致；
  - 动作成功后用**当前页码与筛选**重新请求；
  - 统计数字来自 `pagination.total`，不是 `loans.length`；
  - 加载中、失败、空列表三种状态。
- 数据面验证：用 `tests/team-integration.test.mjs` 里 Q7 现有的 5000 客户本地路由夹具，对每种角色（`admin`、`ops`、`kyc`、`lender`、`finance`）逐页翻完，客户总数与逐页累计一致，无重复、无遗漏（若该夹具已覆盖，引用测试名即可）。
- 本地给出一次 5000 条数据下翻页耗时测量（第一页与中间页），不要求截图。
- `npm run lint` errors = 0 且 warnings 不高于当前 577；`npm run typecheck -- --incremental false` 通过；`npm test` 无新增失败；`check:client-boundary` 通过；`git diff --check` 无输出。
- 不降低或删除现有测试；不改任何服务端文件。

## 6. 拆分建议（PR < 400 行）
- **C1-a**：`app/workspace.tsx` 数据层与列表分页 + ARC-01-lite §7 补一句 + 对应测试。
- **C1-b**：`app/team/client.tsx`、crm 子页与统计数字改为服务端总数/标注"本页" + 测试。
C1-b 堆叠在 C1-a 上，描述第一行写"基于 <分支>，等其合并后需 rebase"。

## 7. 验证环境（仅本机）
`node:22.22.1-bookworm-slim`，`--network none`，只读挂载，复用已有依赖，不新增依赖；宿主机的 `check:client-boundary` 因 Windows 路径会报 ENOENT，以容器结果为准；涉及 L1-G 测试保留 `--user 1000:1000`、`L1G_CONTAINER=1`、`/data` 与 `/out` tmpfs。

## 8. 假设、风险与回退
- 假设：`on` 的默认页大小 50 保持不变（性能考虑）；统计以 `pagination.total` 为准。
- 风险：个别统计服务端没有聚合——按要求标注或隐藏，不伪造。
- 回退：还原前端文件与新增测试，不涉及数据与服务端。

## 9. 给 Codex 的提示词
```
【任务】C1：员工端列表分页适配。严格按 docs/tasks/codex-prompts/C1-staff-list-pagination.md 执行；先读 §2 的文件。
在独立 worktree 里基于最新 origin/main 建分支 feat/client/D6-staff-pagination（建议拆 C1-a、C1-b）。
只改前端与测试，不改服务端；若发现必须改服务端，停下写出"发现—根因—最小建议"，不要混入。统计数字不得用页内条数冒充总数。
验证在本机 Docker（node:22.22.1-bookworm-slim，--network none，只读挂载，复用依赖，不新增依赖）里完成；只用虚构数据；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名。
PR 小于 400 行；提交末尾 `Line: client`；按固定格式汇报，假设写进 PR 描述。
```
