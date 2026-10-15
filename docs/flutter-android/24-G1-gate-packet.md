# G1 Gate Packet

```
Document:  24-G1-gate-packet.md
Date:      2026-10-07
Owner:     Claude（Product / Requirements / Architecture / API Contract）
Contract:  21-G1-company-auth-contract.md  v2.3  (APPROVED FOR IMPLEMENTATION)
Review:    22 (CONDITIONAL PASS) · 25 (FAIL→CF-7 fixed v2.1) · 26 (FINAL CONTRACT CHECK PASS) · 27 (Claude: GO WITH CONDITIONS) · 28 (Codex: HOLD → v2.2)
```

## G0 Status

**PASS**（HELIX `20`，在修正后的 JDK 契约 `19` 下；90 测试、clean build 通过）。G0 P2 债务带入 G1，见 `21` §10。

## G1 Scope

Company 选择/切换、Auth Preflight、Telegram OTP、密码登录/设置、找回密码、登出、会话恢复、极简首页/`/me`。**不含**：KYC、借款、报价、签名、还款、提现、深链认证、真实 Telegram 发送。CR-001 保持 G3 阻断。

## Resolved Contract Findings

状态均为 **CONTRACT CORRECTED v2 · IMPLEMENTATION OPEN**（契约已更正，代码未改；不等于 FIXED）。

| ID | 严重度 | 契约位置 | 任务卡 | 状态 |
|---|---|---|---|---|
| CF-0 | **P0** Tenant Context Integrity | `21` §5.4/§5.5/§5.9/§15 | COMPANY-COOKIE-01/02/03 | CONTRACT CLOSED / IMPLEMENTATION OPEN |
| CF-6 | P1 | §5.4 末段/§5.9 | COMPANY-COOKIE-04/03 | CONTRACT CLOSED / IMPLEMENTATION OPEN |
| CF-7 | P1 | §5.11/§5.11.1/§7.9/§8.x | ERR-01（增补） | **CONTRACT CLOSED / IMPLEMENTATION OPEN**（retryAfter default 60 / min 1 / max 3600） |
| CF-8 | P1 | §5.15/§7.9 | I18N-01（增补） | **CONTRACT + UX CLOSED / IMPLEMENTATION OPEN** |
| CF-10 | P1 | §7.9 | ANDROID-01（增补） | CONTRACT CLOSED / IMPLEMENTATION OPEN |

## UX Findings（Codex 范围）

R-3、R-5、R-12、U-4、U-5、U-6 —— **CLOSED**（`04` 已更新，`25` 独立核实）。无 Outstanding UX 阻断。

## P0

- **契约层 P0 = 0**；CF-0 为实现层 P0：出站 `payease_company` 注入与 Guard（`G1-COMPANY-COOKIE-01/02/03`；阻断测试 CF0-T1…T11）。未关闭则 G1 不得退出。

## P1

- **契约层 P1 = 0**。CF-6、CF-7、CF-8、CF-10 为实现层开放项（阻断测试见 `21`），不是契约缺口。

## P2

CF-5、CF-9、CF-11、CF-12、CF-13、CF-14；Flutter Tool JDK 25；`org.gradle.java.home` 机器路径；依赖漂移；高棉/中文语言学审校；Android runtime 验证。

## Runtime Requirement

G1 退出须有 L1/L2′ Android 证据：模拟器（`E:\Android\Sdk`，AVD KhmerX_API_30/35；与 Flutter `android-sdk` 单根对齐）、路由渲染、FakeKhmerXServer 全流程（`10.0.2.2`）、截图/logcat、App Link intent。证据须含环境身份（`19` 政策）。

## G1 Implementation Tasks（Trae；**GO — 已授权**）

