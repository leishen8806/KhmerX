# G1 Claude Gate Review（Architecture / Product / Contract Owner）

```
Document:  27-G1-claude-gate-review.md
Date:      2026-10-07
Reviewer:  Claude（Product / Requirements / System Architecture / API Contract Owner）
Reviewed:  02 · 04（含 §18）· 05 · 20 · 21 v2.1 · 24 · 25 · 26；mobile/lib、mobile/test（只读核查）
Scope:     本轮不修改契约、不修改代码。已 CLOSED 的 finding 不重开。
```

## 1. 结论

**CLAUDE G1 GATE: GO WITH CONDITIONS**

- Architecture P0 = 0，P1 = 0；无开放产品决策；无未解的 API 歧义。
- 发现 4 项 **P2**（均为文档一致性/表述收紧，不改变任何冻结设计），见 §4。
- Claude 无权把 `21` 改为 APPROVED（`21` §13.2-1 要求 Codex 批准）。授权 Trae 的前提见 §6。

## 2. 对 14 项检查的逐项判断

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 2 | CF-0/6/7/8/10、R-3/5/12、U-4/5/6 已完整表达 | PASS | `21` §5.4、§5.11.1、§5.15、§7.9、§15；`04` §18；`26` |
| 3 | ActiveCompany = 业务真源；`payease_company` = 传输 Cookie；最终出站恰好一个 | PASS | `21` §5.4 “真源与传输”、Guard（CookieManager 之后，fail-closed）；**明确禁止手写 `Cookie` 头**并说明 `dio_cookie_manager 3.5.0` 合并不去重的原因；CF0-T7 构造重复 Cookie 并要求拒发 |
| 4 | 无 ActiveCompany → 阻断，不依赖代理默认第一家公司 | PASS | Rule B；CF0-T5（零请求、不发占位值）；`21` §5.13 路由第 2 行；API 层不存在无 `CompanyId` 的请求路径 |
| 5 | Candidate 预检使用 B 上下文，确认后才 ActiveCompany=B，A 会话保留 | PASS | §5.4 “Preflight 例外”；CF0-T6；`04` §18 R-3/U-5；§5.14 |
| 6 | Auth 全流程无 Happy Path 跳跃 | PASS | Preflight(§5.5)、OTP(§5.7)、密码(§5.8)、强制设密(AUTH-05)、Recovery、Logout(§5.9)、Session restore(§5.10)、401 Return Intent(§5.12)、429(§5.11.1)、Registration incomplete(§5.11 的 403 分支 + 路由第 7 行) |
| 7 | retryAfter 60/1/3600；倒计时结束仅启用 CTA | PASS | §5.11.1；RA-1…RA-11（含 RA-11 “无自动网络请求”）；上限依据 BR-7 |
| 8 | Recovery 仅 `POST /api/h5/auth/recovery`（`send`/`reset`） | PASS | BR-12、AUTH-06、附录 A、X-8；`04` 两页路由 `/auth/recover` → `/auth/recover/code`，无 `/reset` 路由 |
| 9 | 建立在 G0 的 Riverpod/Dio/CookieJar/SecureStorage/Router/L10n/SafeLogger 之上，不推翻基础设施 | PASS | `21` §2.3 Foundation Change Policy：禁止改 Cookie 白名单语义/Origin/重试/Redaction；只“增量扩展”；仅替换 G0 本就是占位的组件；G0 的 90 个测试保持，依赖 `authGateStateProvider.mark*` 的测试要求“迁移并保留断言语义”；仅一处守卫规则（`mobile_scanner`）有明文调整。**经核对 `mobile/lib`：`core/session/` 已有 `active_company.dart`/`company_context.dart`，`core/network/interceptors/` 已存在，A′ 方案是增量扩展。** |
| 10 | Android runtime 债仍在 G1 Exit | PASS | X-18（L1 + L2′ 必须 PASS）、G1-RUNTIME-01、§9 |
| 11 | Scope 仅 Company/Auth/Session/Recovery/Guards/最小落地页 | PASS | §1；X-21（无 KYC/贷款/报价/还款/提现，无 `/api/h5/state`、`/api/kyc*`、`/api/loan/*` 调用，`/loan/quote` 守卫仍生效）；§5.13 的“不注册”清单 |
| 12 | Trae 任务卡完整 | PASS | 见下表 |
| 13 | 结论 | GO WITH CONDITIONS | P0=0、P1=0，仅 P2 |

**任务卡覆盖核对（`21` §7）**

| 要求 | 卡 |
|---|---|
| Company model/context | COMPANY-01 |
| Outbound company cookie | COMPANY-COOKIE-01/02/04 |
| Company selection / App Link / switch | COMPANY-02 / COMPANY-03 / COMPANY-04 |
| Preflight / OTP / Password login / Setup / Recovery | AUTH-01 / 03、04 / 02 / 05 / 06 |
| Logout / Session restore / 401 Return Intent | AUTH-07 + COOKIE-03 / AUTH-08 / AUTH-09 |
| Error mapping / Locale / Android manifest / Router | ERR-01 / I18N-01 / ANDROID-01 / ROUTER-01 |
| Tests / Android runtime / Report | TEST-01…04 + SUPPORT-01 / RUNTIME-01 / REPORT-01 |

## 3. G0 基础兼容性核查（只读）

