# G1 Claude Final Architecture Gate Confirmation

```
Date:      2026-10-07
Reviewer:  Claude（Product / Requirements / Architecture / API Contract Owner）
Reviewed:  21 v2.3 · 24 · 26 · 27 · 28 · 31 · 04 §18–§19
Scope:     仅验证 27 的 4 项历史 P2 是否落地；不扩架构，不改 Flutter 代码，不重开 UX。
```

## 1. 四项历史 P2 核验

| ID | 要求 | 结果 | 证据（`21`） |
|---|---|---|---|
| P2-1 | 无过期 “UX pending / 页面任务被 UX 阻塞” | **CLOSED**。核验中发现 3 处残留（§6 结论、`G1-I18N-01` 增补、§13.2-3 仍写“待 Codex”），已做**机械勘误**（v2.3），无设计变更 | §6 表全 CLOSED；§12 OD-G1-1/5/8 = 否；§13.1–13.3 已对齐 `04` §19 与 `31`；全文无 “SIDE PENDING” |
| P2-2 | 报告唯一名 `30-G1-implementation-report.md` | **CLOSED** | 全文无 `22-G1-implementation-report`；REPORT-01 与 X-22 等 3 处均为 `30-…` |
| P2-3 | Domain 仅 `Duration? retryAfter` | **CLOSED** | §5.11.1 “单字段”；429 错误行、ERR-01、§15、RA 表均为 `retryAfter`；`retryAfterSeconds` 仅在“不得并存”的禁止句中出现；规则 missing/invalid/≤0→60s、1..3600→原值、>3600→3600 无冲突定义 |
| P2-4 | 候选公司取消语义 | **CLOSED** | §5.14-3/3a/3b：取消后 ActiveCompany 仍为 A、A 会话不变、B 不成为活动/已认证上下文、B 临时状态不影响 A；允许无害的公司隔离 visitor 元数据，但登录态只由预检响应推导；测试 CC-1…CC-4 |

## 2. 其余确认

- **CF 状态**：CF-0/6/7/10 = CONTRACT CLOSED / IMPLEMENTATION OPEN；CF-8 = CONTRACT + UX CLOSED / IMPLEMENTATION OPEN。“实现开放”是 Trae 下一阶段任务，**不计入契约 P1**。
- **UX**：沿用 `31`（CODEX G1 UX GATE = GO；UX/ACCEPTANCE CONTRACT = READY；P0=0、P1=0）。不重开。
- **Scope**：IN = Company、Company Context、Switch、App Link、Preflight、OTP、Password Login/Setup、Recovery、Session Restore、Logout、401 Return Intent、Error Mapping、Locale、Minimal Authenticated Home、Android Runtime Validation；OUT = KYC、Loan、Quote、Signature、Repayment、Withdraw、CR-001 实现。`21` §1、§5.17、X-21、HM-1 一致。
- **架构兼容**：G1 为 G0 增量扩展（`21` §2.3）：Riverpod、Dio、CookieJar（4-Cookie 白名单语义不变）、SecureStorage、Router、SafeLogger、Localization 均保留；仅替换 G0 本就是占位的组件；唯一守卫规则调整（`mobile_scanner`）已显式写明。**无需推翻 G0 Foundation。Architecture P1 = 0。**
- **Android runtime**：X-18（L1 + L2′）仍在 G1 Exit。

## 3. 非阻断观察（P2，不影响 GO）

- Android 运行证据、截图/logcat、320/360/412dp 与 130%/200% 字体缩放执行证据：实现期 Exit 证据。
- G0/G1 实现类 finding 待 Trae 实现并经 Codex 独立复验。
- `31` 的路由计数表述为 “16 routes + 1 state”，而其清单编号 1–16 已包含 `candidateConfirm`（即 15 路由 + 1 状态）。仅为计数措辞，不影响契约（`21` §6.2 与 `04` §19 的条目集合一致）；留给 Codex 顺手更正，不重开。
- 依赖漂移、`org.gradle.java.home` 机器路径、AGP/Gradle 未来警告、语言学审校（既有 P2 债务）。

## 4. Final Summary

```
CLAUDE G1 FINAL GATE: GO

P0: []
P1: []
P2: implementation / runtime / evidence items only (non-blocking)

IMPLEMENTATION CONTRACT: READY

RECOMMENDATION: AUTHORIZE TRAE AFTER TRAE ENGINEERING GATE
```

**说明**：本文是 Claude 的 Architecture/Product Gate 结论，不是授权令。`21` 仍为 PROPOSED（批准权在 Codex/三方 Gate，`21` §13.2-1/2）；Trae 在“Trae Engineering Gate”与三方批准完成前保持 HOLD。
