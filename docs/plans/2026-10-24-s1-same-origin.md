# S1 Same-Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task after plan review.

**Goal:** 基于最新 main 重做已单独解冻的 S1；只开 PR，不合并、不部署。
**Architecture:** 旧 JSON 浏览器写接口在任何鉴权或业务副作用前校验来源，并携带 request 序列化异常。保留已经存在的 JSON reader、上传二进制协议、机构签名回调和调度鉴权，不把“未使用 route()”误判成无同源校验。
**Tech Stack:** Next TypeScript，Node test runner，现有 ARC-00 路由工具。
**Spec:** claude-bridge/done/20261024-1650-01b-s1-resume.md；原任务 20261024-1030-08-pr63-slice-s1.md。

## Global Constraints
- 基线 origin/main 682bbcbb44dbb24c82bdf05312d7537922be981e；开始实现前重新 fetch。
- 不 cherry-pick #63；其他切片继续冻结。只开 feat/server/s1-same-origin PR，负责人批准才能合并。
- 每 PR 小于 400 行，超出拆分 s1a/s1b；全量四门禁与 CI 通过。
- 不做线上写操作、部署、迁移、资金逻辑变更。

## 路由盘点（全部为 POST，无 PUT/PATCH/DELETE 导出）
已使用 route(origin:required)：bots、h5/state、kyc、state、team/customer-tags、team/products、team/tickets，不重复修改。

尚未封装但调用 input()（其 readJsonBody 已 enforce Origin），异常多数 failure(e) 丢失请求关联：
admin/customer-cleanup；analytics/events；h5/auth/account；h5/auth/logout；h5/auth/recovery；h5/auth/send；h5/auth/verify；h5/locale；postloan；team/audit-integrity；team/auth；team/bots；team/emergency；team/funding-risk；team/funding-settings；team/institution-callbacks；team/kyc-followups；team/locale；team/notification-templates；team/reports/export；team/risk-rules；team；team/servicing；telegram。
实现时逐个确认检查在业务前的位置；team/bots 自定义错误包需保留契约或用兼容失败包装，不能机械替换业务响应。

需特殊处理：
- h5/auth/telegram：读 x-telegram-init-data，当前未调用 input()/sameOrigin，浏览器写接口，需要前置校验，确认调用方发送 application/json。
- kyc/review：decide(request) 内部链需继续核查来源检查，错误 failed(e) 关联 request。
- kyc/geocode：已 origin(request)，failed(e) 未携 request；保留收费调用的限流，不实际调用上游。
- kyc/files：已 origin(request) 与 failed(e,request)，二进制上传，不可加要求 JSON 的 sameOrigin。
- loan/sign：已 origin(request)，二进制签名，不可加要求 JSON 的 sameOrigin；failed(e) 关联 request。
- institution/callback：机器间 HMAC/nonce/idempotency 认证，不能要求浏览器 Origin；保留全部业务逻辑。
- jobs/postloan：机器间 jobAuthorized，不能要求浏览器 Origin；保留现有调度协议。

## Review Focus
- 缺失/外国 Origin 在鉴权、数据库和上游调用之前拒绝。
- 合法同源 JSON 保留状态码、响应与 requestId 对应。
- 二进制文件/签名不能被 application/json 限制阻断。
- HMAC 回调与调度无浏览器 Origin 仍按既有认证处理。
- 不回传栈或敏感值；不改变审核/资金/认证业务决策。

### Task 1：JSON 浏览器路由与错误关联（按行数拆批）
- [ ] 继续核查 decide、origin 和各客户端调用，逐路由锁定范围。
- [ ] 每个改动路由先写真实 handler 行为回归：跨站/缺失来源 403 CROSS_SITE_REQUEST、同源合法输入正常、关联 requestId 一致、未发生业务副作用；仅 stub 外部边界。
- [ ] 运行测试确认 RED；再最小增加 sameOrigin(request) 或现有 requireOrigin 等价前置调用，以及 failure(e,request)/failed(e,request)。不重构业务逻辑。
- [ ] 保留机器接口与二进制专用守卫，并补不退化回归。
- [ ] focused GREEN，然后 npm test、npm run typecheck、npm run build:separated、npm run lint；0 失败，记录既有 warnings。
- [ ] 推送普通分支，PR 标注“#63 切片 S1，基于 main 重做，需技术负责人批准合并”，等待 CI；不合并。

## 待计划复核
不能机械给所有未包装 POST 增加 sameOrigin：它强制 JSON，会破坏上传/签名与机器回调。请复核以上最小范围和排除项后执行；当前只做只读盘点，没有改动运行代码。

## 实施分批
s1a：8 个登录/语言/埋点入口，来源检查前置到所有身份或数据库访问前。已确认 Telegram 客户端 POST 无 body、无 Content-Type，因此复用计划允许的 requireOrigin（仅来源），不强制 JSON；其他 JSON 入口保留 input/readJsonBody。s1b：剩余旧 JSON 入口及错误关联，独立 PR。两批均不合并、不部署。
