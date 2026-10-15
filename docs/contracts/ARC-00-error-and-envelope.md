# ARC-00 统一错误体与请求编号契约

状态：草案 v1（待技术负责人确认）　适用：所有 `/api/*` 接口，所有客户端（H5、小程序、管理后台、Flutter App）
关联文档：`docs/api-error-codes.md`（旧，保留兼容）、`docs/architecture-target-20261015.md`

## 1. 请求编号（requestId）
- 客户端每次请求发送 `X-Request-Id`（UUID v4；非 HTTPS 环境使用 `lib/client-id.ts` 的实现，不得直接用 `crypto.randomUUID()`）。
- 服务端：读取该头，格式合法则沿用，否则自己生成；**响应头 `X-Request-Id` 和响应体 `requestId` 必须是同一个值**；日志、审计、机构投递都带这个值。
- 禁止在一个请求里出现两个不同的编号（现状 `kyc/server.ts` 的 `traceId` 与 `requestId` 不一致，要合并）。

## 2. 错误体（所有失败响应，一律此形状）
```json
{ "code": "AUTH_REQUIRED", "error": "客户登录已失效，请重新验证手机号", "requestId": "…", "params": { } }
```
- `code`：稳定的机器码，**必填**。客户端只按它判断逻辑和选择多语言文案。
- `error`：仅为旧客户端兼容的中文说明，**不得**用于判断，不得出现内部信息（异常堆栈、SQL、路径、第三方响应原文）。
- `requestId`：必填。
- `params`：可选，供多语言文案插值（如 `{ "retryAfterSeconds": 60 }`）；不得放敏感数据。
- 成功响应形状本阶段不变（兼容旧客户端）。统一信封 `{data, requestId}` 留到 `/v1`。

## 3. HTTP 状态码与 code 的对应规则
| 状态码 | 含义 | 典型 code |
|---|---|---|
| 400 | 请求本身有问题 | `INVALID_REQUEST`、`INVALID_ARGUMENT`、`VALIDATION_FAILED`、`INVALID_PHONE`、`INVALID_VERIFICATION_CODE`、`INVALID_FILE`、`INVALID_KYC` |
| 401 | 未登录或会话失效 | `AUTH_REQUIRED` |
| 403 | 已登录但无权限 / 跨站 / 需要二次验证 | `FORBIDDEN`、`CROSS_SITE_REQUEST`、`MFA_STEP_UP_REQUIRED`、`STAFF_DUAL_CONTROL_REQUIRED`、各 `*_FORBIDDEN` |
| 404 | 资源不存在或不可访问 | `NOT_FOUND`、`COMPANY_NOT_FOUND` |
| 409 | 版本、状态或重复操作冲突 | `CONFLICT`、`KYC_REVISION_CONFLICT`、`IDEMPOTENCY_PAYLOAD_MISMATCH`、各 `*_CONFLICT`、`ACCOUNT_ALREADY_REGISTERED`（新） |
| 413 | 请求体过大 | `PAYLOAD_TOO_LARGE` |
| 415 | Content-Type 不支持 | `INVALID_REQUEST` |
| 429 | 频率超限 | `RATE_LIMITED`（`params.retryAfterSeconds`） |
| 500 | 服务端未预期错误 | `INTERNAL_ERROR`（新）——**未知异常一律这个**，细节只写日志 |
| 502/503/504 | 依赖不可用 | `SERVICE_UNAVAILABLE`（`params.retryAfterSeconds` 可选） |

铁律：
1. 已知的业务错误（权限、校验、冲突）**不得**返回 503；现状 `lib/h5-auth.ts` 的 `failure()` 把所有非 `AuthError` 异常都变成 503，要改。
2. 未知异常**不得**把 `e.message` 返回给客户端（现状 `app/api/state/route.ts`）。
3. `codeForError()` 靠中文子串猜 code 的做法只作为过渡兜底，新代码必须显式抛出带 code 的 `ApiError`。