- `RateLimitFailure` 现为 `retryAfter: Duration?`（`lib/core/error/failure.dart:157`），G0 测试目录无直接断言 `retryAfter`；契约为“增量新增”，兼容。**但见 P2-3。**
- `test/architecture_grep_test.dart:124` 的 `mobile_scanner` 禁令与 G1 新增依赖冲突；`21` §2.3 已把该条规则的调整写成显式契约（只允许出现在 `features/company/presentation/`），不是隐性推翻。
- 没有发现要求替换 Riverpod/Dio/CookieJar/SecureStorage/Router/L10n/SafeLogger 的条款。**无需架构变更流程。**

## 4. Findings

### P0
无。（契约层与架构层。CF-0 是**实现层** P0，必须靠 CF0-T1…T11 在 G1 Exit 前关闭，这是 Exit 条件，不是契约缺口。）

### P1
无。

### P2（非阻断；建议在授权前以勘误方式处理，不属于重新设计）

| ID | 问题 | 影响 | 建议勘误 |
|---|---|---|---|
| **P2-1** | `21` §6、§12（OD-G1-1/5/8）、§13.1–13.3 仍保留 v1 的“UX 未关闭/部分阻塞页面/Trae 先做非页面任务”表述，与 `04` §18、`25`、`26`、`21` Revision Log 的 CLOSED 状态矛盾 | Trae 可能误判页面任务仍被阻塞，或在两套状态间摇摆 | 把 §6 表与 OD 阻塞列改为 CLOSED（引用 `04` §18）；§13.1 改为当前 Gate 状态；§13.2-3 改为已满足；§13.3 删除“页面任务待 UX”限制 |
| **P2-2** | Trae 报告文件名冲突：`21` §7 REPORT-01 与 X-22 指定 `22-G1-implementation-report.md`，但 `22` 已被 `22-G1-contract-review.md` 占用，`23` 空缺，`24–27` 已用 | 编号混乱，容易被误认为同一系列；Codex 复验引用文件时歧义 | 改为 `28-G1-implementation-report.md`（或 Codex 指定的下一个序号）；同步 REPORT-01、X-22 |
| **P2-3** | `RateLimitFailure` 字段表述：G0 为 `Duration? retryAfter`，`21` 写“增加 `retryAfterSeconds: int`”，429 行写 `RateLimitFailure(retryAfterSeconds)`，未说明两字段关系 | 实现可能出现两个字段不一致，或破坏 G0 构造兼容 | 明确：保留 G0 构造兼容；G1 路径产生的 `RateLimitFailure` 必须携带经 §5.11.1 校验的 `retryAfterSeconds`（非空）；`retryAfter` 若保留则为同一值的 `Duration` 视图 |
| **P2-4** | 候选公司（B）预检时会为 B 创建并持久化 jar（visitor/browser/company），若用户取消，B 的残留状态如何处理未定义 | 无安全影响（无 session），但“最近公司”与存储残留语义不清 | 明确：未确认的候选公司其 jar 仅内存持有，确认激活时才持久化；或取消时清除该候选的持久化（二选一，写入 §5.14） |

> 另：`21` 仍显示 `Status: PROPOSED v2.1`。这是正确的——批准权在 Codex（§13.2-1）。

## 5. 产品与 API 复核摘要

- 无未决产品决策：OD-G1-1/5/8 的阻塞性已被 `04` §18 关闭（仅文本需同步，见 P2-1）；OD-G1-4（测试公司/账号）只影响 L2/L3 的生产步骤，不阻塞实现；OD-G1-2/3/6/7/9–12 均已有契约内推荐值。
- API：所有 G1 端点与载荷与 `02` 一致（附录 A）；无新增端点、无 `/api/mobile/*`、无 Bearer、无 SMS 回退；限流窗口（5/h、10/h、30/h）与 `retryAfter` 上限 3600 一致。
- 安全：深链永不产生认证态；敏感 POST 不重放；日志不含 OTP/密码/Cookie/challengeId；生产冒烟仅限无副作用端点（`19`/`21` §9）。

## 6. 授权条件（给项目方/Codex）

Trae 的实现契约**确定、可执行**：每张卡有 Goal/Contract/Files/Dependencies/Constraints/Tests/DoD，阻断测试（CF0-T1…T11、RA-1…RA-11）明确，Exit Criteria X-1…X-23 可核查。

授权须满足（缺一不可）：
1. Codex 把 `21` 由 PROPOSED 批准为 APPROVED（`21` §13.2-1；Claude 不自批）；
2. 三方 Gate Review 结论记录在案（§13.2-2）；
3. 勘误 P2-1…P2-4 已应用（机械性修订，预计无需重新评审设计；由 Claude 在收到指令后执行并在 Revision Log 记 v2.2，由 Codex 做一次快速核对）。

在以上完成前：**Trae 保持 HOLD，我不自行授权。**

## 7. Gate Status

```
G0 = PASS
G1 CONTRACT = GO WITH CONDITIONS（Claude 视角）
THREE-PARTY GATE = 待 Codex/API 方结论
TRAE = HOLD（本文不授权）
G2 = HOLD
G3 = BLOCKED BY CR-001
```

## 8. Final Summary

```
CLAUDE G1 GATE: GO WITH CONDITIONS

P0: none
P1: none
P2: P2-1 stale UX/blocking text in 21 §6/§12/§13
    P2-2 report filename collision (22-G1-implementation-report.md)
    P2-3 RateLimitFailure retryAfter vs retryAfterSeconds relation
    P2-4 candidate-company jar persistence on cancel

IMPLEMENTATION CONTRACT: READY

RECOMMENDATION: KEEP HOLD until Codex approves 21 and P2 errata are applied;
                then AUTHORIZE TRAE
```
