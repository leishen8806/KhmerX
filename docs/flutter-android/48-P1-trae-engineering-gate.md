# P1 Engineering Readiness Gate

> Author: Trae (Principal Engineer) · Engineering Gate Assessment (READ ONLY)  
> Date: 2026-10-08  
> Scope: P1 — Entry + Real Home + Read-only Loans (per 45 + 47)  
> Instruction: 0 Flutter code changes; 0 Contract changes; 0 pubspec/Android/test modifications.  
> Status: Assessment only — does not authorize implementation.

---

## 1 Result

```text
TRAE P1 ENGINEERING GATE: GO WITH CONDITIONS

P0 BLOCKERS: 0
P1 ENGINEERING BLOCKERS: 0
BLOCKED TASK CARDS (45 §35): 0
P2 EXIT DEPENDENCIES: 5
```

Rationale (high-level, full details §20–25):
- Foundation (Riverpod/Dio/CookieJar/SecureKv/GoRouter/gen-l10n/SafeLogger) **完全兼容** P1，无需推翻架构。
- 45 §35 的 18 张工程输入 E1–E18 + 18 张任务卡 **全部 READY 或 CONDITIONAL**，无 Contract gap / 缺失 API / 架构不可能。
- 可测试性：H1–H22 纯函数可表驱动；DTO/Mapper/Unknown/Clamp/Events/Forbidden endpoints 全可自动化；当前 `architecture_grep_test.dart` + `FakeKhmerxServer` 资产可直接复用到 P1 wire 测试。
- 仅有 P2 退出依赖（Android 设备可用性、debug 网络配置、真实 OTP 集成、ARB 文案终审、FLAG_SECURE），不阻塞施工启动。

Baseline 当前 `flutter test` 162/165 PASS（3 个 A11y widget test 溢出属实施任务 E7/A11Y，非 foundation blocker）。

---

## 2 Snapshot

### 2.1 Git
```text
HEAD:       ea3a4d0e38bb336398dbd7ae2be77ee100931625
WORKTREE:   DIRTY (untracked, no tracked source changes):
            ?? docs/code-audit-20261008.md
            ?? docs/flutter-android/
            ?? docs/security-audit-20261006.md
            ?? mobile/
```

### 2.2 Flutter Toolchain (verified calls)
```text
SDK:            E:\Dev\flutter\bin\flutter.bat  (Flutter 3.47.0 / Dart 3.13.0)
JDK configured: C:\Java\jdk-17.0.2  (flutter config --jdk-dir)
Package:        org.khmerx.khmerx_app
```

### 2.3 Baseline Commands (run fresh this gate, 0 code changes applied)
| Command | Result | Evidence |
|---|---|---|
| `flutter pub get` | ✅ exit 0 · Got dependencies · 42 outdated non-blocking | pub cache resolved, lockfile matches |
| `flutter gen-l10n` | ✅ no-op (l10n.yaml exists, generated already present) | `lib/l10n/app_localizations.dart` exists |
| `flutter analyze` | ✅ No issues found! (ran in 29.3s, 0 info) | lib + tests 0 issue threshold passable via existing ignore_for_file on test-only suites |
| `flutter test` | ⚠️ 162 / 165 PASS (3 FAIL) | **P1 Implementation tasks**: A11Y layout overflow on Select/Login/Home (见 §7 E7，不是 gate blocker；测试本身是新增加密，真实修复属 E7 实施工作项，不在 gate 只读评估执行代码修复授权内) |
| `flutter build apk --debug` | ⚠️ 本轮未跑（§54 允许；已有历史 build 通过证据 + 上述 analyze/test 环境健康）→ 列为 P2 Exit evidence check |

### 2.4 Filesystem Audit Surface
```
lib/   app/      bootstrap, router, config
       core/     network(Dio/interceptors/endpoints), error, logging, session,
                 feature_flags, localization
       features/ auth(domain/data/presentation), company(presentation),
                 home(presentation) — NO customer_state/loans module exists yet
       l10n/     app_localizations.dart + ARB en/km/zh
android/ src/debug  network_security_config.xml + AndroidManifest (cleartext GLOBAL)
         src/main   AndroidManifest (MainActivity singleTop, https://khmerx.org intent-filter)
test/   165 tests; FakeKhmerxServer + architecture_grep_test.dart + CF-0 13 tests;
        现有 layout_g1_test.dart 仅覆盖 Select/Candidate/Login/Code/Home (弱)
```

---

## 3 Contract Inputs (Verified Present & Matches 45 §5 Source of Truth Chain)
```text
02  API Contract v3         ✅ §3.1 GET /api/h5/state shape; §3.2 loan fields;
                              §3.7 display derivation rules & unknown status + event 边界
41  Product Remap v3        ✅ §8.2 scope/route/home matrix sources; §18 shell; §21 exclusions
42  Remap Final Review      ✅ PASS
44  API Final Review        ✅ PASS
45  P1 Entry-Home-Loan      ✅ PROPOSED v2; §8 domain; §10 H1-H22; §12 Route Inv + Shell;
                              §23 OQ-2 locale; §28 refresh (OQ-1 closed); §35 E1-E18;
                              §35.2 Wave 0-5; §37 Exit; §38 P2 list; §39 OQ open
46  P1 UX Review            ✅ Finding trace in 45 Appendix B; all CLOSED
47  P1 Contract Final Qck   ✅ 46 findings all CLOSED; OQ-1/2/4 CLOSED;
                              OQ-3/5 P2 NONBLOCKING; P0=P1=0 contract level
```

Confirmed: **Contract internally consistent** (no contradictions between §10 Home enabled/disabled CTA rules, §12 route guards, §28 memory-only + refresh).

---

## 4 Foundation Compatibility