## 4. 服务端接口（ARC-00 要求，S2 实现）
```ts
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public params?: Record<string, unknown>) { super(message) }
}
// 处理器包装：统一读 requestId、鉴权/Origin 校验、body 大小与 Content-Type、异常转换、写审计上下文
route({ auth: 'customer' | 'staff' | 'system' | 'public', origin: 'required', maxBody: number, handler })
```
- 所有写接口 `origin: 'required'`（不再有"缺 Origin 放行"）。
- body 上限按路由声明，并在 `docs` 的接口清单里登记（现状有 4096 / 10000 / 12000 / 50000 / 64KB 五种）。

## 5. 客户端行为（D1/D4 实现，Flutter 同步）
| code | 客户端动作 |
|---|---|
| `AUTH_REQUIRED` | 触发全局"会话失效"事件，回到登录页，保留返回地址 |
| `RATE_LIMITED` | 提示稍后再试；按 `params.retryAfterSeconds` 禁用按钮 |
| `CONFLICT` / `*_CONFLICT` / `KYC_REVISION_CONFLICT` | 重新拉取最新数据并提示 |
| `ACCOUNT_ALREADY_REGISTERED` | 引导用验证码或密码登录（取代按中文文案 `includes` 判断） |
| `SERVICE_UNAVAILABLE` / `INTERNAL_ERROR` | 通用错误提示 + 显示 `requestId`（便于客服排查） |
| 未知 code | 回退到 `REQUEST_FAILED` 的文案，不显示 `error` 原文 |

- 所有 code 必须在 `en / km / zh` 三份文案里有条目；缺失视为测试失败。
- `apiFetch`：默认 15 秒超时；只有 GET 可自动重试（最多 2 次，退避）；写操作重试必须带同一个幂等键。

## 6. 现有 code 清单（保持不变，不得重命名）
通用 14 个见 `docs/api-error-codes.md`。已在代码中使用的专用 code（节选，完整以代码为准）：
`CROSS_SITE_REQUEST`、`MFA_STEP_UP_REQUIRED`、`MFA_REQUIRED_FOR_SSO`、`MFA_REQUIRED_FOR_INVITE`、`MFA_ATTEMPTS_EXCEEDED`、`STAFF_DUAL_CONTROL_REQUIRED`、`IDEMPOTENCY_PAYLOAD_MISMATCH`、`TELEGRAM_INITDATA_INVALID`、`TELEGRAM_INITDATA_REPLAY`、`TELEGRAM_SUBSCRIPTION_REPLAY`、`BROWSER_TOKEN_RATE_LIMITED`、`BROWSER_SESSION_MISMATCH`、`COMPANY_NOT_FOUND`、`COMPANY_ACCESS_FORBIDDEN`、`KYC_REVISION_CONFLICT`、`WORKSPACE_PAYLOAD_LIMIT`、`STATE_MUTATION_FAILED`、`VERIFICATION_UNAVAILABLE`、`JOB_UNAUTHORIZED`、`POSTLOAN_JOB_FAILED`、`RISK_RULE_*`、`FUNDING_*`、`REPAYMENT_*`、`PAYMENT_RECEIPT_*`、`INVITE_*`、`BOT_ACCESS_FORBIDDEN`、`PASSWORD_ADMIN_*`、`NOTIFICATION_*`、`TICKET_READ_ONLY`。

## 7. 本契约新增的 code
| code | 用途 |
|---|---|
| `INTERNAL_ERROR` | 未预期的服务端错误（500） |
| `VALIDATION_FAILED` | 字段校验失败；`params.fields` 为 `[{ "field": "...", "reason": "..." }]` |
| `ACCOUNT_ALREADY_REGISTERED` | 注册时账号已存在，需改用登录（409） |

## 8. 验收（契约级）
1. 任意接口的失败响应都满足第 2 节形状（用契约测试遍历路由清单校验）。
2. 响应头与响应体的 `requestId` 一致；客户端发来的合法 `X-Request-Id` 被沿用。
3. 构造未知异常，响应里不含异常原文，状态码为 500，日志里有完整堆栈和 `requestId`。
4. 构造业务校验错误，状态码不是 503。
5. `en/km/zh` 三份文案覆盖本文第 3、6、7 节所有 code。
