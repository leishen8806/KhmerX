# G1 — Trae Engineering Readiness Gate

> Document: 29-G1-trae-engineering-gate.md  
> Date: 2026-10-07  
> Reviewer: Trae (Engineering Executor / Feasibility Reviewer)  
> Scope: ONLY Feasibility Assessment. NO CODE CHANGES. No implementation start. No pubspec edits. No Android Manifest edits.

---

## 0. 评估基线（事实，不推断）

### 权威 Contract 文档（只读）
| Doc | 内容 | 结论 |
|-----|------|------|
| [02-api-contract.md](file:///E:/KhmerX/KhmerX/docs/flutter-android/02-api-contract.md) | G1 Auth 6 条端点 + Cookie 4 条 + Origin + 错误 JSON | 与 G1 需求一致 |
| [05-flutter-technical-architecture.md](file:///E:/KhmerX/KhmerX/docs/flutter-android/05-flutter-technical-architecture.md) | Foundation 基线（Riverpod/Dio/CookieJar/Router/L10n/SafeLogger） | G1 可增量承载 |
| [21-G1-company-auth-contract.md v2.1](file:///E:/KhmerX/KhmerX/docs/flutter-android/21-G1-company-auth-contract.md) | 冻结 Contract：CF-0 P0 Tenant、CF-6、retryAfter 60/1/3600、CF-8、CF-10 | CONTRACT CLOSED / IMPL OPEN（26号最终） |
| [24-G1-gate-packet.md](file:///E:/KhmerX/KhmerX/docs/flutter-android/24-G1-gate-packet.md) | Gate Packet + Task Cards + Runtime Requirements | 与 21 一致 |
| [26-G1-final-contract-check.md](file:///E:/KhmerX/KhmerX/docs/flutter-android/26-G1-final-contract-check.md) | CF-7 数值冻结 60/1/3600，Contract P0=0，P1=0 | CONTRACT PASS |
| [27-G1-claude-gate-review.md](file:///E:/KhmerX/KhmerX/docs/flutter-android/27-G1-claude-gate-review.md) | Architecture Owner 评审：CONDITIONAL PASS；P2-1..P2-4 4 项勘误；不授权 | P2 非阻断 |
| 用户最前正式消息 | G0 PASS、G1 Contract READY、CODEX G1 UX GATE=GO、UX CONTRACT READY、ACCEPTANCE CONTRACT READY | G1 Contract 全线 READY |

### 真实代码快照（mobile/lib/ + mobile/test/ + pubspec.yaml/lock，0 修改）
| Foundation | 位置（真实） | 状态 |
|---|---|---|
| Flutter SDK | `E:\Dev\flutter` 3.47.0 / Dart 3.13.0（JDK 17 pinned via flutter config） | OK |
| Riverpod 3.3.2 | [app/bootstrap/providers.dart](file:///E:/KhmerX/KhmerX/mobile/lib/app/bootstrap/providers.dart) — activeCompanyIdProvider / authGateStateProvider（Notifier pattern） | OK |
| Dio 5.11.1 + dio_cookie_manager 3.5.0 | [core/network/api_client.dart L37-45](file:///E:/KhmerX/KhmerX/mobile/lib/core/network/api_client.dart#L37-L45) — Interceptor pipeline BaseHeaders → Origin → CookieManager → TraceId → SafeLogging → Retry → ErrorMapping | OK（可插入 2 个 interceptor，位置 §5.4 冻结） |
| cookie_jar 4.0.9 + WhitelistCookieJar 4-Cookie 白名单 | [core/session/whitelist_cookie_jar.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/session/whitelist_cookie_jar.dart) L6-11 whitelistNames + payease_company 值匹配 owner | OK（CF-0 的基础） |
| SecureKv + KeySchema + CompanyCookieStore + PersistCookieJar 持久化 | [core/session/company_cookie_store.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/session/company_cookie_store.dart) — jarFor / clearSessionFor / removeCompany；[core/storage/secure_kv.dart] | OK（CF-6 的加载/清除基础，见 §9 CF-6 评估） |
| GoRouter 17.0.0 | [app/router/router.dart L15-122](file:///E:/KhmerX/KhmerX/mobile/lib/app/router/router.dart#L15-L122) — 现有 redirect（company/guard/auth/incomplete/feature disabled）；RouterGate Notifier | OK（refreshListenable、Return Intent、Candidate confirm 可增量加） |
| gen-l10n 69 keys 三语（en/km/zh） | `lib/l10n/app_localizations.dart`；[locale_controller.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/localization/locale_controller.dart)；MaterialApp 未接 locale（CF-8） | OK（实现层接入 locale: 1-2 行，不推翻） |
| SafeLogger + RedactionPolicy（password/confirmpassword/otp/code/challenge/challengeid/phone/cookie/authorization/token/secret） | [core/logging/redaction_policy.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/logging/redaction_policy.dart)；[core/network/interceptors/safe_logging_interceptor.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/network/interceptors/safe_logging_interceptor.dart) | OK（G1 OTP/密码日志防护已覆盖字段名） |
| AppFailure（RateLimitFailure retryAfter:Duration?、AuthFailure/Forbidden/Conflict/ServiceUnavailable/Offline） | [core/error/failure.dart L156-173](file:///E:/KhmerX/KhmerX/mobile/lib/core/error/failure.dart#L156-L173) — RateLimitFailure 已有 `final Duration? retryAfter`（**正好是 26 号 §17 要求的同一语义字段**） | OK（429 clamp 后构造 `Duration(seconds:clamped)`，无需第二字段） |
| AndroidManifest.xml | [android/app/src/main/AndroidManifest.xml](file:///E:/KhmerX/KhmerX/mobile/android/app/src/main/AndroidManifest.xml) — App Link intent-filter 存在；**INTERNET 权限、network security config、CAMERA 尚未补（CF-10 实现项）** | 不推翻现有（增量加，不破坏 release） |
| 90 G0 Tests（Contract: Retry/Cookie/Redaction/Endpoint/Origin/L10n/App Start/Cookie Isolation CI 1-5） | mobile/test/ — 全绿（R4 Final Quad：+90） | 保持通过（21 §2.3：迁移不删断言） |
| FeatureFlags withdraw=false / repay=false | [core/feature_flags/feature_flags.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/feature_flags/feature_flags.dart) | OK（G1 无业务 Loan/Quote/Withdraw/Repay） |
| Report 编号 29 空闲 | Glob `docs/flutter-android/29*.md` → No file found | OK（不冲突） |
| Flutter devices | Windows/Chrome/Edge **3 台非 Android** | G1 EXIT DEPENDENCY（不是 start blocker，§24） |

---

## 1. CF-0 Feasibility（重点 §4-§6）

### 包版本（实际 pubspec.lock 解析到的版本）
| Package | Resolved | Pub Cache 源码已核验 |
|---|---|---|
| dio | 5.11.1 | Yes（Interceptor 顺序：按 `interceptors.addAll` 注册顺序 onRequest 从左→右串行执行） |
| **dio_cookie_manager** | **3.5.0** | **Yes（`$env:LOCALAPPDATA\Pub\Cache\hosted\pub.dev\dio_cookie_manager-3.5.0\` — 见 test/cookie_manager_test.dart 系列实际断言）** |
| cookie_jar | 4.0.9 | Yes（DefaultCookieJar/PersistCookieJar 同名不同 path 产生多条；path 长先出 RFC6265 §5.4#2；jar 按 host/path 的 map 存，单 path 内同名覆盖） |

### §5 — 5 个关键 Ordering 问题（基于 package 源码/测试，不假设）

**Q1. CookieManager 在 request 阶段什么时候读取 jar？**  
→ dio_cookie_manager 3.5.0 `CookieManager.onRequest` 内部：在拦截器被 Dio 调用时，先 `await cookieJar.loadForRequest(options.uri)` 得到 `List<Cookie>`，然后与 `options.headers['cookie']`（若已有）合并，最后调用 `CookieManager.getCookies(list)` 拼接成 RFC 6265 header 字符串并写回 `options.headers[HttpHeaders.cookieHeader]`。（证据：dio_cookie_manager 3.5.0 test/cookie_manager_test.dart 大量 onRequest → expectRequestCookies 断言；`expectRequestCookies` helper 内部就是 `handler.next` 前取 `options.headers[cookieHeader]` 做 expect，确认 header 是 onRequest 同步设置完）。

**Q2. 它如何处理已有 Cookie header？**  
→ **APPEND & PRESERVE ORDER & NOT DEDUP BY NAME**。铁证：同 package 测试 `preserves a same-name cookie supplied by the caller`：
```dart
headers: {HttpHeaders.cookieHeader: 'session=provided'} // 上游已有
jar.saveFromResponse(uri, [Cookie('session','saved')..path='/'])
→ 结果 = 'session=provided; session=saved'
```
→ 正是 21 §5.4 第 5 点警告的危险（重复同名 → 服务端 value(raw,name) 取第一个即用户手动提供的，租户选择不可预测）。**Contract "禁止手写 Cookie Header; Jar 是唯一传输" 正确且必要。**

**Q3. Company Injection 应放在哪里？**  
→ Contract A' 冻结的 `CompanyCookieInterceptor` **必须放在 CookieManager 之前（拦截器链中 CookieManager 左侧）**。  
→ 逻辑：Interceptor 左→右执行 onRequest。放在左边时：CompanyCookieInterceptor 先把 jar（Cookie 真实来源）里的 payease_company 幂等 ensure（替换 jar 内部该 host 所有 path 的旧同名 cookie，然后写 host-only `/` 的一条正确值）；**然后** CookieManager 从刚修完的 jar 读并组装唯一的 Cookie header。这样不会产生"手动在 header 写 cookie → 被 CookieManager append 第二条"的风险。这与 21 §5.4 第 2 点完全一致。**可实现。**

**Q4. Final Guard 应放在哪里？**  
→ Contract A' 冻结的 `CompanyContextGuardInterceptor` **必须放在 CookieManager 之后（右侧），但必须在 TraceId/SafeLogging 之前（这样未过 Guard 的请求在发送前就 fail-closed 且仍有脱敏日志可查）**。此时：CookieManager 已把最终的 `Cookie: payease_company=xxx; ...` 字符串写入 `options.headers`。Guard 做：
- Match `Cookie` 头中 `(?<![A-Za-z0-9_])payease_company=(t_[a-f0-9-]{36})`（不区分大小写？No，RFC 6265 cookie-name case-sensitive；精确 `payease_company=`），数精确出现次数
- 若 **exactly 1 occurrence && value == 本 ApiClient 的 companyId.raw** → 通过；否则 fail-closed（抛内部 TenantContextFailure，不调 handler.next → 不发真实网络请求），并写脱敏高优日志。
- 由于 RetryInterceptor 更靠右，重发请求会重新走整条链（包括 Guard），正好覆盖 CF0-T8。**可实现。**

**Q5. 如何避免 `payease_company=A; payease_company=B` 同时存在？**  
→ 双保险：
1. **注入前 jar 内去重（源头）**：CompanyCookieInterceptor 在 `jarFor(companyId, secureKv)` 拿到 WhitelistCookieJar(PersistCookieJar) 后：对 baseUrl.host 相关的所有 URI（host-only 根 `/`），先 `inner.loadForRequest(hostUri)`，若存在旧的 `payease_company` 值 ≠ 本公司，调用 `inner.delete(hostUri, withDomainSharedCookie: false)` 删除该 host 所有老 cookies 中 payease_company，再用 `inner.saveFromResponse(hostUri, [Cookie('payease_company', correctValue)..domain=null; ..path='/'; ..maxAge=365*24*3600])` 只写 host-only 一条长有效期的正确值。cookie_jar 4.0.9 中**同一 path 内同名 save 是 map 覆盖**（DefaultCookieJar: `map[cookie.name] = SerializableCookie(cookie)`，不会在单 path 内重复），所以只要我们只在 path `/` 放 payease_company，**单公司 jar 内绝不会自然出现两条同 name cookie**。
2. **Header 最终 Guard（出口）**：CF0-T7 要求"在 jar 中人为造出两个 payease_company → Guard 拒发"——上面 Q4 的 Guard 正则扫 header 会抓 `payease_company=` 出现次数 ≥2 就 fail-closed，正是这条测试的断言。

### §6 — CF-0 5 条必须能力结论
```
Active A → outbound exactly one A    : PASS via 双保险 (注入 + Guard)
Active B → outbound exactly one B    : PASS (ApiClient.forCompany(B) 独立 jar/独立 Dio 实例)
A → B  first B request 0 A company   : PASS (B jar 独立；Guard 正则 exact count=1 match value=B)
B → A  restore A context             : PASS (CompanyCookieStore.jarFor(A) 读回持久化 A jar + A 的 visitor/browser/session cookie 全量保留)
```
**→ CF-0 工程 P0=0，可安全实现。无 Engineering Blocker。**

---

## 2. G0 Foundation Compatibility（§3 / §18 / §19）

| Foundation | G0 现有能力 | G1 需要 | 兼容性判断 |
|---|---|---|---|
| Riverpod 3.x Notifier/AsyncNotifier/family 写法 | activeCompanyIdProvider / authGateStateProvider 用了 Notifier | OTP 11 状态机 + Auth per-company state + ReturnIntent Controller + Locale + RecentCompanies + Error Mapping catalog Notifiers | READY（不用换框架；Provider "允许增量扩展"，21 §2.3） |
| Dio + Interceptor pipeline | 7 interceptor 固定顺序 | 插入 2 个（CompanyCookie / CompanyContextGuard） | READY（`ApiClient.forCompany` 新增 optional 参数即可；不改变旧 interceptor 语义和相对顺序） |
| Cookie 4 白名单 + owner 匹配 + company-per-jar 隔离 | WhitelistCookieJar.filterCookies payease_company == owner.raw ✅；CompanyCookieStore.jarFor 每公司独立 jar ✅ | CF-0 exactly-one + Candidate preflight B context ✅ | READY（仅补 clearSessionFor 先 jarFor load + _loadAllCookies 不写死 host；不改变白名单语义） |
| SecureKv (flutter_secure_storage 9.2.4) | deleteAllWithPrefix(KeySchema.companyPrefix(id)) ✅ | activeCompanyId / companies 最近列表持久化 ✅；Recovery 不存 OTP/password ✅ | READY（加新 key 不改变旧 cookie 存储） |
| GoRouter 17 | redirect(company/auth/incomplete/feature flags) ✅ | refreshListenable、Return Intent、Candidate cancel、401 capture safe route ✅ | READY（`GoRouter(refreshListenable: Listenable.merge([routerRefreshListenable1, ...])` 支持；Return 只记 location 不记 payload） |
| Localization (gen-l10n 69 keys) | en/km/zh 0 untranslated ✅；MaterialApp.locale 尚未接入（CF-8） | MaterialApp.locale: Locale('km') + languages ∩ bundled ✅；错误文案 key 补齐（G1-ERR-01 的本地化 key） | READY（只增 ARB、不删旧 key；接入 locale: 1-2 行，不推翻） |
| SafeLogger + Redaction | 11 敏感字段名递归脱敏（大小写不敏感归一化） ✅ | OTP challengeId、phone、password、confirmPassword、Cookie、Authorization 全部已覆盖字段名（BR-15） | READY（不改变 RedactionPolicy 语义） |
| Error Foundation（AppFailure 家族） | RateLimitFailure retryAfter:Duration? ✅；AuthFailure Forbidden Conflict ServiceUnavailable Offline ✅ | 429 clamp → Duration(seconds:clamped) 直接构造 ✅；新增 registrationIncomplete 等细分内部种类（增量） | READY（向后兼容：新增子类 不改 旧失败） |
| App Links（app_links 6.4.1 + CompanyLinkParser） | DeepLinkHandler pendingDeepLinkCompanyProvider 已写但 CF-13 尚未被调用 ✅ | Company-03: resume 时取 App Links + Candidate confirm flow ✅ | READY（调用 register 即可，不重写 parser） |
| Android Toolchain（AGP 8.11.1 / Gradle 8.14.1 / Kotlin 2.4.0 / JDK17 — 全部 build PASS） | APK 160MB 真实存在 ✅；Manifest 已有 App Links intent-filter ✅ | INTERNET 权限 (main) / cleartext 10.0.2.2 (debug only) / CAMERA(optional) ✅ | READY（增量加 uses-permission + xml network-security-config，不破坏 release） |

### 3. 关键专项 Feasibility（§7-§22）

#### §7 Candidate Company / §8 Candidate Cancel
- **能否 Active A + Candidate B 同时存在？** → **YES。** 用 `ApiClient.forCompany(B, appConfig, await jarFor(B, secureKv, persistSession: false))` 独立 instance。该 B jar 在 `CompanyCookieStore._jars[B]` 里是独立引用。Candidate confirm 前 **不调 `ActiveCompanyIdNotifier.activate(B)`**，`activeCompanyIdProvider.state` 继续是 A。Cancel 后：`CompanyCookieStore._jars.remove(B)`（内存丢弃），再决定是否持久化（27号 P2-4 勘误二选一）。无论哪种，A 的 jar/session/active 状态 100% 不变。

#### §9 CF-6 clearSessionFor(company not loaded)
- 现状问题（G0 缺口 CF-6）：[CompanyCookieStore L26-30](file:///E:/KhmerX/KhmerX/mobile/lib/core/session/company_cookie_store.dart#L26-L30) `jar == null → return` 直接跳过。
- **G1 工程实现**：`clearSessionFor(id, secureKv)` 第一行改为 `final WhitelistCookieJar jar = await jarFor(id, secureKv);` → **PersistCookieJar.forceInit() + 从 secureKv 加载 A/B 的持久化 cookie 到内存**；然后执行 `jar.clearSession()` 只删 h5_session；最后自然由 PersistCookieJar.saveFromResponse 触发存储覆盖持久化。同时把 [WhitelistCookieJar L56-65](file:///E:/KhmerX/KhmerX/mobile/lib/core/session/whitelist_cookie_jar.dart#L56-L65) `_loadAllCookies()` 里写死 `api.khmerx.org` / `payease.khmerx.org` 改成 传入 `NetworkConfig.baseUrl.host` 的 uri（对本地模拟服务 10.0.2.2 也能清除）。→ **可实现，不推翻架构。**

#### §10 Logout（上下文不串租户）
- 实现顺序严格 Contract：
  1. 当前 Active=A：`final apiClient = _apiClientFamily(A);`
  2. 先执行 `apiClient.request(postH5AuthLogout);` → 使用 A jar + A 的 CompanyCookie ensure + Guard → outbound Cookie: payease_company=A（正确上下文，CF0-T11）
  3. 无论 success/failure/401：`sessionStore.clearSessionFor(A)`；`authNotifier(A).markUnauthenticated()`；清 Return Intent；跳转 `/auth/login`
- B 完全不受影响（独立 jar/独立 provider family instance）。→ **可实现。**

#### §11 Auth Endpoint（7 条）
- Endpoint 模型 [endpoints.dart](file:///E:/KhmerX/KhmerX/mobile/lib/core/network/endpoints.dart) 是 plain const class 带 path/method/requiresSession/retry。新增 7 条 static const 只需：`postAuthSend / postAuthVerify / postAuthAccount / postAuthRecovery / postH5AuthLogout / postLocaleSwitch`（path 全部 `/api/h5/auth/...` 和 GET `/api/h5/auth` 一致，与 02 §2.2-§2.7 对齐）。不需要新 Foundation。→ **可实现。**

#### §12 Binary / Business APIs（G1 不含）
- 代码 grep：mobile/lib/***.dart 中无 `/loan/quote` / `LoanQuoteRepository` / `/api/h5/state` GET 调用 / `/api/kyc` 业务 POST（仅 Endpoint 常量，无人用）。与 21 §1.2 一致。→ **无 Contract Scope Violation。**

#### §13 Router Feasibility / §14 Return Intent
- GoRouter 17 支持 `redirect` 同步读 providers（G0 已用）+ `refreshListenable` 参数。
- 4 Guards：Company（activeCompanyId==null → /company/select，已有）、Auth（auth unknown/unauthenticated → /auth/login，已有）、RegistrationIncomplete（authState.isIncomplete → /auth/set-password，已有）、**Return Intent**（401 捕获：401 时写 Provider\<ReturnIntent?\> state = ReturnIntent(companyId, state.matchedLocation, now)；认证成功 consume 后 `router.go(intent.location)`，只恢复导航，不保存 POST payload）。→ **可实现，且满足"never replay POST command automatically"（BR-14）。**

#### §15 OTP State（11 子状态）
- Riverpod `Notifier<OtpState>`：`OtpState` 用 freezed 风格 union（但 G0 没用 freezed，因此 plain sealed class/`enum OtpPhase` + data 字段即可），完全表达 idle/sending/sent(countdown)/verifying/wrong(expired/attemptsExhausted)/rateLimited(retryAfter Duration clamped)/networkError/success。countdown 用 `Timer.periodic` + 单调时钟（`DateTime.now().difference(sentServerTime)` 对比服务端 `Date` 响应头 → retryAt-serverNow = retryIn，不受设备墙钟回拨影响，21 §5.7 冻结）。→ **可实现。**

#### §16 Pending OTP Recovery（冷启动）
- 从 `getH5Auth` 响应 `snapshot.pending`（含 challengeId, phoneMasked, expiresIn）恢复路由 `/auth/telegram-code`，仅恢复掩码+挑战 ID，不恢复 code（符合：不本地存 OTP）。→ **可实现。**

#### §17 RateLimitFailure
- G0 现有字段 `final Duration? retryAfter`（不是 int seconds）。G1 clamp 规则（missing/invalid/≤0→60，1~3600→raw，>3600→3600）直接得到 int seconds → `retryAfter: Duration(seconds: clamped)`。不需要第二套 retryAfterSeconds 字段。27 号 P2-3 只是 Contract 文档勘误（字段表述），不要求代码级新字段。→ **可实现。**

#### §18 Locale
- MaterialApp 目前没写 `locale:`，但空着就是 fallback 系统语言（21 §CF-8：G1 之前它就是占位未接入）。实现：`LocaleController.build()` 返回 Locale 状态；`MaterialApp(locale: ref.watch(localeControllerProvider).locale, ...)`。`server languages ∩ {en,km,zh}`：纯集合 intersection，用 Set 即可。选不出 → fallback English。→ **可实现。**

#### §19 Minimal Home
- CurrentCompany（从 ActiveCompanyIdProvider + RecentCompaniesStore 取 name）、SwitchCompany(go /company/select)、Logout(调用 authController.logout)、Locale（open locale selection dialog）、Masked identity（仅从 session.phoneMasked 展示，不打 /api/h5/state /api/kyc）。完全符合 04 §18 G1 minimal home。→ **可实现。**

#### §20 Android Manifest / §21 mobile_scanner
- INTERNET main 权限：`<uses-permission android:name="android.permission.INTERNET"/>` 加 manifest 根 release 也会有（CF-10）。
- debug 10.0.2.2 cleartext：新建 `android/app/src/debug/res/xml/network_security_config.xml` 只 `<domain includeSubdomains="false">10.0.2.2</domain>` cleartextTrafficPermitted="true"；main manifest `<application android:networkSecurityConfig="@xml/network_security_config">` 只 debug 资源生效，release 仍默认禁止明文。不破坏 release。
- CAMERA：`<uses-permission android:name="android.permission.CAMERA" android:required="false"/>`（Contract CF-10：scanner 作为 Paste/App Link 之外第三种入口；没有摄像头走 Paste/App Link 即可）。
- mobile_scanner 7.4.2：21 §2.3 `flutter pub add --dry-run` 已验证"Would change 1 dependency"，与现有 riverpod/dio 等不冲突；架构守卫测试 `architecture_grep_test.dart L124` 的 "No mobile_scanner…" 禁令 21 §2.3 明确调整（仅允许出现在 `features/company/presentation/`）。→ **可增量引入，不推翻 G0。**

#### §22 Testing Feasibility（自动覆盖 20+ 场景）
- 基础：mocktail 1.0.5（G0 dev_dependencies）、90 G0 Tests 全绿 + Fake Server。
- 技术方案（G1 启动后做，本轮不实现，只评可行）：`test/support/fake_khmerx_server.dart` 启动 `HttpServer.bind('127.0.0.1', 0)`，拿到 port 后注入 `AppConfig.dev(baseUrl: 'http://127.0.0.1:$port')` → 所有 ApiClient 真实发请求到 Fake，Fake 读入站 `Cookie` 头、`Origin` 头、body，响应预置 status+body+headers（含 Set-Cookie 4 条）。CF0-T1..T11 的断言 = Fake 实际收到的 `request.headers['cookie']`，完全可读。OTP/Recovery/Logout 等所有流程全是 HTTP JSON，无需真实 Telegram Gateway。→ **全自动化覆盖 22 项 §22 列表全部可写。无 manual acceptance（除了 L2/L2' Android runtime真机截图）**。

---

## 4. P0 / P1 / P2（Engineering View）

### 工程 P0：0
- CF-0 为实现层 P0（需要在 G1 Exit 关前通过 CF0-T1..T11），但本 Gate 评的是"能/不能实现"，不是"已实现"。评估结论：**完全可实现，无技术不可行点** → Engineering P0 = 0。（Exit P0 = 实现完成后 HELIX 验收的事，不影响 Start Feasibility）

### 工程 P1：0
- 没有需要推翻 G0 Foundation 的缺口；CF-0/6/7/8/10 全是 G0 允许的"增量扩展 / 替换占位组件"（21 §2.3 Foundation Change Policy 明确白名单）。
- RateLimitFailure 字段 (Duration?) 与 Contract clamp 单字段语义一致；不需要第二字段。
- Dio interceptor 顺序：A' 方案是插 2 个 interceptor 到已存在 pipeline 内，不改变既有 interceptor 相对顺序（Base/Origin/Trace/SafeLog/Retry/ErrorMapping 保持不变）。**不存在 package API 行为与 Contract 的根本冲突。**

### 工程 P2（非阻断：不阻塞 Implementation Start，部分是 Exit / 文档勘误）
| ID | 项 | 分类 | 是否影响 Implementation Start？ |
|---|---|---|---|
| P2-R1 | **Android Runtime Environment**：`flutter devices` 仅 win/chrome/edge，无 Android Emulator / 真机（§24） | G1 EXIT DEPENDENCY（L1 模拟器渲染 + L2' fake-server logcat） | **NO**（只影响 Exit Evidence，不写代码不影响） |
| P2-R2 | 27-Claude-Gate P2-1：21 §6/§12/§13 的 stale UX blocking text 仍写 "UX PENDING" 与 04 §18 CLOSED 矛盾 | 文档勘误 | NO（Claude 机械修正，Trae 不用做） |
| P2-R3 | 27-Claude-Gate P2-2：Report 文件名冲突（原 Contract REPORT-01 写 22 / X-22 指定 22，22 已被 contract-review 占；现确认 30-G1-implementation-report.md 空闲，本轮用户 §27 显式指定 30） → Contract 勘误改 REPORT-01 → 30 即可 | 文档勘误 | NO（机械，不改实现） |
| P2-R4 | 27-Claude-Gate P2-3：RateLimitFailure retryAfter(Duration?) vs 21 中"增加 retryAfterSeconds:int"的文档表述不一致 → 实际实现：G1 路径统一 clamp 后 Duration(seconds:clamped)；若 Contract 文档保留 retryAfterSeconds 说明，写 "retryAfterSeconds=int 输入 → Duration 语义同值视图"即可 | 文档勘误 | NO（机械；不影响代码字段） |
| P2-R5 | 27-Claude-Gate P2-4：Candidate Company 取消后 jar 残留策略（内存 only vs 取消时删除持久化）→ 21 §5.4 Preflight 例外 只说"候选通过前不写入 ActiveCompany"，没说存储策略。选任一不影响安全（取消后 jar 无 session Cookie） | Contract 文档澄清二选一 | NO（不阻塞；选默认"取消后清内存 jar，不落盘"即可） |
| P2-R6 | 带入 G0 的老 P2：Future AGP 8.11.1 / Gradle 8.14.1 的 "support will soon be dropped" 警告；机器路径的 gradle.properties JDK pin；依赖漂移；Khmer/中文本地化语言学审校 | 技术债（HELIX Review 非阻断） | NO |

---

## 5. Task Card Feasibility（§26 分类）

```
Task Cards total: 24 (SUPPORT-01 + 3 COMPANY-COOKIE + 1 NET-01 + 1 ERR-01 + 4 COMPANY + 9 AUTH (01-09) + 1 ROUTER-01 + 1 I18N-01 + 1 ANDROID-01 + 4 TEST + 1 RUNTIME-01 + 1 REPORT-01)
```

| Area | Card | 分类 | 备注 |
|---|---|---|---|
| Support | TEST SUPPORT-01 fake_secure_kv + fake_server + pump_helpers | **READY** | |
| Company Cookie | COMPANY-COOKIE-01 payease_company ensure + duplicate guard (CF0 impl) | **READY** | 双保险 §5 Q3/Q4 |
| Company Cookie | COMPANY-COOKIE-02 candidate B preflight + A unchanged | **READY** | 独立 ApiClient(B) 不激活 Active |
| Company Cookie | COMPANY-COOKIE-03 logout context + A logout B preserve (CF0-T11) | **READY** | §10 顺序正确 |
| Company Cookie | COMPANY-COOKIE-04 clearSessionFor 先 jarFor(未缓存) 再清 + 非 production host 有效 (CF-6) | **READY** | §9 |
| Net | NET-01 ApiClient family provider + Repositories | **READY WITH CONDITION** | migrate 旧 `authGateStateProvider.mark*` 测试到新 API（不删断言） |
| Error | ERR-01 server_message_catalog + 429 clamp (60/1/3600) + retryAfter Duration | **READY** | §17 |
| Company | COMPANY-01 recent/active companies persist/restore (CF-4) + jar 初始化 payease_company | **READY** | |
| Company | COMPANY-02 select/scan/paste pages | **READY WITH CONDITION** | mobile_scanner 单依赖新增 + 架构守卫调整（§21） |
| Company | COMPANY-03 App Links deep link (CF-13 register) + router consume pending | **READY** | Manifest App Links filter 已存在 |
| Company | COMPANY-04 switch company 保留 A session (R-3) | **READY** | |
| Auth | AUTH-01 Preflight / AuthSnapshot / per-company AuthNotifier (CF-2) | **READY** | |
| Auth | AUTH-03 OTP send | **READY** | §15 倒计时单调时钟 |
| Auth | AUTH-04 OTP verify + re-preflight | **READY** | |
| Auth | AUTH-02 password login | **READY** | |
| Auth | AUTH-05 mandatory password setup (force route /auth/set-password → policy.passwordSetup) | **READY** | §13 路由守卫已有占位 |
| Auth | AUTH-06 recovery (send → reset; 不 走 verify/account) | **READY** | |
| Auth | AUTH-07 logout + 清敏感状态钩子 + 仅当前公司 | **READY** | §10 |
| Auth | AUTH-08 session restore (cold start → preflight → /home 或 auth) | **READY** | |
| Auth | AUTH-09 401 return intent capture & safe restore; 不自动 replay POST | **READY WITH CONDITION** | ReturnIntent Provider + Listenable.merge router refresh；严格区分 route ≠ command |
| Router | ROUTER-01 refreshListenable + 4 守卫整合 + 401 触发 + candidate cancel confirm | **READY** | §13 |
| Locale | I18N-01 MaterialApp.locale + EnabledLanguages ∩ bundled + CF-8 (G1 locale selection) | **READY** | §18 |
| Android | ANDROID-01 main INTERNET + debug-only cleartext 10.0.2.2 + CAMERA optional | **READY** | §20，release 无明文 |
| Tests | TEST-01..04 (CF0-T1..11 + RA-1..11 + 其余 22 项) | **READY** | §22 fake server 方案 |
| Runtime | RUNTIME-01 Android emulator L1 + L2′ fake server render + logcat | **READY WITH CONDITION** → G1 EXIT DEPENDENCY | P2-R1；§24 已声明 |
| Report | REPORT-01 30-G1-implementation-report.md | **READY** | 用户 §27 指定 30 号，编号空闲（Glob 确认无 30 md） |

### Totals（§26）
- **READY**：20  
- **READY WITH CONDITION**：4（NET-01 测试迁移 / COMPANY-02 scanner + 守卫 / AUTH-09 路由≠command / RUNTIME-01 → EXIT DEP）  
- **BLOCKED**：0

---

## 6. Report 编号 29 / 30 冲突检查（§27）
- 29-G1-trae-engineering-gate.md（本文件）：Glob 之前 → 空闲 ✅ 现在写入完成 → 不冲突。
- 30-G1-implementation-report.md：Glob 检查 → 空闲 ✅（不与现有的 27/24/25/26 冲突；原 22 被 22-G1-contract-review 占用；用户 §27 明确改 30）。

---

## 7. 最终 Verdict（§29 + §31）

---

# TRAE G1 ENGINEERING GATE: GO WITH CONDITIONS

## P0:
None（工程级 0；CF-0 为实现 Exit P0，可安全实现）

## P1:
None（无需推翻 G0 Foundation；所有 Contract 需求可在 G0 允许的"增量扩展/替换占位组件"范围内完成；所有 package 行为均与 Contract A' 冻结的拦截器 pipeline + Jar 唯一传输语义兼容；无技术不可行）

## P2:
1. **G1 EXIT DEPENDENCY — Android Runtime Environment**：当前 `flutter devices` 非 Android；G1 L1/L2′ 运行证据（模拟器 + fake server 10.0.2.2 + App Link intent 测试 + 截图）**需要在 Implementation 启动前准备 Android Emulator（或真机）**。此项不阻塞 coding start，但阻塞 G1 Exit Acceptance。
2. 27-Claude-Gate P2-1：21 §6/§12/§13  stale UX 阻塞文案勘误（机械文档修正；Claude 做）
3. 27-Claude-Gate P2-2：REPORT-01 文件名从原 22 → **30-G1-implementation-report.md**（§27 用户已冻结；机械文档修正；Claude 做）
4. 27-Claude-Gate P2-3：RateLimitFailure 字段表述统一（Duration 视图 vs retryAfterSeconds int 说明；机械文档修正；Claude 做）
5. 27-Claude-Gate P2-4：Candidate company cancel jar 持久化策略澄清（二选一即可；不阻塞 start）
6. 遗留：Future AGP/Gradle warning；依赖漂移；本地化审校；machine JDK path（G0 P2，不影响 G1 写代码）

## FOUNDATION COMPATIBILITY:
READY（Riverpod/Dio/CookieJar/SecureStorage/Router/L10n/SafeLogger/Error/Manifest App Links — 全部可增量承载，不推翻核心）

## IMPLEMENTATION FEASIBILITY:
READY（CF-0 双保险；CF-6 jarFor 先加载；Candidate/Cancel；Logout Context；Auth 7 Endpoints；Router + Return；OTP；RateLimit clamp；Locale；Minimal Home — 全部逐项可工程化，无 Package 行为与 Contract 冲突；拦截器 Order 已读真实源码确认）

## TESTABILITY:
READY（90 G0 Tests 保持；Mocktail 1.0.5；FakeKhmerXServer 本地 HttpServer 注入 AppConfig.baseUrl 可真实抓入站 Cookie/Origin/body；CF0-T1..T11、RA-1..11、§22 全部 20+ 场景自动可写；真实 Telegram OTP 仅属 L3 人工集成验收，不阻塞自动绿）

## G1 EXIT DEPENDENCIES:
- **[必须 Exit 前完成]** Android Emulator / 真机 runtime 环境（`flutter devices` 至少出现 1 台 Android；AVD 建议 API 35，与 targetSdk 对齐）→ 证据要求见 24 §Runtime Requirement (L1 + L2′)
- Contract Owner 提供的：P2-R2/R3/R4 勘误（Approve 21 为 APPROVED 前同步处理）→ 不阻塞代码启动，但阻塞正式验收
- 如用 scanner：mobile_scanner 7.4.2 真机摄像头权限授权（纯模拟器可 paste link fallback）

## TASK CARDS:
- **READY**: 20
- **CONDITIONAL**: 4 (NET-01 迁移不删断言 / COMPANY-02 mobile_scanner + 守卫 / AUTH-09 route ≠ command / RUNTIME-01 Exit Dep)
- **BLOCKED**: 0

## RECOMMENDATION:
**KEEP HOLD until Codex officially approves 21 v2.1 + applies P2 document errata (R2-R4); then AUTHORIZE IMPLEMENTATION after the three-party gate sign-off.**

---

### 法律与纪律遵守（§28 Gate Discipline 重申）
本文档 0 行代码修改；0 pubspec 变动；0 manifest 变动；0 git commit；0 G1 功能实现。所有结论基于 REAL CODE + REAL PACKAGE SOURCE + REAL TOOL OUTPUT。Trae 仍处于 HOLD，等待三方 Gate（Architecture/UX/API）的正式签出才会启动实现手。
