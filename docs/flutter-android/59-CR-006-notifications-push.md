# CR-006 · Notifications & Push（通知与推送）

```
Status:     PROPOSED — READY FOR CODEX RE-REVIEW（v2，据 62 修订；未自批；不授权实施）
Version:    v2 · 2026-10-09（v1 备份：59-CR-006-notifications-push.md.pre63.bak）
Owner:      Claude（契约起草）
Phase:      P8（通知部分）
Decisions:  DEC-4（提供方）= 倾向 FCM，保持提供方抽象；Telegram 提醒仍为 Mini App 专属，Android 独立
Depends:    CR-007 §3.4（财务事务与 outbox）· CR-012（错误码）
Evidence:   HEAD d916b45，2026-10-09
```

**范围**：为原生 Android 提供**独立于 Telegram Mini App** 的通知投递（设备注册、令牌轮换、注销、多设备、提供方抽象、事件映射、去重、语言、偏好、点击目标策略）。**不假设 `initData`**。**不定义通知中心/收件箱 UI 或 API**（OD-6.4：另立）。**通知失败永远不得回滚金融/KYC/贷款业务成功。**

---

## 1. Problem（现状事实）
| # | FACT | 证据 |
|---|---|---|
| F1 | `state.notifications` 是**模拟记录**（`{id, loanId, botId, text, at, status}`；状态文案 '模拟已记录 · 未发送 Telegram'），存于工作区 JSON，无已读/类型字段 | `lib/domain.ts` |
| F2 | 真实投递仅 Telegram：`telegram_subscriptions`（加密 chat id）、`telegram_outbox`（`UNIQUE(owner, notification_id)`）、`dispatchCompany` 仅入队 `postloan-reminder:*`，最多 5 次；模板 `team_notification_templates`；语言取 `h5_accounts.locale` | `lib/notifications/server.ts`；`drizzle/0009*` |
| F3 | 订阅需 Mini App `initData`（MINI APP ONLY） | `app/api/telegram/route.ts` |
| F4 | **无设备/推送令牌概念** | 检索 |
| F5 | 到期提醒：T-3…T-1，每贷款每到期日一条；`postloan` cron 驱动 | `lib/postloan/core.ts` |
| F6 | **存储事实**：KYC 状态、财务事实、审计、outbox 候选表**与**工作区 JSON 在**同一个 D1 数据库**；D1 `batch()` 为 SQL 事务（须测试证明）；需注意：工作区贷款迁移（`apply`/审批等）当前由 `UPDATE demo_workspaces … .run()` 或员工路径的批提交，**部分路径未使用批** | `lib/store.ts`；`lib/team/workflow.ts` |

## 2. 目标与非目标
**目标**：设备注册；令牌轮换；按安装注销；多设备；提供方抽象；事件→通知映射；去重；本地化；偏好；点击目标策略；可恢复的事件产生。
**非目标**：收件箱；Telegram 通道改造；营销推送；富媒体。

## 3. 设备注册与生命周期

### 3.1 注册
`POST /api/h5/devices`（Cookie 会话 + Origin + JSON）
```
{ requestId, installationId(UUID，每次安装生成并持久), platform:'android', pushToken, tokenProvider:'fcm', appVersion, osVersion?, locale, notificationsEnabled }
```
- 以 `(customerId, installationId)` upsert；返回 `{deviceId, registeredAt}`。
- **令牌轮换**：同一 `installationId` 带新 `pushToken` ⇒ 更新（旧令牌作废）。
- `pushToken` 是秘密：**加密存储**（AES-GCM，同 chat id 做法），不入日志；`token_hash` 用于唯一/去重。
- 速率限制（复用 `RATE_LIMITED`，语义：设备注册过于频繁）；单客户设备数上限 `DEVICE_LIMIT_REACHED`（上限值 OD-6.2；保守临时上限可指定）。
- 数据：`push_devices(id, owner, customer_id, installation_id, platform, provider, token_encrypted, token_hash, locale, enabled, status('active'|'inactive'), app_version, last_seen_at, created_at, updated_at, UNIQUE(owner, installation_id), UNIQUE(provider, token_hash))`——**`installation_id` 同一时刻只绑定一个客户**。