`SUPPORT-01` → `COMPANY-COOKIE-01` → `COMPANY-COOKIE-04` → `NET-01` → `ERR-01` → `COMPANY-01` → `COMPANY-COOKIE-02` → `AUTH-01…09` → `COMPANY-COOKIE-03` → `ROUTER-01` → `COMPANY-02/03/04` → `I18N-01` → `ANDROID-01` → `TEST-*` → `RUNTIME-01` → `REPORT-01`。页面任务按 `04` §19 G1 Prototype Contract v2 执行。详见 `21` §7、§7.9。

## Exit Criteria

`21` §11（X-1…）全部满足；90 条 G0 测试保持；无 `dependency_overrides`；无生产访问/真实 OTP；CF-0 阻断测试通过；Codex 独立复验。

## Gate Decision

**APPROVED**（2026-10-07，三方 G1 Gate）。

| 方 | 结论 | 文件/来源 |
|---|---|---|
| Claude（Product/Architecture/Contract） | **GO** | `32-G1-claude-final-gate.md` |
| Codex（UX/Acceptance） | **GO**（UX CONTRACT = READY；ACCEPTANCE CONTRACT = READY） | `31-G1-ux-acceptance-rereview.md` |
| Trae（Engineering） | **GO WITH NONBLOCKING CONDITIONS**（Foundation Compatibility / Implementation Feasibility / Testability = READY；Blocked tasks = 0） | Trae Engineering Gate |

项目方决定：**THREE-PARTY G1 GATE = APPROVED；TRAE IMPLEMENTATION = GO。**

## Accepted G1 Implementation / Exit Debt

| # | 项 | 处置 |
|---|---|---|
| 1 | Android 模拟器/真机运行证据（L1 + L2′，截图/logcat、App Link intent、320/360/412dp 与 130%/200% 字体缩放） | **MUST CLOSE BEFORE G1 EXIT**（`21` X-18） |
| 2 | Flutter Tool / JDK 机器可移植性（Tool JDK 25） | nonblocking |
| 3 | 机器相关的 Gradle JDK 路径（`org.gradle.java.home`） | nonblocking |
| 4 | 依赖漂移 | nonblocking（只要行为与测试保持有效） |
| 5 | 语言学审校（km/zh） | 实施期 nonblocking；**最终面向用户文案的审校仍为必需** |
| 6 | 未来 AGP/Gradle 升级警告 | nonblocking |

## G1 Report

Trae 最终实施报告唯一文件名：`30-G1-implementation-report.md`。

## Gate Status

```
G0 = PASS
G1 = IMPLEMENTATION AUTHORIZED
G2 = HOLD
G3 = BLOCKED BY CR-001
```

实施期间 Claude 不并行修改 G1 契约；变更须走正式 CR。

## v2.2 Update（响应 `28` 与 `27`）

| 项 | 状态 |
|---|---|
| `28` P1-UX-02 `/home` API 范围冲突 | **CONTRACT CLOSED**：`21` §5.17 冻结 `/home` = Minimal Authenticated Landing；G1 业务 API = 无 KYC / 无 Loan / 无 Quote / 无 `/api/h5/state`；不调用 `POST /api/h5/locale`（OD-G1-3）。U-4 = CONTRACT CLOSED |
| `28` P1-UX-01 原型契约字段不全 | **CLOSED**：`04` §19 已完成 16 路由 + `candidateConfirm` 的全字段 Prototype Contract v2 |
| `28` P1-UX-03 Auth 路由错误绑定 | **CLOSED**：`04` §19.3 与各路由卡已绑定 400/401/403/404/409/429/503、offline、timeout、CTA、导航 |
| `27` P2-1 过期 UX 状态 | 已同步（`21` §6/§12/§13；`24`） |
| `27` P2-2 报告文件名 | 统一为 `30-G1-implementation-report.md` |
| `27` P2-3 RateLimitFailure | 单字段 `Duration? retryAfter` |
| `27` P2-4 候选取消残留 | 冻结于 `21` §5.14-3b；测试 CC-1…CC-4 |
| `28` P2-UX-01 `24` 过期 pending | 已同步 |

（历史记录）v2.2 阶段 Gate Decision 为 PENDING；现已被上方 **APPROVED** 取代。
