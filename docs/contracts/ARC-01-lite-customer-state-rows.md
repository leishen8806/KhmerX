# ARC-01-lite 客户状态按客户分片存储（15 天精简版）

状态：草案 v1（按决策清单 D-01/D-15 采用）　适用：`lib/store.ts`、`lib/domain.ts`、`lib/team/workflow.ts`、`app/api/h5/state`、`app/api/state`
性质：这是**最小改动**方案，不是最终的关系型模型（那是上线后的 PostgreSQL 迁移，见 master-plan §6.2）。Codex 实现前必须先读代码，**以代码实际结构为准**；本文与代码冲突时，停下并在 PR 描述的"假设"段写明处理方式。

## 1. 要解决的问题
当前一个租户（`owner`）的全部状态存放在 `demo_workspaces.payload` 一整块 JSON 里（`State`：`loans`、`events`、`entries`、`notifications`、`requests`、`requestDigests`、`bots`、`activeBotId`、`postloan`，上限 1.5MB）。后果：
1. 所有客户的写操作都竞争同一行（`mutate()` 按 `revision` 乐观锁，重试 4 次），并发一高就冲突。
2. 每次读状态要对每笔贷款各查一次库（`hydratePublicRefs`），随贷款数线性变慢。
3. `requests`（幂等记录）是租户共用、`pruneRequestDigests` 只保留 500 条：高并发时幂等记录很快被挤掉，重试可能被重复执行。
4. 1.5MB 上限限制了总贷款数。

## 2. 方案：每个客户一行
新增表（迁移文件 `drizzle/00xx_customer_workspaces.sql`，向前兼容，带回退脚本）：
```sql
CREATE TABLE customer_workspaces (
  owner        TEXT NOT NULL,          -- 租户，同现有 owner
  customer_id  TEXT NOT NULL,
  revision     INTEGER NOT NULL DEFAULT 0,
  payload      TEXT NOT NULL,          -- 该客户自己的 CustomerShard，见下
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (owner, customer_id)
);
CREATE TABLE loan_index (
  owner        TEXT NOT NULL,
  loan_id      TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  status       TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (owner, loan_id)
);
CREATE INDEX loan_index_customer ON loan_index (owner, customer_id);
CREATE INDEX loan_index_status   ON loan_index (owner, status, updated_at);
```
`CustomerShard`（存进 `payload`）= 该客户自己的 `{loans, events, entries, notifications, requests, requestDigests}`，结构与现有 `State` 对应字段**完全一致**，这样现有的 `customerAction(state, input, customer)` 可以不改规则直接复用：读取时把"租户级配置（`bots`、`activeBotId`、`postloan`，仍留在 `demo_workspaces`）"与该客户的分片拼成一个 `State` 交给现有函数，写回时只取回分片部分。

租户行（`demo_workspaces`）之后只保存：`bots`、`activeBotId`、`postloan` 与渠道类事件；**不再保存客户贷款**（切换后）。

## 3. 读写规则
| 场景 | 规则 |
|---|---|
| 客户读状态（`GET /api/h5/state`） | 只读 `(owner, customer_id)` 一行 + 租户配置；**不再调用 `hydratePublicRefs` 逐笔查库**：公开编号在创建时一次性写入分片，历史数据由回填脚本补齐 |
| 客户写（`mutate(owner,p,customer)`） | 只读写该客户一行，按该行 `revision` 乐观锁；冲突重试耗尽抛 **409 `CONFLICT`**（见 ARC-00，不得吞成 400）；写成功后在同一事务（`db.batch`）更新 `loan_index` |
| 员工按贷款操作（`approve`/`reject`/`disburse`/`review`/`supplement`/`overdue`） | 先用 `loan_index` 由 `loan_id` 找到 `customer_id`，再读写该客户一行 |
| 员工租户级操作（`bot_*`） | 只读写租户行 |
| 员工列表（`scopedState()` 等聚合视图） | **分页聚合**：按 `loan_index` 的状态/时间索引取一页（默认 50，最大 200），再批量读取对应客户行；不得一次读全部客户。聚合视图只返回最近的 `events`（例如 200 条）和 `notifications`（例如 200 条） |
| 幂等记录 | 在客户分片内保存 `requests`/`requestDigests`，上限 500/客户；同一客户的重复请求 `requestId` 去重语义不变 |
| 公开编号 | 沿用 `claimPublicIdentifier`，只在**创建贷款时**调用一次 |