### 3.2 注销与撤销范围（冻结）
| 场景 | 行为 |
|---|---|
| **普通登出（设备 A）** | `DELETE /api/h5/devices/{installationId}` ⇒ **仅**使设备 A 失效；**该客户的其它活动设备保持注册**。登出时客户端 best-effort 调用；若调用失败，设备在下次会话建立或服务端清理时仍按 §3.3 处理 |
| **会话到期 / 单会话撤销** | **不自动**销毁无关设备的注册（推送正文无敏感内容，不依赖会话）；设备保持 `active` 直到明确注销、令牌失效或 §3.2 全局事件 |
| **账号级安全事件** | 密码重置并"撤销全部会话"、账户删除、客户显式"撤销所有会话"、安全锁定 ⇒ **使该客户全部设备失效** |
| FCM 返回 `UNREGISTERED/INVALID` | 该设备 `inactive` |

### 3.3 安装 vs 会话（共享设备隐私）
推送注册属于 **`customer + installation`**，**不是**某个短期会话。同一安装换账号登录：`POST /api/h5/devices` 以 `installationId` upsert ⇒ **改绑到新客户**并使旧绑定失效（旧客户不再收到该设备的推送）；这是共享设备防止"下一个人收到上一位客户通知"的关键。重新登录同一客户的同一安装 ⇒ 重新激活并更新令牌/语言。投递以"设备当前绑定客户"为准；由于内容不含敏感信息，**不要求当前存在有效会话**。

## 4. Provider 抽象
`PushProvider { send(deviceToken, message) → ok | retry | invalid_token | failed }`。首个实现 **FCM v1**（服务账号凭据仅服务端环境）；可替换。投递经出站队列 `push_outbox`：`UNIQUE(owner, notification_event_id, device_id)`；状态 `pending→sending→sent|retry|failed|unknown|cancelled`，最多 5 次，指数退避。**提供方错误不对客户端暴露**（异步服务端事实）。

## 5. 事件产生：outbox 与可恢复性（据真实存储）
### 5.1 存储事实与规则
- 业务事实与 outbox 在**同一 D1 数据库**；因此**若业务变更是一次 D1 批，`notification_events` 行可在同一批内以条件链写入**（`INSERT … WHERE changes()=1`），**与业务一同提交或一同回滚**。
- **不得声称不存在的原子性**：对于当前以 `.run()` 单语句提交的路径（如客户 `mutate`），实现必须先**改为批**（业务 UPDATE + outbox 条件插入），否则按 5.2 兜底。
- 通知产生/投递失败**不得**使业务事务失败：outbox 行与业务同批提交，但投递（FCM 等）是异步的，失败只影响 `push_outbox` 状态。

### 5.2 兜底：可恢复的事件重建（Reconciler）
- 对无法与业务同批提交的路径：业务提交后**在耐久业务事实上**产生通知意图——由 **reconciler** 周期性扫描权威事实（`kyc_cases/history` 状态迁移、`repayment_ledger`、`disbursement_instructions`、贷款事件、`loan_financial_state`、`postloan` 到期日）并**按确定性键补建缺失的 `notification_events`**。
- 因此：业务成功 ⇒ 通知事件**最终必然存在**（at-least-once 产生，exactly-once 投递由去重保证）。**通知失败永不回滚业务**。

### 5.3 事件键（确定性）
```
dedupeKey = customerId : eventKind : objectId : objectVersion|domainEventId
```
`UNIQUE`。重放/重建不会重复事件；同一事件对同一设备至多投递一次（`push_outbox` 唯一）。提醒按"贷款 + 到期日 + 档位"去重。`objectVersion` 取自权威事实（`financial_version`、KYC `revision`、指令 `id+status` 等）。

## 6. 事件 → 通知映射
| 事件 | 触发源 | 类别 | 默认 |
|---|---|---|---|
| `kyc.updated` | KYC 迁移（approved/needs_info/rejected） | 事务性 | 开 |
| `loan.submitted` | `apply` | 事务性 | 开 |
| `loan.decision` | 审批通过/拒绝 | 事务性 | 开 |
| `disbursement.updated` | CR-005 状态机（processing/confirmed/failed/returned） | 事务性 | 开 |
| `repayment.confirmed` / `repayment.failed` | CR-004 过账/失败 | 事务性 | 开 |
| `due.reminder` | `postloan`（T-3…T-1、到期日） | 提醒 | 开，可关 |
| `overdue.reminder` | CR-007 拖欠状态 | 提醒 | 开，可关 |
事务性类别不可全部关闭；提醒类可关闭。

