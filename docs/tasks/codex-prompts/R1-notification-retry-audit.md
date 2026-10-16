# R1：通知人工重试的 audit 缺失修复（卡一）

基线：`origin/main` = `461d070`。分支：`fix/server/notification-retry-audit`，提交末尾 `Line: server`。独立 worktree，一个任务一个分支一个 PR，PR < 400 行，不整文件格式化。
冻结（不得改变）：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；不改限流、认证、数据库迁移、贷款规则、部署配置；不启动第三档任务；不发送真实 Telegram 消息，只用虚构数据。

## 1. 已核实事实（编卡时在 `461d070` 上于 `node:22.22.1-bookworm-slim`、`--network none` 复现）

| # | 事实 | 证据 |
|---|---|---|
| R1-F1 | `retryNotificationDelivery()` 调用 `audit(...).run()`，但 `lib/notifications/server.ts` 第 4 行只从 `@/lib/team/server` 导入了 `db`、`staff`，没有 `audit` | `lib/notifications/server.ts:4,80` |
| R1-F2 | `lib/team/server.ts:31` 已导出 `audit(tenant,actor,action,detail)`，返回**未执行**的预编译语句（`INSERT INTO team_audit …`），调用方需 `.run()` 或放进 `batch` | `lib/team/server.ts:31` |
| R1-F3 | **同一个根因**产生两个症状：运行时 `ReferenceError: audit is not defined`（测试 `Telegram signed subscription, tenant isolation, one-time delivery and unsubscribe` 失败，容器内 `tests/team-integration.test.mjs` 为 `not ok 231`）与 typecheck `TS2552: Cannot find name 'audit'`，且这是 typecheck 的**唯一**错误 | 容器内 `npm run typecheck -- --incremental false` 只输出 `lib/notifications/server.ts(80,8)` |
| R1-F4 | 入口：`app/api/telegram/route.ts` 的 `manual_retry` → `retryNotificationDelivery(id)`；权限 `s.member.role==='admin'` 且按 `s.tenant.id` 过滤；状态仅 `failed`/`unknown` 可重试，否则 409；`UPDATE … WHERE status IN ('failed','unknown')` 变更数不为 1 → 409 | `lib/notifications/server.ts:71-82` |
| R1-F5 | **现有失败语义**：先 `UPDATE telegram_outbox`（已提交），再**另起一条**语句写审计。如果审计写入失败，异常向上抛出，但状态已变为 `retry` 且没有审计记录——"先更新、后写审计"，两步不原子 | `lib/notifications/server.ts:77-80` |
| R1-F6 | 现有测试已覆盖：非 Admin 被拒（`/仅公司 Admin/`）、Admin 重试成功状态为 `retry`、存在 `notification_delivery_manual_retry` 审计；**未覆盖**：`attempts` 重置断言、审计各字段、跨租户、非法状态、竞争 409、拒绝时无成功审计、`failed` 状态 | `tests/team-integration.test.mjs:146-147` |
| R1-F7 | 仓库已有"状态变更 + 条件审计"的原子写法：`db().batch([UPDATE…, INSERT INTO team_audit … SELECT … WHERE changes()=1])`（见 `ensureAssignment`、`servicingSave`） | `lib/team/server.ts:28`、`lib/team/servicing.ts` |

## 2. 本卡范围：R1-A（最小修复，必做）

### 先读
`lib/notifications/server.ts`（全文，尤其 55–82 行）、`lib/team/server.ts`（`audit`、`staff`、`db`）、`app/api/telegram/route.ts`（`manual_retry`）、`tests/team-integration.test.mjs`（测试 `Telegram signed subscription…`）、`tests/notifications.test.mjs`、`drizzle/` 中 `telegram_outbox`、`team_audit` 建表与触发器（`0025` append-only）。

### 允许修改
- `lib/notifications/server.ts`（**仅**导入行；不改函数逻辑）
- `tests/team-integration.test.mjs`、必要时新增 `tests/notification-retry.test.mjs`

### 禁止修改
`lib/team/server.ts`、`app/**`、`drizzle/**`、`deploy/**`、Telegram 发送/重放/租户隔离相关代码、权限判断、状态集合。

### 实施要求
1. 把 `audit` 加入第 4 行的导入：`import {audit,db,staff} from '@/lib/team/server';`，其余逻辑**逐字不动**。
2. 保留：仅当前租户 Admin 可重试；仅 `failed`/`unknown` 可重试；状态竞争仍 409；`unknown` 不自动重试；不吞掉/绕过审计错误；不改变 Telegram 发送、重放与租户隔离。
3. 在 PR 描述的"发现"段写明 R1-F5（先更新后审计、不原子），并写明**本卡不修改该语义**，由 R1-B 另行处理。

