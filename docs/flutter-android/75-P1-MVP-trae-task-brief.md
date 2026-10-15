# 第一版（P1）任务书 · 给 Trae

```
Owner:   Claude（契约/架构）          Implementer: Trae（全部 Flutter 代码）
Accept:  Codex（UX 与独立验收）        Date: 2026-10-12
Status:  PROPOSED — 待业主同意后由业主通知 Trae 开工
Basis:   45（P1 契约）· 54（公共认证/去公司化）· 02（API 契约）· 61（错误码）· status/00-app-status-phase0.md（实机运行结果）
```

## 1. 目标（一句话）
真机/模拟器上走通：**打开 APP → 注册/登录 → 首页 → 贷款合同只读 → 切换语言**。用户全程看不到"机构/公司"。

## 2. 范围
**做**：公共入口与登录（手机号+Telegram 验证码、手机号+密码、忘记密码）、会话恢复与过期处理、首页、贷款列表与合同只读、登出、语言切换（km / en / zh）。
**不做**：还款、放款、提现、推送、罚息、KYC 提交、Google/Facebook 登录、任何公司/机构界面。

## 3. 必须修的问题（来自 10-12 实机运行 + 审计）

| # | 问题 | 要求 | 验证方式 |
|---|---|---|---|
| T1 | 第一屏是"服务机构"选择页 | 按文档 54 §7–§8：`ApiContext.Public`；**删除** `/company/select|scan|paste-link|candidate-confirm`、`/me/company`、登录页「更换服务机构」；不显示公司 ID；Manifest 中公司 App Link 在 P1 不启用；Tenant 模式代码与测试**保留不动**（休眠） | 全新安装 → 直接到登录页；文本扫描无「服务机构/Company ID」 |
| T2 | 401 显示成 `error.auth.unauthenticated` | 后端 401 的 code 是 **`AUTH_REQUIRED`**（不是 `session_expired`）。映射为"请重新登录" | 未登录请求受保护接口 → 显示本地化句子 |
| T3 | 会话过期不回登录页 | 接上 `SessionInvalidationCoordinator.onHttp401`（目前全库零调用）；路由重定向要监听认证状态；过期后清内存快照并回 `/auth/login` | 登录后服务端使会话失效 → 下一次请求自动回登录页 |
| T4 | 未翻译键名会显示给用户 | 任何缺失的 messageKey 兜底为通用提示（如"出了点问题，请重试"），**绝不显示键名**；加一个测试扫描所有页面不出现 `error.` 前缀文本 | 单测 + 手测 |
| T5 | 信封 `traceId` 没读 | 错误响应体 `{error, code, traceId}`：优先读体内 `traceId`，其次响应头 `X-Request-Id`（现在读的是 `X-Trace-Id`，后端不发这个头）；`code` 为 null 时继续尝试 `error` | 单测 |
| T6 | 发布配置不安全 | `APP_ENV` 默认值不得让 release 包指向 `http://10.0.2.2`；release 构建必须显式指定环境，缺失则构建失败；release 不得用 debug 签名（签名由业主提供，缺失则**不产出**可安装的 release 包） | 构建脚本检查 |
| T7 | 日志可能带出 PII | `SafeLogger` 与 `FlutterError`/`PlatformDispatcher` 入口走 `RedactionPolicy`；不输出 Cookie/OTP/密码/完整手机号 | 单测 |
| T8 | 登出遇离线/5xx 无法本地登出 | 登出失败时仍允许本地清会话并回登录页（服务端会话由过期兜底） | 手测 |
| T9 | 死代码和静态分析 | 删除 `features/company/domain/_unused.dart`（`flutter analyze` 现有 2 个 error 均来自它）；`flutter analyze` 0 error | `flutter analyze` |

## 4. 本地联调后端（Trae 需要先解决，否则无法验收）
现在**本机无法登录**：APP 把后端当"浏览器客户端"，而本地 dev 服务需要网关注入身份，且库里没有任何测试公司。
要求（脚本放 `scripts/dev-app-backend/`，写 README，**不改业务代码**）：
1. 一条命令启动本地后端（standalone 网关 + 空库迁移 + 测试模式 `KHMERX_TEST_MODE`），监听 `10.0.2.2:80` 可达的端口。
2. 自动种入 1 家测试公司作为公共工作区（`companies[0]`）和 1 个测试员工，使公开注册可用。
3. 测试模式下验证码是模拟的（后端 demo 模式固定返回 `demoCode`，不会发 Telegram 消息）；APP 联调**不得**触发真实验证码、**不得**连生产。
4. 能种入 1 笔测试贷款（含合同）用于"合同只读"验收。

## 5. 验收（Definition of Done）
全部在模拟器或真机上、连本地联调后端、**由 Trae 录屏并交付**：
1. 全新安装 → 登录页（无任何机构/公司界面）。
2. 用测试手机号 + 模拟验证码注册 → 进入首页。
3. 退出 → 用手机号 + 密码登录（先设置过密码）。
4. 首页显示该账号的贷款；点进去看到**合同详情（只读，无还款/提现入口）**。
5. 服务端使会话失效后再操作 → 自动回登录页，提示是一句本地化的话。
6. 切换到 km / en / zh，各主要页面无键名、无混语。
7. 断网/后端不可达 → 友好的错误页，不崩溃。
8. `flutter analyze` 0 error；全部测试通过；既有 CF0-T1…T11（Tenant 模式）仍通过；无 `dependency_overrides`；日志无 PII。
交付物：APK（debug 即可）、录屏、`flutter analyze` 和测试输出、一页**状态表**（每个功能 能用/有问题/没做）。

## 6. 约束（不变）
- 浏览器兼容客户端：Cookie 会话 + Origin；**不用** Bearer，**不用** `/api/mobile/*`。
- Deep Link 永不产生已认证状态。
- 不得在日志里出现 OTP、密码、Cookie、完整手机号、challengeId、session。
- 不用真实 Telegram 验证码做自动化测试；不对生产做有副作用的调用。
- 不改后端业务代码、不改契约文档；发现契约问题回报 Claude。

## 7. 不在本任务内（Claude 另行处理，不阻塞开发）
- 后端：CR-003 公共客户工作区、`requestDigests` 泄露、浏览器令牌配额。**公众上线前必须完成**，开发联调不依赖。

## 8. 汇报格式
完成后只交：①录屏 ②状态表 ③`flutter analyze`/测试输出 ④遗留问题清单。不要再产出新的评审文档。