## 4. 切换与回退
- 开关：环境配置 `CUSTOMER_ROWS=off|shadow|on`（默认 off）。
  - `off`：行为与现在完全一致。
  - `shadow`：仍按旧方式读写，同时把写入后的客户分片**异步**写到新表，用于对账（不影响用户）。
  - `on`：读写都走新表；旧 `payload` 中的客户贷款不再更新。
- 步骤：回填（S7）→ `shadow` 运行并对账 100% 一致 → 预发切 `on` → 压测 → 灰度切 `on`。
- 回退：`on → off` 前运行"反向合并脚本"，把客户分片合回租户行；对账一致后再关开关。原租户 JSON 保留只读 30 天。

## 5. 验收
1. 开关 `off` 时，全部现有测试通过且行为不变。
2. 单租户 600 个虚拟客户并发写：写冲突率 < 1%（冲突只会发生在同一客户的并发请求之间）；响应体里冲突为 409 `CONFLICT`。
3. 客户读状态的数据库查询次数 ≤ 3（租户配置 1、客户行 1、可选 `kyc_cases` 1），与贷款总数无关。
4. 对账脚本：旧 JSON 与新分片逐客户逐字段一致，输出差异报告；抽样与全量均 100%。
5. 反向合并脚本在测试数据上"回填 → 切 on → 写入 → 反向合并 → 对账"一致。
6. 员工聚合视图分页返回，第 1 页延迟 p95 < 500ms（5000 客户数据集上）。

## 6. 不在本契约范围
KYC 表（`kyc_cases` 已是按行存储）；关系型贷款表；PostgreSQL 迁移；员工视图的完整筛选与排序能力（上线后）。

## 7. 员工列表接口（Q7 / S8）

off 返回整份状态；on 不带参数等价 page=1,pageSize=50，员工端必须分页。

`GET /api/state?page=1&pageSize=50&status=active`，沿用员工会话与公司 Cookie。

- `page` 默认 1；`pageSize` 默认 50，最大 200；非正数、非有限数回退默认值；正小数向下取整且至少 1。
- `CUSTOMER_ROWS=off|shadow` 且未传分页参数时保持原响应；显式分页可用于客户端迁移。
- `CUSTOMER_ROWS=on` 时未传参数也分页；按 `loan_index.updated_at DESC, loan_id DESC` 稳定排序，先按岗位/分单范围过滤再计数、分页。
- `status` 只过滤贷款；未知状态返回空贷款页，不放宽岗位或公司范围。
- `pagination` 描述贷款页；`customerPagination` 描述客户页（同一 page/pageSize，按注册时间倒序）。客户页含无贷款的注册客户及其 KYC 摘要；两套总数独立，不能将贷款页总数当客户总数。
- `customers[].loans` 是该客户全部贷款的只读摘要；`state.loans` 仅当前贷款页。KYC/贷款详情仍按原权限处理。
- `events`、`notifications` 仅当前贷款页关联的最近 200 条；不返回分片幂等记录、原始合同、内部聚合数组。
- CSV 报表逐页读取后聚合，不把第一页误报为全量；`lib/team/reports.ts` 仅调整这一调用点。
- `GET /api/team/members` 是员工名册，保留已有 page/pageSize 与权限规则，不混同为贷款列表。

请求示例：
```http
GET /api/state?page=2&pageSize=50&status=active
```
响应结构示例（省略既有业务字段，非完整贷款 DTO）：
```json
{"revision":12,"state":{"loans":[],"events":[],"notifications":[]},"customers":[],"kycOrders":[],"scope":[],"team":{"company":"Synthetic","role":"admin","unitId":null},"pagination":{"page":2,"pageSize":50,"total":0,"pages":1},"customerPagination":{"page":2,"pageSize":50,"total":0,"pages":1}}
```

员工贷款写入先按 `(owner, loan_id)` 查索引，只更新对应客户行，分片、索引、审计在同一 batch。放款用全部客户分片的当月账目计算租户额度，并以租户 revision 串行化额度占用；旧 JSON payload 不变。Admin 资金路径纳入相同切换，保留回执账本和应急授权校验。

验证边界：5000 客户的真实服务函数/路由 + 本地 SQLite 测试不是预发网络压测。保持默认 off；预发切 on 仍由人工执行。全链路开放前还需检查其他直接读取旧 JSON 的消费者，已确认 `lib/loan-signing.ts` 的新申请签名路径仍直接读写 demo_workspaces，不在本卡原范围内；不得凭员工路径测试通过就宣布客户新签约或整站切换完成。回退沿用 §4，先反向合并并对账再切 off。