### 验收（在测试中断言，缺一不通过）
- 正常：对 `unknown` 和 `failed` 各一条：Admin 重试返回 `{ok:true,status:'retry'}`；库中 `status='retry'`、`attempts=0`、`next_at=0`、`reason='管理员确认人工重试'`。
- 审计：恰好新增 1 条 `notification_delivery_manual_retry`：`tenant_id` = 当前租户、`actor` = 操作者 `userId`、`detail` JSON 含 `outboxId`、`loanId`、`previousStatus`、`previousAttempts`（与重试前一致）、`at`。
- 拒绝且**无成功审计**（审计行数前后不变、outbox 行不变）：非 Admin（含 `audit`/`reviewer` 角色）→ 403；其他租户的 Admin 用本租户的记录 ID → 404；非法状态（`pending`、`retry`、`sending`、`sent`、`cancelled` 逐一；这些是 `telegram_outbox` 在代码里实际出现的状态值）→ 409；记录不存在 → 404。
- 竞争：对同一条记录连续重试两次，第二次 409，且审计总数仍为 1。
- 原失败测试 `Telegram signed subscription, tenant isolation, one-time delivery and unsubscribe` 恢复通过；`npm run typecheck -- --incremental false` 不再报 `audit`。
- 没有新增测试失败；不删除、不降级现有测试。

## 3. R1-B（可选，单独分支，不属于"修复完成"的必要条件）

分支 `fix/server/notification-retry-audit-atomic`，**在 R1-A 合并后**才做；需要时由技术负责人确认。
- 问题：R1-F5。审计写入失败时出现"状态已变、无审计"。
- 最小改造：把重试改为一个 `db().batch([UPDATE …, INSERT INTO team_audit … SELECT … WHERE changes()=1])`（沿用 R1-F7 的既有写法），随后检查第一条语句的 `meta.changes`；`changes!==1` → 409，且不写审计。**不得**为此修改 `team_audit` 触发器或 `audit()` 的现有调用方。
- 允许修改：`lib/notifications/server.ts`（仅 `retryNotificationDelivery`）、相关测试。
- 验收：R1-A 的全部断言仍通过；新增"审计写入失败则状态保持 `failed`/`unknown` 且返回错误"的故障注入测试（例如在测试库对 `team_audit` 的该次插入制造失败而不改触发器定义）；竞争场景仍 409 且审计恰好 1 条。
- 风险：`batch` 在本地 Miniflare/测试适配里是事务，生产 D1 同样是批事务；回退 = 还原该函数。

## 4. 验证环境（仅本机，不挂载生产配置或凭据）

```
# 在 worktree 里先建一个空的 node_modules 目录作挂载点（已被忽略），再：
docker run --rm --network none -e CI=1 --tmpfs /tmp \
  -v <worktree>:/app:ro -v <已安装依赖的检出>/node_modules:/app/node_modules:ro \
  -w /app node:22.22.1-bookworm-slim <命令>
```
命令依次：`npm test`（或带 `--experimental-vm-modules --test tests/*.test.mjs`）、`npm run typecheck -- --incremental false`、`npm run lint`、`npm run check:client-boundary`、`git diff --check`（后者在宿主机运行）。
- 复用已有依赖，**不新增依赖**。涉及 L1-G 测试时保留其要求：`--user 1000:1000`、`-e L1G_CONTAINER=1`、`--tmpfs /data:uid=1000,gid=1000,mode=755`、`--tmpfs /out:uid=1000,gid=1000,mode=700`。
- 记录基线（`461d070`，容器内）：`npm test` 268 项，255 通过、1 失败（本卡对应）、12 跳过；typecheck 1 个错误（本卡对应）；lint 2 errors（卡二）、577 warnings；`check:client-boundary` 通过（Windows 宿主机上它因 `E:\E:\` 路径问题报 ENOENT，属环境问题，**以容器结果为准**）。跳过数与"其他环境"不同（容器里 Docker 依赖与 L1-G 门控测试会跳过），逐项列出名称与原因，**跳过不计入通过**。

## 5. 完成标准与自查记录
- R1-A 完成后：原失败测试通过、typecheck 通过；**卡二的 2 个 lint errors 仍在，必须在 PR 里如实写明，不得称"全绿"**。
- PR 描述固定包含：假设、发现（R1-F5）、风险、回退（还原导入行与新增测试）、五条自查命令的输出摘要。

## 6. 给 Codex 的提示词

```
【任务】R1-A：通知人工重试的 audit 缺失修复。严格按 docs/tasks/codex-prompts/R1-notification-retry-audit.md 的 §1、§2、§4、§5 执行；R1-B（§3）本次不做。
先读该文 §2「先读」所列文件。在独立 worktree 里基于最新 origin/main（461d070 或其后）建分支 fix/server/notification-retry-audit。
只改：lib/notifications/server.ts 的导入行、tests/team-integration.test.mjs（及必要的新测试文件）。其余一律不动，不得修改权限判断、状态集合、Telegram 发送/重放、租户隔离、数据库迁移。
先写好 §2 的全部验收断言并确认修复前失败，再补导入使其通过。验证在本机 Docker（node:22.22.1-bookworm-slim，--network none，只读挂载，复用已有依赖，不新增依赖）里完成；只用虚构数据，不发送真实 Telegram 消息；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名。
PR 小于 400 行；提交末尾加 `Line: server`；按固定格式汇报；卡二的 lint 错误要如实写明仍未修复。
```