## 7. 内容与隐私
推送正文**不含 PII/金额/账号/令牌/验证码**：仅本地化通用文案 + `{ kind, objectId }`；详情在用户打开 App 并通过认证后读取。语言取设备注册 `locale`（回退 `h5_accounts.locale`，再回退 en）；模板机制沿用 `team_notification_templates`（新增事件键）。

## 8. 偏好
`GET/PUT /api/h5/notification-preferences`：`{ reminders: boolean, quietHours?: {…} }`（OD-6.3；默认提醒开、无静默时段）。偏好按客户（跨设备）；设备级 `enabled` 反映 OS 权限（Android 13+ `POST_NOTIFICATIONS`）。非法值 → `NOTIFICATION_PREFERENCES_INVALID`。

## 9. 点击目标（Deep-link 目标策略）
推送数据只含**枚举目标** `target ∈ { HOME, LOAN_DETAIL(loanId), REPAYMENT(repaymentId), DISBURSEMENT(loanId) }`，不含 URL；客户端按白名单解析；未认证 → 登录 → Return Intent（仅 GET/导航，**绝不重放写操作**）；未知目标 → HOME。

## 10. 与 CR-012 的错误集成
对外可见失败仅：`PUSH_TOKEN_INVALID`(400) · `DEVICE_LIMIT_REACHED`(409) · `PUSH_REGISTRATION_UNAVAILABLE`(503) · `NOTIFICATION_PREFERENCES_INVALID`(400) · `RATE_LIMITED`(429) · 通用 `AUTH_REQUIRED/INVALID_REQUEST/IDEMPOTENCY_PAYLOAD_MISMATCH`。**不创建提供方特定（FCM）错误码给 Android**；`DELETE` 未知安装幂等成功。

## 11. 安全
令牌加密/脱敏；FCM 凭据仅服务端；注册端点 Origin/会话校验；账号级安全事件使全部设备失效；批量注册限流；日志仅记录 `deviceId` 与结果类别，不记令牌。

## 12. 与既有渠道的关系
Telegram 提醒继续独立（Mini App 专属）；同一事件可同时进入 Telegram 与 Push（各自去重）；`state.notifications`（模拟记录）保持，其"未发送 Telegram"文案不作为投递事实。

## 13. 向后兼容
纯增量：新端点与新表；老客户端不受影响。

## 14. 测试（契约）
注册 upsert 与轮换 · **普通登出仅停用本设备，其它设备仍注册** · 密码重置撤销全部/账户删除使全部设备失效 · 单会话到期不销毁设备 · 共享设备换账号改绑（旧客户不再收到）· 多设备扇出 · 无效令牌停用 · **业务批内 outbox 同提交/同回滚**；**不使用批的路径由 reconciler 补建，不重复投递** · 通知失败不回滚业务 · 去重（重放/重建/提醒档位）· 推送正文无金额/PII · 偏好生效（提醒可关、事务性不可全关）· 目标白名单与未认证重定向 · 令牌不入日志。

## 15. Open Decisions（分类）
| ID | 决策 | 分类 |
|---|---|---|
| OD-6.1 | 推送提供方最终选择与凭据归属 | **BLOCKS 生产提供方激活**（抽象工作可先行） |
| OD-6.2 | 设备数上限与过期清理 | **BLOCKS 生产容量策略**（可先指定保守临时上限） |
| OD-6.3 | 静默时段与提醒频率 | CAN REMAIN OPEN（默认：提醒开、无静默时段，端点有中性默认） |
| OD-6.4 | 通知收件箱 | NONBLOCKING，明确不在本契约 |

## 16. Gate
```
CR-006 v2: PROPOSED — READY FOR CODEX RE-REVIEW；Implementation: NOT AUTHORIZED；Trae = HOLD
```