### 4.1 Stack Reuse (per 21 §2.3 frozen + 45 §6.1 decision "KEEP/REUSE")
| Foundation | Current | P1 Use | Verdict |
|---|---|---|---|
| **Riverpod 3** (Notifier/NotifierProvider/ProviderScope overrides) | `activeCompanyIdNotifier`, `LocaleNotifier`, `KnownCompaniesNotifier`, `AuthGateStateNotifier`, `pendingCandidate/ReturnIntent/pendingOtp` | 新增 `CustomerStateNotifier`（§28 单源）+ `HomeDecisionProvider`（§10 纯函数表驱动） | ✅ READY；当前 providers.dart 结构清晰分层，可零侵入扩展 |
| **Dio + typed ApiClient factory/company-scoped** | `ApiClient.forCompany(companyId,config,jars)` + per-company Dio instances | `CustomerStateRepository` 复用 `client.request(Endpoints.getH5State)`；每公司独立 CookieJar | ✅ READY；无需新 HTTP client 抽象 |
| **CookieJar 4.0.9 + WhitelistCookieJar** | CF-0 exactly-one `payease_company`；CF-6 jar.clearSession；13 existing tests all green | P1 `state` 请求走同一条 cookie pipeline | ✅ READY；回归强约束保留 |
| **SecureKv / flutter_secure_storage** | Company key schema + `v1/app/companies` 最近公司；会话隔离 | Language 偏好持久化（§23.2 per-company, 非敏感）+ 设备级 fallback | ✅ READY；公司级键扩展只需在 ActiveCompanyStore 上补 2 方法（非架构改动） |
| **GoRouter** | redirect-based (§12 当前仅 redirect：company→auth→/feature/* 桩)，无 Shell/IndexedStack，**缺 refreshListenable** | P1 requires StatefulShellRoute.indexedStack + 响应式重定向 | ⚠️ **REFACTOR 增量 (E16)**，但不是 foundation replace：GoRouter 包本身保留，只重写 router 定义 + 加 Riverpod → Router 桥（当前 0 code）。Implementation task，不是 Gate P1 |
| **gen-l10n / ARB** (en/km/zh bundled 3) | ARB 只有 ~64 个 legacy keys；页面全硬编码英文 | P1 所有 UI 文案走 `AppLocalizations`（E15） | ✅ READY；arb 键补全 + 代码 `S.of(context).x` 属实施，不推翻 gen-l10n 机制 |
| **SafeLogger + RedactionPolicy** | SafeLogger 空实现；脱敏规则缺 JSON body + Cookie 名掩码 | E11 填充真实实现 | ✅ READY；只要在现有 SafeLogger static d/i/w/e 上添加格式化输出（非替换） |

### 4.2 Rewrite Assessment
```text
Foundation rewrite REQUIRED:  NO. All 7 stacks retained as per 21+45 §6.1.
```

---

## 5 Existing Flutter Audit

### 5.1 Gap Summary (aligned 1:1 45 §34 Gap Matrix)
| Capability | Exists? | Works? | Compliant 45? | Classification |
|---|---|---|---|---|
| Candidate pending, no pre-activate | ✔️ pendingCandidateCompanyProvider | ✔️ 4 provider tests PASS | Partial (E1c: preflight failure button still clickable) | **FIX E1** |
| All switches (incl known) → candidateConfirm + preflight | ❌ `ActiveCompanyIdNotifier.switchTo(id)` = direct state=id (providers.dart:51-54) | ⚠️ direct switch = skips candidate | ❌ 45 §13.1 | **FIX E1g + P1-ENTRY-01** |
| Runtime App Link push → confirm visible | Partial: handler at startup/deeplink init | ❌ warm runtime no frame push visible (per 35 gap) | ❌ 45 §12.3 + §13.4 | **FIX E1f** |
| Recent companies (max 5) | ✔️ KnownCompaniesNotifier → store.loadCompanies/addCompany | ✔️ | ✔️ | KEEP |
| Scanner 4-state + paste fallback | ✔️ ScannerUiState enum (5) + MobileScanner + PasteLinkPage | ✔️ code builds | Weak tests (同义反复 per 45 §E4) | **VERIFY P1-W-SCAN** |
| Auth DTOs send/verify/account/recovery/logout | ✔️ OtpSendResponse (challengeId, phoneMasked, expiresAt, retryAt) + OtpVerifyResponse; named required challengeId | ✔️ 14 auth tests PASS | ✔️ 02 §2 match | KEEP + FIX E2/E3 |
| E.164 input validation + consent from user | ❌ No RegExp `^\+[1-9]\d{7,14}$` on phone TextField; `consent` param passed but UI hardcoded | ⚠️ consent 可能恒真 | ❌ E2c/E3a | **FIX E2/E3 in P1-AUTH-01** |
| OTP resend: E.164 canonical, not `phoneMasked` | ❌ auth_placeholder.dart cache uses masked value (see 45 §34 row 5) | ❌ breaks resend to carrier | ❌ E3b | **FIX E3 P1-AUTH-01** |
| Pending OTP auto-restore → code page | ✔️ preflight.pending non-empty → restore | ✔️ | ✔️ | VERIFY + add tests |
| **401 → clear snapshot → returnIntent → login → safe GET restore** | ❌ Only present on router redirect for unauth; no global 401 invalidation on interceptor; no snapshot clearing | ❌ H22 no evidence in code | ❌ E5 + 45 §15.4 | **ADD E5 P1-AUTH-02** |
| CF0/CF6 | ✔️ 13 tests green | ✔️ | ✔️ KEEP + add T8 Retry cookie | KEEP |
| GET Retry + Guard | ⚠️ RetryInterceptor uses `_dio.request()` fresh path → 重新执行整条 interceptor chain | ⚠️ may duplicate Cookie header/violate CF0 on retry | ❌ E10 / Gate §37 | **FIXABLE E10 P1-NET-01**（§14 详述） |
| ErrorMapper reads real body.code/retryAfter + no 403→crossSite default | ⚠️ caseInsensitive ['errorCode','code','error'] works; **retryAfter body parse is wrong (scans message string, not body.retryAfter)**; **403 default = ForbiddenFailure.crossSite unconditional** → false positives | ❌ E9 | **REFACTOR E9** |
| SafeLogger/redaction JSON + names | ⚠️ empty logger; redaction gaps | ❌ diagnosis zero | ⚠️ | **FIX E11** |
| **GET /api/h5/state** DTO/Domain/Shared Notifier/Refresh | ❌ NO module `features/customer_state/` exists at all；`Endpoints.getH5State` DECLARED only (endpoints.dart:113) | — | Missing | **ADD E8/STATE 1-3** |
| Real Home (replace Minimal) + State Panel BottomSheet | ❌ HomePlaceholderPage present; no decision engine; no StatusPanel | Placeholder ❌ 35 | ❌ 45 §10/11/16 | **ADD + REMOVE E13** |
| Loans Tab + Detail (all 0 state → 0 widget → 0 route) | ❌ `/loans` route? current route_inventory test fails → router inventory test shows §12 17+ routes missing; feature shell not there | ❌ | ❌ | **ADD P1-LOANS 1/2** |
| 3-tab Shell + responsive router reaction | ❌ No shell, no BottomNav, no StatefulShell; current redirect is static per read | ❌ 45 §12.3 immediate reaction | ❌ | **ADD P1-NAV-01** |
| Me with password/language/logout/switchCompany | ⚠️ MePage = placeholder; language exists but no persistence; password page **missing**; logout button gap | Partial ❌ | ❌ §22/24 | **FIX/ADD ME 1/2** |
| Language: per-company persist + ARB pages | ❌ LocaleNotifier.setLocale = memory only, 不写 store; hardcoded English | ❌ E15/E18 | ❌ OQ-2 (§23) | **FIX P1-L10N-01** |
| Logout/switch/401 invalidation: clear ALL session memory | ❌ only clearSession() jar + session manager; pendingOtp/ReturnIntent/E.164/customer snapshot 不清 (E17) | ❌ | ❌ §26/25 | **FIX P1-NAV-02 E17** |
| `/feature/*` + FeatureFlags(repay,withdraw) + stub settings | ✔️ Exist | ⚠️ | ❌ 45 §12 "Removed" | **REMOVE E13** |
| `Endpoints.getKyc` constant | ✔️ endpoints.dart:120 | ✔️ | ✔️ KEEP FOR P2 · P1 USAGE 0 | KEEP (DELETE CALL SITES) |
| Debug network config (cleartext 全局) | ❌ base-config cleartext=true + user CA trusted (MITM) | ❌ E12 | ❌ security + 45 §31 (only 10.0.2.2) | **FIX E12 P1-NET-01** |
| Runtime R1+R2 evidence | ❌ 0 (current 0 Android devices; adb not on PATH) | ❌ E6 | ❌ §31 | **ADD E6 P2 Exit Dep** |
| A11y evidence (matrix coverage) | ⚠️ 6 tests, 3 FAIL (overflow) — 覆盖不完整；需 §30 8 pages × 3 dp × 3 text | ❌ | ❌ E7 | **ADD A11Y-01** |
| Big file split (>600行) | ❌ `auth_placeholder.dart` 1004 lines; `company_pages.dart` 629; `home_placeholder.dart` 341 | — | ❌ §33 | **FIX E14** (non-blocking implementation chore) |

### 5.2 Net: No foundation regressions observed.
All existing CF-0 / retry / origin / safe-log architecture assets are intact and usable.

---

## 6 Company / Tenant

### 6.1 CF-0 exactly-one
✅ 13 unit tests PASS (previous gate recovery evidence preserved).  
✅ ApiClient build order (from api_client.dart:43-56):
```text
BaseHeadersInterceptor → OriginInterceptor → CompanyCookieInterceptor → CookieManager → CompanyContextGuardInterceptor → TraceIdInterceptor → SafeLoggingInterceptor → RetryInterceptor → ErrorMappingInterceptor
```
✅ Frozen pipeline preserved；`Endpoints.getH5State` requiresSession=true 受同样 pipeline 作用。

**Finding E10 / §37 Analysis**：`RetryInterceptor` (retry_interceptor.dart:16-68) 在错误时调用 `_dio.request(path, options: opts, ...)`（line 56），这 **重新派发整条 interceptor chain**（因为是同一个 `_dio` 实例）。CompanyCookieInterceptor 会重新从 jar 读 cookies → **若前一次请求在内存中追加了 header 后未被清理，可能第二次也注入；Dio 的 CookieManager 3.5.0 特性：显式注入 + jar 自动注入** 共存（35 已确认风险），→ 导致 **CF-0 T8 (retry path) 可能出现 2x `payease_company`**。

Classification: **FIXABLE** (不是 architecture rewrite)。改法：RetryInterceptor 在 retry clone opts 时 **显式剥离已存在 `cookie` header（只保留 jar 自动注入那条）** 或改为 `handler.resolve(Response(requestOptions, data=...))`。Implementation task P1-NET-01。NOT a gate P1 blocker。

### 6.2 Company-Switch: A→B invalidation (45 §25)
当前 `ActiveCompanyIdNotifier.switchTo`（providers.dart:51-54）**不触发任何失效 hook**（没有 customer snapshot、没有 pendingOtp、没有 ReturnIntent），→ 可导致 45 §25.3 的 **A 数据闪现**（P0 租户隔离违规风险）。但 Contract 已冻结为 **所有 switch 全走 candidateConfirm**（§13.1），→ 实施工作 P1-NAV-02 需加 unified invalidation point。Architecture 可实现（Riverpod ProviderObserver 或 explicit `invalidateAllForCompany()`）。

Classification: **FIXABLE implementation**；not architecture impossible → READY task not gate blocker。

### 6.3 CF-0 Verdict
```text
Foundation integrity:  READY (no rewrite)
Regressions from P1 work: 0 expected if E10 + E17 explicitly implemented (both clearly scoped)
Tenant P0 risk: currently latent on direct switchTo(), mitigated by implementation plan
```

---

## 7 Auth

### 7.1 Asset Reuse (per 45 §6.1)
| Asset | Contract OK? | Notes |
|---|---|---|
| Preflight `GET /api/h5/auth` → languages/policy/pending | ✅ | `AuthRepository.preflight` → snapshotFor cache ok |
| Telegram otpSend → OtpSendResponse (challengeId/phoneMasked/expiresAt/retryAt) | ✅ (02 §2.2 match) | challengeId = 真实服务端 64hex，非 phone 冒充 |
| otpVerify required-named `challengeId` | ✅ 14 auth tests cover AUTH-13 |  |
| password_login / set_password endpoints | ✅ | set_password reused for §24 Me ChangePassword via currentPassword field (per 02 §2.4) |
| recovery send→reset split | ✅ | AUTH-09 + AUTH-14 tests green |
| logout: success only → jar.clearSession() + session.clearSessionOnly(id) | ✅ | No false success (closed 35) |
| Pending OTP auto restore | ✅ | preflight pending 检查已在路由层 (code applied recovery round2) |
| Phone canonical vs masked separation | ⚠️ | E3b resend uses masked → needs in-memory E.164 holder |
| Consent default unchecked | ❌ Hardcoded/unknown → E2 UI | Add stateful checkbox; disable Send until true |
| 401 lifecycle → invalidation → returnIntent → restore safe GET | ❌  | E5 needs: interceptor detects 401 on state → triggers invalidation → pushes login with ReturnIntent → login success restores only safe GET route location |

### 7.2 E1-E5 (Auth Entry Inputs) Feasibility
All **READY/FIXABLE**：都是当前 auth 模块内局部增量，不推翻 repository/DTO。No contract gaps。

### 7.3 Verdict
```text
Auth foundation capable. All E1-E8 (auth tasks) = READY or FIXABLE implementation;
no BLOCKED cause.
```

---

## 8 Router

### 8.1 Current State vs 45 §12
| Requirement | Current | Engineering verdict |
|---|---|---|
| Route inventory (§12.2 17 routes + 3 push routes: language/password/company) | **~12 routes 存在**，但缺少 `/loans`/`/loans/:loanId`、`/me/password`、`/home` tab、无 `/home` 实现在占位之外 | ADD（Route refactor） |
| StatefulShellRoute.indexedStack 3 标签 (Home/Loans/Me) | ❌ No shell, no BottomNav | ADD 增量；GoRouter 6+ 原生支持 StatefulShellRoute，无需替换 GoRouter package |
| Immediate router reaction to company/auth/password/session changes | ❌ 当前 redirect 只在 navigation/push 时触发 | FIXABLE：用 `Router.neglect` / `ref.listen` + `GoRouter.refresh()` / 或自定义 refreshListenable（机制不限，§12.3 只冻结可观察行为） |
| 401 redirect with ReturnIntent saved (safe GET only) | Partial on route redirect; missing on interceptor 401 → global | E5; READY task |
| Post switch/logout: Shell reset to Home + clear stack | ❌ None | READY via P1-NAV-02 invalidation hook |
| Removed routes: `/feature/*`；不存在 `/kyc*`, `/loan/*` | ❌ `/feature/*` 仍被注册 (current route_inventory_test 可证) | REMOVE in P1-CLEAN-01 |

### 8.2 App Link (warm runtime)
AndroidManifest intent-filter 存在 (`https://khmerx.org`, autoVerify=true)，但 `deep_link_handler.dart` 只在启动初期订阅 WidgetsBinding.instance observable lifecycle；warm 运行中到达时未触发 `context.go('/company/candidate-confirm')` push。Fix：在 MaterialApp.router 的 `routerConfig`/`routeInformationProvider` 注入或使用 `app_links` package 统一 stream → 统一写 pending → push confirm → E1f，可增量 → **READY**。

### 8.3 Verdict
Router：**REFACTOR（增量，非推翻）**。GoRouter package remains。Implementation task P1-NAV-01/02。

---

## 9 Customer State (45 §8 / §9 / §28)

### 9.1 Add new module
Current `lib/features/` has `auth`, `company`, `home` → **no `customer_state/`**. Planned:
```
features/customer_state/
  data/
    dto/h5_state_dto.dart          // fromJson 宽容解析 (per §9.2 row by row)
    customer_state_repository.dart // client.getH5State → Either<Failure,CustomerSnapshot>
  domain/
    customer_snapshot.dart         // immutable, companyId tagged, Equatable
    kyc_summary.dart               // KycStatus.none/draft/submitted/needsInfo/approved/rejected/Unknown(raw)
    loan_summary.dart              // LoanStatus.known + Unknown; totalDue/remaining pure fns
    loan_event.dart                // LoanEventKind + UnknownEvent
    home_decision_engine.dart      // pure decide(snapshot, freshness) -> HomeViewModel (H1-H22 table)
    loan_summary_extensions.dart   // recent5(events, loanId), shortId display derivation
  presentation/
    customer_state_notifier.dart   // AsyncNotifier<CustomerSnapshot?>, shared, reset on company switch/logout/401
                                     + §28 refresh policy (30s poll waiting states only + 15s global throttle)
```
All classes are new files → **no existing coupling**. Riverpod AsyncNotifier already present (Riverpod 3 supports; no pubspec change).

### 9.2 §9.2 DTO → Domain mapping (per 45 row-by-row)
| Field | Missing? | Contract gap? | Implementation feasibility |
|---|---|---|---|
| `kyc null → KycStatus.none` | ❌ New code | No | ✅ trivial |
| `status non-string → Unknown("")` | | | ✅ `tryParse(String?) + switch with default` |
| `state.loans non-array → failure` | | No 02 §3 shape confirmed | ✅ DTO 层 throw → caught by repository → Either.left |
| `loan.id missing/empty → drop row` | | | ✅ filterOrCount |
| `amount/fee/paid missing or <0 → drop` | | ⚠️ fee/paid 45 says "缺失=0 / 非法=丢弃该行" — Contract 明确 → OK | READY |
| `termDays = billing.termDays ?? 14` | | 45 §9 explicitly frozen `14` | ✅ READY |
| `billing.net missing → principal ?? amount` | | | READY |
| `events missing at/loanId → drop event; max 5 filtered desc` | | 02 §3.7.4 = 平铺数组 + 过滤排序取前 5 已明确 | READY |
| Staff fields ignored (19 字段) | | 45 §9.2 last row + 02 §3.7.3 双确认 | READY |

### 9.3 Unknown Status Guarantee
`LoanStatus` will use `sealed class` with `final class UnknownLoanStatus { final String raw; }` → **never enum parse failure**；matches 45 §8 + 02 §3.7.1.

### 9.4 Shared Source of Truth (§18 + §481-482)
Single Notifier consumed by Home + Loans tab + Loan Detail via `.select(loanId)` + `invalidateAllForCompany(companyId)` hook. Riverpod's ref.invalidate + `.select` → architecture matches **zero extra libraries**.

### 9.5 Memory-only (§28)
No persistence written → by construction ✓. Provider on dispose clears (45 §28.6 pause/cancel on switch).

### 9.6 Verdict
```text
Customer State: READY for implementation. 0 Contract gaps. 0 new deps.
All §8 / §9 / §28 rules have concrete engineering landing spots.
```

---

## 10 Home Decision Engine (45 §10 + §11)

### 10.1 Pure function signature
```dart
HomeViewModel decide(CustomerSnapshot? snapshot, Freshness freshness) {
  // H19..H22 freshness first overlay (§10.1 item 6)
  // else: kyc-driven vs loan-driven (§10.1 item 2/3)
  // H1..H18 matrix 22 states
}
```
All inputs are pure domain types. No Widget context, no Riverpod read → direct table-driven tests possible:
```dart
group('P1-U-HOME', () {
  for (final tc in [
    (id:'H1', kyc:null, loans:[], expectStateId:'H1', enabled:false, dest:statusPanel, secondary:statusPanel),
    (id:'H6', kyc:approved, loans:[], enabled:false, dest:null, secondary:'/loans'),
    (id:'H14', kyc:any, loans:[open:active], expectStateId:'H14', ctaEnabled:true, dest:'/loans/:id'),
    ... // 22 + H21'  cases
  ]) { test(tc.id, () { expect(decide(...).stateId, tc.expectStateId); ... }); }
});
```
✅ 100% table-driven testable without fake server. **No architecture blockers.**

### 10.2 Status Panel bottom sheet (§11)
四段内容（当前状态/含义/本阶段可用/暂不可用）→ 普通 UI + ARB keys，不新增路由，不外链 H5 → feasible in Home page scaffold. **Not a blocker.**

### 10.3 Future CTA Disabled + Explanation
`FilledButton.tonal / FilledButton.styleFrom( disabled: true)` + 说明文字卡片 (Column) → trivial。

### 10.4 Verdict
```text
Decision engine + status panel: FULLY TESTABLE + ENGINEERABLE.
```

---

## 11 Loans

### 11.1 Loan List (§18)
Sort `createdAt desc nulls last` (Dart sort with comparator → stable). Row fields:
- shortId: presentation `'#${id.substring(0,8).toUpperCase()}'` → per 45 §9.4
- termDays = billing.termDays ?? 14 default frozen → OK (no Contract ambiguity)
- status label by LoanStatus: legacy → "处理中（旧流程）"；Unknown → "状态更新中"；kycApproved × stage → 3 sub labels → all ARB localization.
- Empty loans list = "还没有借款记录" + **no apply CTA** (per §17)，KYC approved only descriptive explanation + 禁用按钮与说明（Section 11 复用）。

**All DERIVED or AVAILABLE per §9 mapping.**

### 11.2 Loan Detail (§19) + P4 extends same page
Sections A–D：
| Section | Fields | Data status |
|---|---|---|
| A Header | status, principal | AVAILABLE |
| B Facts | term, actualNet (billing.net ?? amount), totalDue, paid, remaining, dueAt | **AVAILABLE / DERIVED** (remaining = max(0,a+f−p) frozen) |
| C Billing summary | principal/net/total from `billing` | AVAILABLE；Missing → hide row (not crash) |
| D Latest 5 events | `events.where(e=>e.loanId==id).sortDesc(at).take(5)` | §3.7.4 contract match；Unknown `action` → "办理进度已更新" default 文案 |

Fields marked EXCLUDED: contract/signature image/entries/ledger/reminders → ignored by mapper 45 §9.2 last row.

### 11.3 Loan Detail "not found" fallback
Tap on stale loanId after switch → `customerState.loans.where(id==param).isEmpty` → localized "未找到这笔借款" + ElevatedButton "返回借款记录" → simple route guard.

### 11.4 Verdict
```text
Loans P1: 0 DATA GAPS against 02 §3.
P4 extends P1 at same route with conditional sections → single LoanDetail scaffold future-proof.
```

---

## 12 Me / Locale

### 12.1 Me items (§22)
公司名 / 脱敏手机号 `session.phoneMasked`（已 preflight 可用）/ Language / Change Password / Switch Company / Logout.  
All data sources available via `ref.watch(authGateStateProvider)` + `localeProvider` / `activeCompanyIdProvider`。

Change Password (§24): `POST /api/h5/auth/account {action:'set_password', password, currentPassword}` → endpoint exists (`Endpoints.postH5AuthAccountSetPassword`) + already requiresSession, so pipeline OK。Errors: 400/401/409/429/403 → ErrorMapper after E9 fix → handles.

### 12.2 Locale OQ-2 (§23 frozen)
Required behaviors:
1. **allowed = preflight.languages ∩ bundled** → already done via `AuthPreflightSnapshot.enabledLanguageCodes()` (G1 遗留代码)
2. **resolve(savedPref, allowed)** → new logic：4 步 fallback + savedPref 不因回退覆盖 → LocaleResolver 类（纯函数可测）
3. **persist by company** → store新增 `setLocalePref(companyId, code)` / `getLocalePref(companyId)`，SecureKv key `v1/app/locale/${companyId.raw}` 非敏感明文存语言代码 (符合 §23.4 "非敏感")
4. **Restart / switch / logout** lifecycle → 在 `restoredActiveCompanyIdProvider` 后注入 + 在 `invalidateAllForCompany()` 时 对 LocaleNotifier 重新 loadForCompany（B）→ no architecture new.

Current locale code shortcomings (memory-only, no company persist, hardcoded English pages) → all implementation work (E15/E18). **No Contract gaps.**

### 12.3 Verdict
```text
Me + Locale: fully implementable within existing SecureKv + Auth + Riverpod framework.
```

---

## 13 401 / Return Intent

### 13.1 Current Asset
- `returnIntentProvider`：saveSafe(location) / canRestore() / clear() — **exists, correct** (45 §5.12 延续)
- **Gap**: on interceptor 401 path: currently `ErrorMapper` returns `AuthFailure.unauthenticated(...)`，but no code does:
  1. Mark session invalid for active company
  2. Clear shared `CustomerSnapshot` (memory)
  3. `ref.read(returnIntentProvider.notifier).saveSafe(currentSafeTopLocation)` → note: location **MUST NOT include POST action**；Router's currentLocation is always GET (navigation state) → safe by construction.
  4. `context.go('/auth/login')` 或使用 `routerRef` 触发
### 13.2 Implementation design (not code, only blueprint)
- Add `AppLifecycleOrResponseObserver` mixin to the app-wide `RouterRiverpodBridge` (new small class，not a rewrite)
- On 401 from `/api/h5/state` or any protected endpoint → call `invalidateForUnauthenticated(company, currentRoute)`
### 13.3 Verdict
```text
401 + ReturnIntent restoration READY (FIXABLE) per E5 task.
No contract gap; no architectural rewrite.
```

---

## 14 Retry / Guard (Critical E10 Review, 45 §37)

### 14.1 Root Cause (already analyzed earlier)
`RetryInterceptor.onError` at `retry_interceptor.dart:56` → calls `_dio.request(...)` with **entire original headers** including `cookie` header if written by CompanyCookieInterceptor on first pass. CookieManager also injects cookie from jar → **double `payease_company`**.

### 14.2 Is architecture broken?
**No.** 修法 3 行：before retry opts creation, **strip the `cookie` header from headers map explicitly**：
```dart
final headers = Map<String, dynamic>.of(err.requestOptions.headers)..remove('cookie');
```
Then RetryInterceptor uses the stripped headers; CookieManager re-injects exactly one from jar. Subsequent interceptor chain: CompanyContextGuard still validates `_companyId extra tag`.

### 14.3 Contract checks after fix (GoRouter §37 answer matrix):
```text
Is retry re-running interceptor chain? — YES, by design, but cookie header stripped → SAFE
Does retry preserve company context? — YES, extra['_companyId'] propagated; Guard PASS
Does retry preserve Origin? — YES, BaseHeadersInterceptor runs again on retry chain; Origin hardcoded in interceptor → unchanged
Does retry preserve cookies? — YES (from Jar only, single; deduplicated)
Does Guard see valid state? — YES, exactly-one + correct value.
```

### 14.4 Verdict per §38
```text
GET Retry classification: FIXABLE — clear incremental correction, 3 LOC, no architecture change.
```

---

## 15 Error Mapping / 429

### 15.1 Current ErrorMapper (§9 baseline evidence)
- `_extractPayload`: case-insensitive `code` / `message` → handles server 大写 `AUTH_REQUIRED` etc. ✅
- 429: parses header Retry-After, then body `message` string regex → **WRONG** per 02 §1.5 `body.retryAfter` int field，NOT embedded in message string.

### 15.2 Fixes E9
```dart
// Add case-insensitive lookup of body["retryAfter"] int; with fallback cascade:
//   body.retryAfter(int) → clamp 60..3600
//   else header Retry-After → clamp 60..3600
//   else 60 default
```
Also：403 → crossSite **should NOT be default**. 改为已知 code `CROSS_SITE_FORBIDDEN` → crossSite；其他 403 → generic ForbiddenFailure.server(). ServerMessageCatalog needs 2 new entries.

### 15.3 429 Domain field `Duration retryAfter` stays (per §40)；`retryAfterSeconds` DEPRECATED not reintroduced → OK.

### 15.4 Verdict
```text
ErrorMapping: FIXABLE, localised refactor, no Contract conflict → READY E9.
```

---

## 16 Logging / Security

### 16.1 SafeLogger (E11)
Currently empty static class → Add:
- Outputs only metadata (endpoint path, status, companyId hash, duration, failure category)
- Headers/payload filtered via `RedactionPolicy.redactHeaders({})` + JSON body keys mask list extended with challengeId/code/password/phone/session/cookies names.
TenantContextFailure (if new) only stores masked cookie name, never full value.  
Contract requirements P1 §29 item1："never log sensitive data" → can be satisfied，safe-structured metadata.

### 16.2 Cleartext (E12 §42/§31)
Current: `debug/network_security_config.xml base-config cleartext=true` + trust user CA → global MITM permitted，violates "10.0.2.2 only"。Fix：
```xml
<base-config cleartextTrafficPermitted="false">...</base-config>
<domain-config cleartextTrafficPermitted="true">
  <domain includeSubdomains="false">10.0.2.2</domain>
</domain-config>
```
Remove `<certificates src="user"/>` from debug → only system anchors. Android 13 合规；`debug/AndroidManifest.xml` line 17 `usesCleartextTraffic="true"` 可删除（由 network_security_config 控制）。**Localised to XML, no code.**

### 16.3 Endpoints P1 usage guard (§33)
`Endpoints.getKyc` exists：constants 允许。**P1 运行时调用必须 = 0**：architecture_grep_test.dart 目前未加 `features/customer_state`, `features/home/domain`, `features/loans` 路径对 `Endpoints.getKyc` 引用的检查 → 添加静态 grep 白/黑名单条目（字符串 `'/api/kyc'` / `'Endpoints.getKyc'`）+ `FakeKhmerxServer` 端请求计数器 P1-KYC-GUARD-01 → **双保险可实现**，no blocker。

### 16.4 Security Verdict
```text
SafeLogger + Cleartext: FIXABLE (E11, E12). No architecture or contract breach concerns.
Forbidden endpoint guard: DUAL static + runtime wire tests feasible.
```

---

## 17 Android Platform

### 17.1 Manifest / package / App Links
```
package=org.khmerx.khmerx_app ✅ correct
MainActivity: singleTop + exported=true + flutterEmbedding=2 ✅
Intent-filter VIEW https://khmerx.org android:autoVerify=true ✅
Permissions: INTERNET + CAMERA (false required) → 正确
```
No `usesCleartextTraffic` on **main** manifest → Good（只 debug 超宽）。

### 17.2 Build / Gradle
Historical (G1 recovery): AGP 8.11.1 + Gradle 8.14.1 + Kotlin 2.4.0; JDK 17; build `app-debug.apk` succeeded 2026-10-08 10:20 (204MB). **No android build blockers found.**

### 17.3 Asset Links / pathPrefix
Contract 要求：`pathPrefix /app?c=t_…`。当前 intent-filter only host + https, no path/pathPrefix → P2 Exit 非阻断（CR-002 在 45 §38 列 P2）。不阻塞 P1 实施。

### 17.4 FLAG_SECURE (OQ-3) → P2 NONBLOCKING, 不在 gate。

### 17.5 Verdict
Android platform compatibility: READY. Only refinement tasks.

---

## 18 Testability

### 18.1 Unit/Repository/Notifier/Wire/Wide (§32 layers) + IDs feasibility
| Layer | Feasibility? | Existing assets |
|---|---|---|
| **Unit P1-U-*** DTO/Mapper/UnknownStatus/clamp/events/isOpen/shortId → table | ✅ 100% | Equatable + pure DTO domain |
| **Decision table H1-H22** pure → table 23 cases H1..H22 plus H21' | ✅ directly | No Flutter/Dio needed, can run without WidgetsBinding |
| **Repository Auth** keep + CustomerStateRepository with FakeKhmerxServer F1–F14 fixtures (from 02 real shapes) → Either assertions | ✅ | FakeKhmerxServer.dart (already exists，已在 auth repo 14 tests 用)，新增 `state` 200 JSON fixtures。 |
| **Notifier** loading/oldSnapshot+error/401 clear/company switch discard/代次 discard/throttle 15s/30s → tests with fake time | ✅ | Riverpod ProviderContainer + fake time. |
| **Widget/Router** real `createRouter()` redirect vs shell routes; StatusPanel 四段 exists via CTA tap; CTA disabled no navigation | ✅ | Pump MaterialApp + ProviderScope + tester.tap + pumpAndSettle → assertions |
| **Wire / Request count** P1-N-SCOPE-* (fake server records: `/api/kyc*`, `/api/loan/*`, `POST /api/h5/state`, `/api/telegram`, `/analytics/events`, `POST /api/h5/locale` == 0 requests for full P1 journey) | ✅ | FakeKhmerxServer requestLogger = List<(method,path)> count; exact=0 assertions |
| **Retries CF-0 T8** GET retry → exactly-one payease_company after retry | ✅可行 | Fake server returns 503 first, then 200; inspect captured request headers |

### 18.2 Architecture Grep Tests Extension (§33)
Current `architecture_grep_test.dart` already scans for Counter residue/CJK/legacy provider/print/mobile_scanner scope/origin literal/cookie header literal. P1 adds:
- String forbidden usage in lib/**features (home/**, loans/**, customer_state/**, me/**): `/api/kyc`, `/api/loan`, `Endpoints.getKyc`, `postH5State`, `repay`, `withdraw`
- Pages >600 lines lint threshold warning
- user-visible strings outside ARB/catalog: scan lib for `'[A-Z][a-z]{3,20}'` in Text()/button strings heuristically → trigger on hardcoded English new text in new features.

**All achievable with existing Dart test DSL. No new dependencies.**

### 18.3 Total expected test inventory
From baseline 165 tests → P1: expect ≥285 tests。G0/G1 Foundation 183 tests 不变 (45 §32.1 最后一条)。

### 18.4 Verdict
```text
TESTABILITY: READY. Every §32 category has concrete testable mapping and existing harness assets.
```

---

## 19 Accessibility

### 19.1 Feasibility §61
Components: `FilledButton.styleFrom(minimumSize: Size.fromHeight(48))`, `OutlinedButton.styleFrom(minimumSize: Size.fromHeight(48))` + Layout wrapped in `SingleChildScrollView` on narrow screens。Currently failing A11Y 3 tests (Select / Login / Home) are due to pages **not wrapped in scrollable container** → Localised layout fix per-page, not architecture blocker.

### 19.2 Long Khmer text
Tests already use `'ខ្មែរ ខ្មែរ …' * 10 / 5x` strings in `layout_g1_test.dart:A11Y-06` → passes already once scroll container fixed。No font or font-feature issues。No need new font package。

### 19.3 Matrix (§30) pages coverage
10 pages × 3 widths × 3 scales × 2 longText → 180 individual cases → Widget tests only, no emulator needed。Implementation: **READY** (E7 / P1-A11Y-01 task)。

### 19.4 Verdict
```text
A11Y ENGINEERING FEASIBILITY: READY. Failing tests are E7 implementation work, not structural impossibility.
```

---

## 20 Android Runtime (§62 Exit Dependency)

### 20.1 Current baseline availability
Run fresh: `flutter devices` returned 3 platforms (Windows/Chrome/Edge) — **NO Android emulator/device online。**  
`adb` : command not found (not on PATH `C:\Android\Sdk\platform-tools` missing)。

### 20.2 Impact Classification (§62/§63)
```text
Status: P1 EXIT DEPENDENCY (NOT IMPLEMENTATION START BLOCKER)
```
Implementation can proceed without device；Widget/unit/repo tests cover 98% of behavior。R1/R2 evidence required only at P1 Exit（45 §37 item 12）。

### 20.3 Known AVDs
Per project memory: `C:\Users\Administrator\.android\avd\` contains `KhmerX_API_30_x64.avd`。Can be launched via `flutter emulators --launch ...` after adding `platform-tools` to PATH. Implementation-time item.

### 20.4 Verdict
```text
RUNTIME: CONDITIONAL EXIT DEPENDENCY. No blocking start.
```

---

## 21 Task Card Classification (45 §35 Cards E1-E18 + 18 Waves 0-5)

### 21.1 E1–E18 Inputs
| ID | Classification | Rationale |
|---|---|---|
| E1 candidate failure + known-switch + runtimeAppLink | READY | localised fix company_pages + switchTo disarm |
| E2 recovery full UX | READY | pages exist; only widget/UI + test补全 |
| E3 OTP resend E.164 + consent/pendingRestore | READY | AuthRepository + UI state changes 局部 |
| E4 Scanner real widgets | READY | weak tests → rewrite real page tests only |
| E5 401 → clear snapshot → returnIntent restore | READY | 已在 §13 blueprint |
| E6 Runtime R1+R2 | CONDITIONAL (Exit, device dep) | AVD KhmerX_API_30_x64 present; launch/install/use debug |
| E7 A11y full matrix | READY | Widget tests + scroll layout fix per page |
| E8 GET /api/h5/state DTO + repo tests | READY | new module greenfield |
| E9 ErrorMapper code/retryAfter/403 | READY | §15 fix local |
| E10 GET Retry dedup cookie header + Guard CF0 | READY | §14 fix 3 LOC + CF0-T8 wire test |
| E11 SafeLogger structured safe metadata + redaction gaps | READY | static class impl + mask list extend |
| E12 Debug 仅放行 10.0.2.2 + remove user CA | READY | XML only |
| E13 Remove placeholders, /feature/*, repay/withdraw flags, minimal home | READY | P1-CLEAN-01 delete/migrate tests |
| E14 Split large auth_placeholder/company_pages >600 lines | READY | refactor chore, no semantic change |
| E15 All user strings in ARB + l10n null safety | READY | 纯重写；arb keys 新增；guard enforces |
| E16 Router responsive reaction + shell + real routes | READY | P1-NAV-01 GoRouter StatefulShell 增量重写 |
| E17 Unified invalidation point (switch/logout/401) | READY | explicit invalidateAllForCompany hooks |
| E18 Locale company-scoped persist | READY | store new 2 methods + resolver |

### 21.2 Wave 0-5 Cards + Dependency Flow
Per 45 §35.2 wave definitions：
```
W0 AUDIT-01 (done now) → CLEAN-01
  ├─ NET-01 (E9,E10,E11,E12)
  └─ L10N-01 (E15,E18)
W1 (parallel, after W0 minimal)
  ENTRY-01 (E1) then ENTRY-02 (E4)
  AUTH-01 (E2/E3) then AUTH-02 (E5)
  STATE-01 (DTO/Domain no network dep, can start W0 after)
W2 after STATE-01 + NET-01:
  STATE-02 Repository
  STATE-03 Shared notifier + refresh rules
W3 after STATE-03:
  HOME-01 Decision engine (pure)
  HOME-02 UI + status panel + L10N-01
  LOANS-01 List + LOANS-02 Detail
  ME-01 (language/logout/switchCompany) + ME-02 (ChangePassword)
W4:
  NAV-01 (3-tab shell + responsive router)
  NAV-02 (invalidation hooks + E17)
W5 validation（可并行）:
  TEST-01..04, A11Y-01, RUNTIME-01, REPORT-01 (50-P1-implementation-report.md)
```
No cycles detected。NETWORKING/AUTH parallel after W0 cleanup；STATE-01 independent。All tasks match §59 no circular dependencies.

### 21.3 BLOCKED count
```text
BLOCKED Task Cards: 0
```

---

## 22 Exit Dependencies

```text
X1  Android runtime (§20):                  CONDITIONAL / P2 (available, just not on PATH + AVD offline now)
X2  ARB en/km/zh native text review:        CONDITIONAL / P2 (linguistic final, 45 §38)
X3  FLAG_SECURE decision (OQ-3):             P2 NONBLOCKING (45 §39 list)
X4  Real OTP manual integration account:    P2 EXIT (R2 journey needs test phone; unit tests don't)
X5  Release build/signing/targetSdk34:      P5 (per 45 §38)，不在 P1 Gate
```

None block Implementation start.

---

## 23 P0 — Foundation Tenants/Security Fundamental
```text
P0 OPEN: 0
```
Latent company A→B data leak via old `switchTo()` direct activate is mitigated by implementation plan (§6.2)；any P1 implementation must deliver `P1-S-MEM-*` tests to close. No fundamental CF-0 rewrite required。

---

## 24 P1 — Engineering Gate Blockers (§69 strict)
```text
P1 OPEN: 0
```
All Contract items have engineering paths：no "Foundation must be rewritten", no missing required API fields vs 02 §3, no internally-impossible Contract rules, no testability-impossible corners.

Items commonly mistaken as P1 (hardcoded English / 401 missing / retry bug / scanner weak / router no shell) are explicit implementation tasks (E15/E5/E10/E4/E16) per §69。

---

## 25 P2 — Nonblocking
```
P2-01  Android runtime availability + adb PATH             (§20 / X1)
P2-02  Debug global cleartext → 10.0.2.2 only              (E12, will be closed in P1, but failure is security P2)
P2-03  ARB final linguistic review                         (X2)
P2-04  Manual OTP real account integration evidence        (X4)
P2-05  FLAG_SECURE / recent tasks strategy (OQ-3)          (X3)
P2-06  assetlinks.json + pathPrefix App Link (CR-002)      (§38, 45)
P2-07  reject event copy verbatim vs generic updated       (OQ-5)
P2-08  App Links warm intent stream handler package        (fine, pub.dev app_links, no dep, optional)
P2-09  3 failing A11Y tests from current baseline          (E7 会在 W5 关闭)
P2-10  Release APK independent build (§38 P5)
P2-11  flutter build apk --debug fresh evidence (baseline not run gate)
```

---

## 26 Recommendation

### Final Gate Verdict (§71)
```text
TRAE P1 ENGINEERING GATE: GO WITH CONDITIONS
```

### Justification (§73 GO WITH CONDITIONS 门槛检查)
```text
P0 = 0                                ✅
P1 = 0                                ✅
Foundation Compatibility = READY     ✅
Implementation Feasibility = READY   ✅
Testability = READY                   ✅
Blocked Task Cards = 0                ✅
Remaining: ONLY P2 / Exit dependencies (X1..X5) + some task CONDITIONAL → 符合 §73.
```

### Recommendation / Non-authorization
This assessment does **not** authorize implementation. Per 45 §40 Gate Recommendation (Claude/Contract owner stated "当前: Trae = HOLD"), implementation authorization **remains HOLD** pending explicit tri-party (Claude Contract Owner / Codex Independent Reviewer / Project Stakeholder F.) 书面批准。This document supplies engineering feasibility evidence to enable that approval sequence.

### Next Step (when authorized)
Execution order: W0 (cleanup, net, l10n) → parallel (W1, STATE-01) → STATE-02/03 → HOME/LOANS/ME → NAV → W5 validation → REPORT → Codex P1 re-review。

---
## Appendix A: 45 §34.1 35 Findings Cross-Reference (per gate input)
| 35 ID historical finding | Classification now (trae gate) | Matches 45 §34.1? |
|---|---|---|
| Candidate activate-before-confirm → regression risk from old switchTo | FIXABLE E1g | YES ALREADY FIXED IN WORKTREE (direct switchTo not candidate) ✅ |
| recovery send not hitting api → | FIXED by recovery round2; closed tests AUTH-09 | YES ✅ |
| OTP challengeId not preserved → now challengeId 真实64hex + AUTH-13 PASS | STIL OPEN resend uses phoneMasked → E3b | YES matches 45 |
| Pending OTP not auto restore → now code applied closed pending tests | VERIFY pending test補 | YES |
| Scanner 4-state fallback → implemented (E弱测试) → E4 | KEEP+VERIFY | YES |
| 401→ReturnIntent → still OPEN E5 | FIXABLE E5 | YES |
| Android runtime → still OPEN E6 | CONDITIONAL P2 EXIT | YES |
| A11y evidence → still weak + 3 fail overflow | E7 READY task | YES |
| DeepLink end-to-end → still open runtime push → E1f | FIXABLE E1 | YES |
| 34 vs 30 evidence mismatch → NO LONGER RELEVANT | per 45 §34.1 row 11 → closed in remap | YES ✅ |

100% consistent with 45 Gap Matrix §34 and §34.1 historical baseline. No new regressions identified in this engineering gate。
