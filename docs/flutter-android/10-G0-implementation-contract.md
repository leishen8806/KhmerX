# KhmerX Android · G0 Recovery Implementation Contract

```
Contract status:   ISSUED · 2026-10-07
Owner:             Claude（System / Product / Requirements / Architecture）
Implementer:       Trae（只允许修改 mobile/ 与创建 docs/flutter-android/08-G0-implementation-report.md）
Acceptor:          Codex（独立复验，见 §10）
Governing docs:    05-flutter-technical-architecture.md（v3）· 04-ux-architecture.md（v2）· 02-api-contract.md · 07-CR-001（PROPOSED，与 G0 无关）
Gate correction:   19-G0-gate-contract-correction.md（JDK 验收口径；与本文冲突时就 JDK 条款以 19 为准）

G0 = FAIL / RECOVERY
G1 = HOLD
G2 = HOLD
G3 = BLOCKED BY CR-001

TRAE AUTHORIZED FOR G0 RECOVERY ONLY
G1 REMAINS HOLD
```

> 本文是 Trae 当前**唯一的** G0 施工输入（与 `05` 并列，冲突时**以本文为准**，因为本文基于 2026-10-07 对 `mobile/` 真实代码的取证）。**本文不宣称 G0 PASS。** 执行结果由 Trae 写入 `08-G0-implementation-report.md`，Claude 不代写。

---

## 1. 现状事实（2026-10-07 取证，真实代码 > 文档假设）

### 1.1 与 Codex 验收（`11`）的时间差
`11` 记录的 P1“`main.dart` 仍是 Counter”在其审查时成立；**此后 Trae 已改动大量文件**。当前真实状态：

| 项 | 当前真实状态 |
|---|---|
| `mobile/lib/main.dart` | **不再是 Counter**，是 16 行的 `bootstrap()` 入口；但 **import 路径错误**（`'bootstrap/app.dart'` 指向不存在的 `lib/bootstrap/`，真实文件在 `lib/app/bootstrap/`），无法编译 |
| `mobile/test/widget_test.dart` | **仍是 Counter 测试**，且引用已不存在的 `MyApp`（编译错误）。**这是唯一的测试文件** |
| `mobile/lib/` | 已有约 60 个文件（`app/`、`core/`、`features/`、`shared/`），但整体**无法编译**，且**没有任何一个自动测试覆盖它们** |
| `mobile/pubspec.yaml` | **取证期间（10:59）被 Trae 重写**：约束变为 `dio ^5.5.0`、`cookie_jar ^4.0.8`、`dio_cookie_manager ^3.1.1`、`flutter_riverpod ^2.5.1`、`go_router ^14.2.7`、`flutter_secure_storage ^9.2.2`、`app_links ^6.4.1`、`mobile_scanner ^5.1.1`、`connectivity_plus ^6.0.3`；**`intl ^0.19.0` 仍在**；`flutter_intl:` 块、`mockito`、`build_runner` 仍在。**这与本文冻结的 §2.3 版本集相反**（见 §1.5） |
| `mobile/pubspec.lock` | 首次取证时是 `flutter create` 时的旧锁（无任何直接依赖的解析项）；11:05 被更新，但**以当前 `pubspec.yaml` 在隔离副本里 `flutter pub get` 仍失败**（11:07 复核，同一 `intl` 求解错误），因此该锁**不能作为可复现依据** |
| `mobile/README.md` | 仍是 Flutter 初始工程说明 |

结论不变：**G0 FAIL**。以下取证说明为什么，以及恢复需要做什么。

### 1.2 取证方法（可复现）
所有实验都在**隔离副本**中完成，**没有修改 Trae 的工作区**：把 `mobile/` 的 `lib`、`test`、`pubspec.yaml`、`l10n.yaml`、`analysis_options.yaml` 复制到临时目录，分别运行 `flutter pub get` 与 `flutter analyze --no-pub`。环境：**Flutter 3.47.0（stable）· Dart 3.13.0**。

| 实验 | 配置 | 结果 |
|---|---|---|
| **A** | 原样复现 | `pub get` 失败：`flutter_localizations … depends on intl ^0.20.3 … khmerx_app depends on intl ^0.19.0, version solving failed` |
| **B** | **仅**把 `intl: ^0.19.0` 改为 `intl: any` | `pub get` **成功**（解析为 `intl 0.20.3`）。随后 `flutter analyze`：**51 error / 15 warning / 29 info** |
| **C** | 按 `05` 冻结的目标版本集（见 §2.3）重新解析 | `pub get` **成功**；`flutter analyze`：**52 error / 13 warning / 47 info** |

**B → C 的含义**：`intl` 是 `pub get` 的唯一阻断；但**即使依赖全部解析成功，代码本身仍有 50 余个编译错误**。其中 B 的 `ProviderContainer(retry:)` 错误在 C（Riverpod 3.x）下消失，证明代码是按 Riverpod 3.x API 写的，而 `pubspec.yaml` 解析出的却是 2.6.1。

### 1.3 当前代码的编译错误快照（实验 C，52 条，按根因归类）

| # | 根因 | 数量 | 位置 |
|---|---|---|---|
| E1 | **本地化生成器冲突**：代码 `import '../../core/localization/generated/l10n.dart'` 并使用 `S.delegate`（`flutter_intl`/`intl_utils` 风格），但实际运行的是 `l10n.yaml` 的 **gen-l10n**（输出 `AppLocalizations`）。该文件不存在 | 4 | `app/bootstrap/app.dart:6,22,27` |
| E2 | **Riverpod API 误用**：`StateProvider`（3.x 已移入 legacy）、`NotifierProviderFamily`（3.x 不存在）、`Notifier` 子类不满足泛型边界、`extends FamilyNotifier`（3.x 已取消） | 约 12 | `providers.dart:28,31,48,51,57`；`session_state.dart:54`；`locale_notifier.dart:3`；`network_state.dart:27` |
| E3 | **第三方 API 漂移**：`encryptedSharedPreferences`（`flutter_secure_storage 11.x` 无此参数）；`AppLinks.getInitialAppLink`（`app_links 7.x` 无此方法）；`connectivity_plus 7.x` 返回 `List<ConnectivityResult>`；`ProviderSubscription.whenData` 不存在 | 4 | `bootstrap.dart:17`；`deep_link_handler.dart:18`；`network_notifier.dart:19`；`router.dart:20` |
| E4 | **重复/冲突的类型**：`FeatureDisabledPage` 在两个库中重复定义（`ambiguous_import`）；`CompanyId` 构造函数重复；`core/types/company_id.dart` 不存在（实际仅 1 行） | 约 8 | `router.dart:131,143`；`company_id.dart:4`；`company_link_parser.dart:1,20,32` |
| E5 | **语言规则违规**：`Money` 是 `extension type` 却声明了与 `Object` 同名的成员（`toString`/`==`）；`const` 列表含非常量元素；`factory` 重定向构造函数带默认值；`_BoundedGetRetryPolicy` 未定义 | 约 8 | `money.dart:27,29,33`；`failure.dart:233`；`retry_policy.dart:9,10`；`retry_interceptor.dart:20` |
| E6 | **接口不一致**：`Failure` 构造器没有 `stackTrace` 命名参数却被 7 处调用；`SecureKv` 没有 `deleteAllWithPrefix`；`NetworkState` 没有 `unknown/online/offline` | 约 17 | `error_mapping_interceptor.dart`（7 处）；`company_cookie_store.dart:60`；`network_notifier.dart` |
| E7 | **未接通/多余依赖**：`company_pages.dart` 使用 `mobile_scanner`（G1 才需要）；`main.dart` import 路径错误；`test/widget_test.dart` 引用 `MyApp` | 约 7 | `company_pages.dart:4`；`main.dart:4,5,8,12`；`widget_test.dart:16` |

### 1.4 编译错误之外的**真实功能缺陷**（取证时在代码里读到，必须在恢复中修复）

> 这些缺陷**不会被编译器发现**，但会让整个客户端在真机上**完全不可用**。它们是本次取证最重要的发现。

| 编号 | 严重度 | 缺陷 | 证据 | 后果 |
|---|---|---|---|---|
| **D-1** | **P0** | **所有 `Endpoint.path` 缺少 `/api` 前缀**（如 `'/h5/auth'`），而 `baseUrl` 是 `https://api.khmerx.org`。真实路径是 `/api/h5/auth` | `core/network/endpoints.dart`（12 条路径）；整个 `lib/` 中不存在任何 `/api/…` 形式的请求路径（`grep "/api" lib` 仅命中 `api_client.dart` 的 import 与 `api.khmerx.org` 主机名，已核实）；`api.khmerx.org` 对非 `/api/*` 路径返回 404（`deploy/standalone/server.mjs:42`） | **每一个请求都会 404**。GET `/h5/auth` 永远拿不到 browser Cookie，登录不可能成功 |
| **D-2** | **P0** | **Cookie 白名单的值校验是臆造的格式**：`^v_…`（visitor）、`^b_…`（browser）、`^s_…`（session）。真实服务端：session 与 browser 是 **64 位小写十六进制**；visitor 是 **`<uuid>.<64 位十六进制>`**（`02` §1.2） | `core/session/whitelist_cookie_jar.dart:16-19` | `WhitelistCookieJar.saveFromResponse` 会**丢弃所有真实服务端下发的 Cookie** → 永远没有会话 |
| **D-3** | P1 | **`OriginInterceptor` 丢失端口**：`'${scheme}://${host}'`。服务端要求 `Origin` 与 `new URL(request.url).origin` **完全相等**（含非默认端口） | `core/network/interceptors/origin_interceptor.dart`（`onRequest` 内 `'${baseUri.scheme}://${baseUri.host}'`） | 开发期对本地模拟服务（`http://10.0.2.2:<port>`）的所有 POST 都会 403。生产（默认端口）不受影响 |
| **D-4** | P1 | **Feature Flag 默认值违反冻结决策**：`core/config/app_config.dart` 把 `FEATURE_REPAY`、`FEATURE_WITHDRAW` 默认设为 **`true`**；而 `bootstrap()` 使用的正是这份配置。`core/feature_flags/` 的类默认是 `false`，两处矛盾 | `core/config/app_config.dart`（`bool.fromEnvironment(…, defaultValue: true)`） | 提现/还款路由默认**开放** |
| **D-5** | P1 | **重复的配置/类型**：`AppConfig` 有 **3 份**（`app/config/`、`core/config/`、`core/types/`），`CompanyId` 2 份，`Failure` 体系 3 份（`core/error/failure.dart`、`core/types/app_failure.dart`、`shared/models/result.dart`）。`dio_factory` 用 `core/types/AppConfig`，`bootstrap` 用 `core/config/AppConfig` | 文件树 | 无单一事实来源；任意一处改动都会让另两处漂移 |
| **D-6** | P1 | **依赖方向违规**：`core/feature_flags/feature_flags.dart` import `app/config/app_config.dart`（core → app，违反 `05` §4） | 同上 | 架构测试无法通过 |
| **D-7** | P1 | **Riverpod 版本与代码不一致**（见 E2）：`pubspec.yaml` 为 `^2.6.1`，代码写的是 3.x（`ProviderContainer(retry:)`） | `bootstrap.dart`、`pubspec.lock` | 无法证明“Provider 自动重试 OFF”（2.x 根本没有该机制，行为与 `05` 的假设不同） |
| **D-8** | P2 | **Theme 不符合契约**：暗色主题 `ThemeData(brightness: dark)` **没有 seed**，会使用 Flutter 默认紫色；文字色 `#172033`/`#667085` 未设置；无 48dp 最小触控 | `app/bootstrap/app.dart:30-38` | 暗色模式回到默认 purple |
| **D-9** | P2 | **Router 缺陷**：`sessionReady = … \|\| true`（恒为真的死逻辑）；自定义 `_RouterRefresh` 调用不存在的 `whenData`；包含远超 G0 的路由（`/me`、`/company/scan`、`/company/paste-link`、`/auth/telegram-code`、`/auth/password`、`/auth/recover`）；占位页含可见的 `WAITING_FOR_UX_CONTRACT`、`'feature_repay_disabled'` 等**硬编码字面量** | `app/router/router.dart` | 抢跑 G1 范围且不可验证 |
| **D-10** | P2 | **开发环境指向生产主机**：`Environment.dev => 'https://api.khmerx.org'`；`staging` 抛 `UnsupportedError('WAITING_FOR_UX_CONTRACT: …')`（错误信息用词不当） | `app/config/app_config.dart:27-31` | 开发/测试构建会直接打到生产；与 `05` §24（dev = 本地模拟）不符 |
| **D-11** | P2 | **两套本地化机制并存**：`pubspec.yaml` 的 `flutter_intl:` 配置块（`intl_utils` 插件）+ `l10n.yaml`（gen-l10n）。`pub get` 实际运行的是 gen-l10n（输出 “km: 24 untranslated message(s)”） | `pubspec.yaml`、`l10n.yaml` | 见 E1 |
| **D-12** | P2 | **范围外代码**：`core/idempotency/*`（G3）、`shared/models/operation_key.dart`、`core/security/*`（FLAG_SECURE，见 §3 范围决策）、`features/me/*`、`mobile_scanner`、`mockito`、`build_runner`（G0 无代码生成） | 文件树、`pubspec.yaml` | 未经任何测试证明的代码面 |
| **D-13** | P2 | **`bootstrap()` 未按契约暴露可测试入口**：无法注入假 `SecureKv`/配置；`PlatformDispatcher.onError` 一律返回 `true` 吞掉所有错误 | `bootstrap.dart` | 无法写 bootstrap 测试；错误被静默吞掉 |
| **D-14** | P3 | **`dev_dependencies` 与 `05` 不符**：`mockito + build_runner`（需代码生成）；`05` §23 规定 `mocktail`（无代码生成） | `pubspec.yaml` | 增加不必要的生成步骤 |

---

### 1.5 漂移记录：Trae 正在并行修改（2026-10-07 11:08 复核）

> **重要**：本文起草期间 `mobile/` **仍在被修改**（10:59–11:05 之间有 18 个文件变化，包括 `pubspec.yaml`、`router.dart`、`dio_factory.dart`、`origin_interceptor.dart`、`bootstrap.dart`、`providers.dart` 等）。§1.2–§1.4 的实验与错误快照取自 **≈10:53** 的状态；下表是 **11:08 对关键缺陷的重新核对**。**最终状态以 Trae 在报告 §13 中逐条给出的证据为准**，本表只用来避免重复劳动和误报。

| 缺陷 | 11:08 复核 | 证据 |
|---|---|---|
| **D-1**（缺 `/api` 前缀） | **OPEN** | `endpoints.dart` 路径仍为 `'/h5/auth'` 等；`lib/` 中无 `'/api/…'` 请求路径 |
| **D-2**（Cookie 值正则臆造） | **OPEN** | `whitelist_cookie_jar.dart:16-19` 仍为 `v_`/`b_`/`s_` 前缀 |
| **D-3**（Origin 丢端口） | **OPEN** | `origin_interceptor.dart:18` 仍为 `'${scheme}://${host}'` |
| **D-4**（Feature Flag 默认 true） | **已被 Trae 修复，待测试证明** | `core/config/` 现为**空目录**；`app/config/app_config.dart:44,46` 的 `FEATURE_WITHDRAW/REPAY` 默认 `false` |
| **D-5**（重复类型） | **部分修复** | `core/config/`、`core/types/` 已清空（`AppConfig`、旧 `CompanyId`、`app_failure` 重复已消除）；**仍存在**：`core/session/company_id.dart` 的 `extension type` 同时有主构造与同名 `factory`（`duplicate_constructor`）；`shared/models/result.dart` 引用已删除的 `AppFailure` 并定义与 `core/error/failure.dart` 同名的 `Failure` |
| **D-6**（core 依赖 app/features） | **OPEN，且扩大** | `core/feature_flags/feature_flags.dart`、`core/network/api_client.dart`、`dio_factory.dart`、`base_headers_interceptor.dart`、`origin_interceptor.dart` 均 import `app/` 或 `features/`（删除 `core/config` 后改为指向 `app/config`）。→ 必须按 §3.6 引入 core 自有的 `NetworkConfig`、`FeatureFlags` |
| **D-7**（Riverpod 版本与代码不一致） | **OPEN** | `pubspec.yaml` 现为 `^2.5.1`，而 `bootstrap.dart:26` 仍使用 `ProviderContainer(retry: …)`（3.x API）；`providers.dart:33,62` 仍用 `StateProvider`（3.x 已为 legacy） |
| D-8 Theme、D-10 dev 指向生产、D-11 `flutter_intl` 块、D-12 范围外代码、D-14 `mockito/build_runner` | **OPEN** | `core/idempotency/*`、`core/security/*`、`features/me/*` 仍存在；`company_pages.dart:4` 仍 import `mobile_scanner`；`pubspec.yaml` 仍含 `flutter_intl:`、`mockito`、`build_runner` |
| D-9 Router、D-13 bootstrap | **未知（文件在 10:59 之后被改动）** | 需 Trae 在报告中给出现状与证据 |
| `main.dart` 导入 / `widget_test.dart` | **OPEN** | `main.dart` 仍 `import 'bootstrap/app.dart'`（路径错误）；`test/widget_test.dart`（10:47）仍是 Counter |
| `pub get` | **仍失败** | 11:07 隔离副本复现：`intl ^0.20.3 is required … khmerx_app depends on intl ^0.19.0` |

**关于 pubspec 的方向冲突**：Trae 把 Riverpod 等降到 2.x/低版本，与本文 §2.3 **相反**，且与代码（`retry:` 是 3.x API）矛盾。**本文的决策不变**：采用 §2.3 的版本集（原因见 §2.4）。若 Trae 认为必须停留在旧版本线，**不得静默降级**，须在报告 *Architecture Deviations* 中给出可复现的、阻断 3.x 的具体证据（完整的 `pub get` 输出），并由 Claude 重新决策。

## 2. Dependency Architecture Decision

### 2.1 DEPENDENCY ROOT CAUSE
| 问题 | 事实（已核实） |
|---|---|
| 谁直接声明 `intl` | **`khmerx_app` 自己**：`mobile/pubspec.yaml:28` `intl: ^0.19.0` |
| 谁要求另一个版本 | **Flutter SDK 自带的 `flutter_localizations`**：`E:\Dev\flutter\packages\flutter_localizations\pubspec.yaml:16` `intl: ^0.20.3` |
| 是否 SDK pin 导致冲突 | **是**。SDK 对 `intl` 有硬约束（`^0.20.3`），应用声明的 `^0.19.0` 与之不相交，求解器无解。冲突**不是**第三方包造成的 |
| `intl` 是否必须直接依赖 | **是**：① `lib/core/money/money.dart:3` 直接 `import 'package:intl/intl.dart'`（`NumberFormat`）；② gen-l10n 生成的代码同样依赖 `intl`。因此**不能删除该直接依赖** |
| 环境 | Flutter **3.47.0**（stable）· Dart **3.13.0**。SDK 自带 `flutter_localizations` 的 Dart 约束 `^3.11.0-0` |
| `pubspec.lock` | 是 `flutter create` 的旧锁（无任何直接依赖的解析项）；**不能作为依据**，必须由 `pub get` 重新生成 |

### 2.2 RESOLUTION
1. **`intl: any`**（带注释说明“版本由 Flutter SDK 的 `flutter_localizations` 决定”）。这是 Flutter 官方对使用 gen-l10n 的应用的标准写法。实验 B、C 均解析为 **`intl 0.20.3`**。
2. **禁止** `dependency_overrides`；**禁止**升降 Flutter SDK 来迁就 `intl`。
3. **删除** `pubspec.yaml` 中的 `flutter_intl:` 配置块；本地化**只使用 gen-l10n**（`l10n.yaml`），类名 `AppLocalizations`（见 G0-I18N-01）。
4. `pubspec.lock` 由 `flutter pub get` **重新生成并随代码提交**（应用应提交锁文件）。
5. 同时把 Riverpod 等依赖对齐到 §2.3（因为实验 B 证明：只修 `intl` 解决不了 `retry:` 与 3.x API 不一致）。

### 2.3 G0 冻结依赖集（2026-10-07 在 Flutter 3.47.0 上经实验 C 验证可一起解析）

| 包 | 约束（`pubspec.yaml`） | 实验 C 解析版本 | 说明 |
|---|---|---|---|
| `flutter_localizations` | `sdk: flutter` | SDK | |
| `intl` | **`any`** | **0.20.3** | 由 SDK pin 决定（§2.2） |
| `dio` | `^5.11.1` | 5.11.1 | |
| `cookie_jar` | `^4.0.9` | 4.0.9 | |
| `dio_cookie_manager` | `^3.5.0` | 3.5.0 | |
| `flutter_riverpod` | **`^3.4.3`** | 3.4.3 | **采用 3.x**（`05` §10；且现有代码已按 3.x 写） |
| `go_router` | **`^18.0.2`** | 18.0.2 | |
| `flutter_secure_storage` | **`^11.2.0`** | 11.2.0 | API 与 9.x 不同，见 G0-COOKIE-02 |
| `app_links` | `^7.2.2` | 7.2.2 | API 与旧版不同，见 G0-LINK-01 |
| `connectivity_plus` | `^7.3.2` | 7.3.2 | 返回 `List<ConnectivityResult>` |
| `equatable` | `^2.0.7` | 2.1.0 | |
| `flutter_test` | `sdk: flutter` | SDK | dev |
| `flutter_lints` | `^6.0.0` | 6.0.0 | dev |
| **`mocktail`** | `^1.0.5` | 1.0.5 | dev；**替代 `mockito`**（无代码生成） |

**必须移除**：`mobile_scanner`（G1）、`mockito`、`build_runner`（G0 无代码生成）、`flutter_intl:` 配置块；`cupertino_icons` 若无引用也移除。
**`environment.sdk`**：改为 `^3.11.0`（与 SDK 自带包的 Dart 下限一致）。

**偏差规则**：以上版本由我在隔离环境验证，**不是**从聊天记录推断。Trae 若在自己的环境得到不同解析，**不得为了让代码编译而降级**——应记录到报告的 *Architecture Deviations*，并附 `flutter pub get` 的完整输出。使用真实包 API，不沿用 `05` 中的伪代码签名。

### 2.4 WHY
- **SDK 兼容 > 手工历史版本**：`intl` 由 Flutter SDK 钉死；手写 `^0.19.0` 会在每次 Flutter 升级时再次失效。`any` 把选择权交还给 SDK。
- **Riverpod 3.x**：现有代码、`05`、ADR-005 与“automatic retry OFF”都以 3.x 为前提；停留在 2.6.1 需要重写全部 Provider 并改变“重试 OFF”的含义（2.x 没有自动重试），代价更大且偏离已冻结架构。
- **不使用 override**：override 会掩盖真实冲突，且让 `flutter_localizations` 运行在未验证的 `intl` 上。

---

## 3. G0 范围

### 3.1 目标
建立 **KhmerX Flutter Android Foundation**：App Bootstrap、App Shell、Config、Theme、Router Infrastructure、Riverpod、Dio、Cookie Session、Company Scoped Context、Secure Storage、Error Foundation、Safe Logging、Localization、Feature Flags、App Links Infrastructure、Network State、Testing Foundation。

### 3.2 允许保留的占位页（仅此）
`/startup`、`/company/select`、`/auth/login`、`/auth/set-password`、`/home`，以及 `/feature/repay/:loanId`、`/feature/withdraw/:loanId`（用于证明 Feature Flag）。每个占位页 ≤ 40 行，**不含业务 UI，不含硬编码的用户可见字符串**（一律走 `AppLocalizations`）。

> **路由命名**：采用 `04` v2 的名称。用户口径的 “bootstrap / company / auth / home-placeholder” 对应 `/startup`、`/company/select`、`/auth/login`、`/home`。

### 3.3 禁止（G0 不得出现）
KYC、Loan、Quote、Repayment 的任何页面/路由/仓库；`POST /api/loan/quote` 的任何调用；客户端费用计算；真实 Auth 流程（发送验证码、登录等，属 G1）；完整 Design System；扫码页面；会话恢复的**网络**调用（G1）。

### 3.4 范围决策（相对 `05` 的调整，已记录为偏差）
| 编号 | 决策 | 理由 |
|---|---|---|
| SC-1 | **`core/idempotency/*`、`shared/models/operation_key.dart` 移出 G0**（G3 的 CORE-IDEM-01 再做） | 无 G0 测试要求，属于未证明代码面 |
| SC-2 | **`core/security/*`（`SecureWindow`/`LifecycleMask`）移出 G0，推迟到 G1** | G0 没有任何敏感界面；需要原生 Kotlin 改动，应与首个敏感页面一起验证。**`allowBackup=false` 已存在，保留** |
| SC-3 | `mobile_scanner`、扫码页、粘贴链接页移出 G0 | G1 范围 |
| SC-4 | `LoanQuote` / `LoanQuoteRepository` **不在 G0 创建** | 非必需；创建只会增加“假实现”风险。`05` §29/`07` 为准 |

### 3.5 目标目录（唯一事实来源见 §3.6）
```
mobile/lib/
├── main.dart                      # 仅启动
├── app/
│   ├── app.dart                   # KhmerXApp（MaterialApp.router）
│   ├── bootstrap/                 # bootstrap(), providers.dart
│   ├── config/                    # AppConfig, Environment
│   ├── router/                    # router, RouterGate, deep_link_handler
│   └── theme/                     # KhmerXTheme
├── core/
│   ├── network/                   # ApiClient, DioFactory, Endpoints, NetworkConfig, interceptors/, network_state
│   ├── session/                   # CompanyId, ActiveCompany, CompanySessionContext, CompanyCookieStore, WhitelistCookieJar, SecureKvCookieStorage, SessionManager
│   ├── storage/                   # SecureKv, KeySchema
│   ├── error/                     # Failure, ErrorMapper, ServerMessageCatalog
│   ├── logging/                   # SafeLogger, RedactionPolicy
│   ├── localization/              # LocaleController（生成物放 generated/ 或 gen-l10n 默认位置）
│   ├── feature_flags/             # FeatureFlags, RemoteFeatureConfig（接口）
│   └── money/                     # Money（若保留；修复 extension type 错误）
├── features/
│   ├── startup/ company/ auth/ home/   # 仅占位页 + company 链接解析 + AuthGateState
├── l10n/                          # app_en.arb, app_km.arb, app_zh.arb
└── shared/widgets/                # FeatureDisabledPage 等通用占位组件
```

### 3.6 单一事实来源（每个类型只能有一个定义）
| 类型 | 唯一位置 | 删除 |
|---|---|---|
| `AppConfig`（环境、`baseUrl`、`FeatureFlags` 构造入参） | `app/config/app_config.dart` | `core/config/app_config.dart`、`core/types/app_config.dart` |
| `NetworkConfig`（`baseUrl`、超时；**core 自有值类型，由 app 层从 `AppConfig` 构造**） | `core/network/network_config.dart` | — |
| `FeatureFlags`（**core 自有值类型**，默认 `false`） | `core/feature_flags/feature_flags.dart`（**不得 import `app/`**） | — |
| `CompanyId` | `core/session/company_id.dart` | `core/types/company_id.dart` |
| `Failure` 体系 | `core/error/failure.dart` | `core/types/app_failure.dart`、`shared/models/result.dart`（若无调用） |
| `SessionStatus` / `SessionEvent`（core 层） 与 `AuthGateState`（auth 层） | 各一份，**名称不得相同**（当前 `SessionState` 在 core 与 auth 中重名） | — |

> **依赖方向**（`05` §4，强制）：`core` 不得 import `app`/`features`；`domain` 为纯 Dart；`presentation` 不得 import `dio`/`flutter_secure_storage`。因此 core 通过自己的值类型（`NetworkConfig`、`FeatureFlags`）接收配置，由 `app/` 负责装配。

---

## 4. 任务卡（Trae 逐项关闭）

> **执行顺序与依赖**：`G0-DEP-01` → `G0-FND-01` → `G0-FND-02` → `G0-FND-03` → { `G0-ERR-01`、`G0-LOG-01`、`G0-FLAG-01`、`G0-STORAGE-01` } ‖ `G0-COOKIE-01`（spike，可在 DEP-01 后立即并行）→ `G0-COOKIE-02` → `G0-COOKIE-03` → { `G0-NET-01`、`G0-NET-02`、`G0-NET-03` } → `G0-LINK-01` → `G0-I18N-01` → `G0-FND-04` → `G0-FND-05` → `G0-TEST-01` → `G0-BUILD-01` → `G0-REPORT-01`。
> 每张卡的 **Evidence** 必须写入 `08-G0-implementation-report.md`。

### G0-DEP-01 Dependency Resolution（**新增，先于一切**）
- **Goal**：让 `flutter pub get` 在干净副本上可复现成功；依赖集与 §2.3 一致。
- **Files**：`mobile/pubspec.yaml`、`mobile/pubspec.lock`、`mobile/l10n.yaml`、`mobile/analysis_options.yaml`。
- **Dependencies**：无。
- **Implementation Constraints**：
  - 依赖集、`intl: any`、`environment.sdk: ^3.11.0` 按 §2。
  - 删除 `flutter_intl:` 块、`mobile_scanner`、`mockito`、`build_runner`。
  - **禁止** `dependency_overrides`。
  - `flutter pub get` 若提示 gen-l10n 的 “untranslated messages”，记录条数，**不算失败**。
- **Tests**：无（由 BUILD-01 统一验证）。
- **Evidence**：`flutter --version`、`flutter pub get` 完整输出（含解析出的 `intl` 版本）、`pubspec.lock` 中 §2.3 各包的解析版本、与 §2.3 的任何偏差。
- **DoD**：干净副本（不含 `.dart_tool/`、`build/`）执行 `flutter pub get` 退出码 0；`pubspec.yaml` 中无 `dependency_overrides`；`pubspec.lock` 包含全部直接依赖。

### G0-FND-01 Remove Counter Template
- **Goal**：彻底删除 Flutter 计数器模板语义，**不是隐藏、不是注释**。
- **Files**：`mobile/test/widget_test.dart`（删除或整体替换为 KhmerX 测试）、`mobile/lib/**`、`mobile/README.md`。
- **Dependencies**：DEP-01。
- **Implementation Constraints**：
  - 删除：`_counter`、`_incrementCounter`、`MyApp`、`MyHomePage`、计数器标题、`FloatingActionButton` 演示、默认 Counter 测试。
  - 重写 `mobile/README.md`：说明 KhmerX Android 客户端、运行/测试/构建命令、指向 `docs/flutter-android/`。
- **Tests**：架构测试（G0-TEST-01）断言 `lib/` 与 `test/` 中不含 `Counter`、`_incrementCounter`、`Flutter Demo`、`deepPurple`、`FloatingActionButton`、`MyApp`、`MyHomePage`。
- **Evidence**：`grep -rniE "counter|_incrementCounter|Flutter Demo|deepPurple|FloatingActionButton|MyApp|MyHomePage" mobile/lib mobile/test` 输出为空；`mobile/test/widget_test.dart` 的新内容或删除记录。
- **DoD**：上述 grep 无结果；默认 Counter 测试不再存在。

### G0-FND-02 App Bootstrap
- **Goal**：建立 `main() → bootstrap() → ProviderScope → KhmerXApp → MaterialApp.router → GoRouter`，且 `main.dart` **只承担启动职责**。
- **Files**：`lib/main.dart`、`lib/app/app.dart`（由 `app/bootstrap/app.dart` 移入）、`lib/app/bootstrap/bootstrap.dart`、`lib/app/bootstrap/providers.dart`。
- **Dependencies**：DEP-01、FND-01。
- **Implementation Constraints**：
  - `main.dart` ≤ 20 行，仅 import `app/bootstrap/bootstrap.dart` 与 `app/app.dart`，**修正当前错误的 import 路径**。
  - `bootstrap()` 必须可测试：`Future<ProviderContainer> bootstrap({List<Override> overrides = const []})`（或等价），测试可注入假 `SecureKv`、`AppConfig`；**真实 `FlutterSecureStorage` 只在 bootstrap 内构造**。
  - 初始化顺序：`WidgetsFlutterBinding.ensureInitialized()` → 创建 `SecureKv` → 构造 `AppConfig` → 创建根容器（retry OFF，见 FND-03）→ 安装错误钩子。
  - `FlutterError.onError`、`PlatformDispatcher.onError` 接入 `SafeLogger`（先脱敏）；**`PlatformDispatcher.onError` 不得无条件返回 `true`**：记录后按 Flutter 默认语义处理，或在报告中说明保留 `true` 的理由。
  - 禁止在 `main.dart` 堆放 API、业务状态、Widget、存储。
- **Tests**：`test/app/bootstrap_test.dart`——`bootstrap(overrides:)` 返回容器；`pumpWidget(KhmerXApp)` 不抛异常；无公司时显示公司选择占位页。
- **Evidence**：`main.dart` 全文；`bootstrap_test` 通过输出。
- **DoD**：`flutter analyze` 对这些文件 0 问题；bootstrap 测试通过；`main.dart` 不含 `Dio`、`SecureStorage`、业务 Widget。

### G0-FND-03 ProviderScope / Riverpod
- **Goal**：以 Riverpod **3.4.3** 建立 Provider 体系，**自动重试 OFF**。
- **Files**：`lib/app/bootstrap/providers.dart`、`lib/features/*/application/*`（仅 G0 所需）、`core/**` 中的 Notifier。
- **Dependencies**：FND-02。
- **Implementation Constraints**：
  - 根容器/`ProviderScope` 必须显式配置重试关闭。**配置方式以 `flutter_riverpod 3.4.3` 的真实 API 为准**（当前代码使用 `ProviderContainer(retry: (_, __) => null)`，需验证是否合法；若与 `05` 的 `ProviderScope(retry: …)` 写法不同，**记录为 Architecture Deviation**）。
  - **禁止**使用 legacy：`StateProvider`、`StateNotifierProvider`、`ChangeNotifierProvider`；**禁止** `NotifierProviderFamily`/`FamilyNotifier`（3.x 已取消，使用 `Notifier`/`AsyncNotifier` 构造参数）。
  - 依赖流向：`Widget → Controller/Notifier → Repository → API/Infrastructure`。**禁止 `Widget → Dio`、`Widget → SecureStorage`**。
  - Provider **不得**重试任何业务请求；**任何写操作不得在 provider 构建期执行**。
  - `activeCompanyIdProvider` 等原 `StateProvider` 改为 `Notifier`。
- **Tests**：
  - `test/app/riverpod_retry_off_test.dart`：用与 bootstrap **相同的配置**创建容器，构造一个会失败的 Provider（内部计数），读取并等待足够时间，**断言只被调用 1 次**。
  - 架构测试：`lib/` 中无 `StateProvider|StateNotifierProvider|ChangeNotifierProvider|NotifierProviderFamily|FamilyNotifier`；`presentation`/`features/**/presentation` 不 import `package:dio`、`package:flutter_secure_storage`。
- **Evidence**：重试关闭的实际写法、测试输出、Riverpod 解析版本。
- **DoD**：上述测试通过；无 legacy provider；偏差已记录。

### G0-FND-04 Router Foundation
- **Goal**：建立 `GoRouter` 基础设施与单点 Gate。
- **Files**：`lib/app/router/router.dart`、`router_gate.dart`（原 `router_guard.dart`）。
- **Dependencies**：FND-03、COOKIE-03、AUTH Gate（见 G0-COOKIE-03 的 `AuthGateState`）、FLAG-01。
- **Implementation Constraints**：
  - 仅保留 §3.2 的路由；**删除**其余路由与扫码/粘贴/OTP/密码/找回/`/me` 占位页。
  - `RouterGate` 是 `Listenable`，聚合：启动是否就绪、`activeCompany`、`AuthGateState`、`FeatureFlags`。**`redirect` 不做异步 IO。**
  - 重定向顺序：启动未就绪 → `/startup`；无 active company → `/company/select`；有公司且 `unauthenticated`/`unknown` → `/auth/login`；`registrationIncomplete` → `/auth/set-password`；`authenticated` → `/home`。
  - **删除死逻辑** `… || true`；不得使用不存在的 `whenData`。
  - `/feature/repay/:loanId`、`/feature/withdraw/:loanId`：开关为 `false` 时**路由层拒绝**（显示 `FeatureDisabledPage`），不是只隐藏入口。
  - 占位页**不含硬编码字符串**；`FeatureDisabledPage` 只保留 **一个**定义（`shared/widgets/`）。
- **Tests**：`test/app/router_gate_test.dart`——无公司 → `/company/select`；有公司、`unauthenticated` → `/auth/login`；`registrationIncomplete` → `/auth/set-password`；`authenticated` → `/home`；`/feature/repay/x` 与 `/feature/withdraw/x` 默认显示禁用页；公司切换后重新评估。
- **Evidence**：路由表、测试输出。
- **DoD**：测试通过；路由集合与 §3.2 完全一致（`grep` 路径列表对比）。

### G0-FND-05 Theme
- **Goal**：建立 KhmerX 基础主题（Light + Dark），**不是 Flutter 默认紫色**。
- **Files**：`lib/app/theme/khmerx_theme.dart`、`lib/app/app.dart`。
- **Dependencies**：FND-02。
- **Implementation Constraints**：
  - Light：`primary = #1677FF`；文字主色 `#172033`；文字次色 `#667085`。
  - Dark：**必须同样使用 KhmerX 配色**（取 `04` §11 的暗色值：primary `#69A8FF`，textPrimary `#E7ECF5`，textSecondary `#A9B5C8`，background `#101722`，surface `#192332`）。**不得**再出现无 seed 的 `ThemeData(brightness: dark)`。
  - 最小可交互尺寸 **48dp**：通过 `materialTapTargetSize` 与按钮主题的 `minimumSize` 保证。
  - G0 **不**实现完整 Design System；不引入 Logo 资源以外的视觉资产（Logo 注册可选）。
  - 视觉令牌的最终取舍属于 Codex；G0 只落实本卡数值。
- **Tests**：`test/app/theme_test.dart`——Light `primary == Color(0xFF1677FF)`；Dark `primary == Color(0xFF69A8FF)` 且 **≠ Flutter 默认 seed `0xFF6750A4`**；文字色断言；按钮 `minimumSize ≥ 48×48`；`pumpWidget(KhmerXApp)` 后 `Theme.of(context).colorScheme.primary` 不是默认紫。
- **Evidence**：测试输出、`khmerx_theme.dart`。
- **DoD**：测试通过；全工程无 `deepPurple`、无无 seed 的暗色主题。

### G0-NET-01 Dio Client
- **Goal**：集中式 `ApiClient` + `Dio`，**每家公司一个实例**，所有拦截器按 `05` §6.2 的顺序接通。
- **Files**：`core/network/{api_client,dio_factory,endpoints,network_config,retry_policy}.dart`、`core/network/interceptors/*`、`app/bootstrap/providers.dart`。
- **Dependencies**：FND-03、COOKIE-03、ERR-01、LOG-01。
- **Implementation Constraints**：
  - `Dio(` 构造函数**只允许**出现在 `core/network/dio_factory.dart`；`ApiClient` 只能通过 `CompanyId` 构造（`Provider.family`），**不存在“当前公司”全局默认**。
  - 拦截器顺序：BaseHeaders → Origin → CookieManager → TraceId → SafeLogging → Retry → ErrorMapping。
  - **D-1 修复（P0）**：`Endpoint.path` 必须产生完整 URL `https://api.khmerx.org/api/h5/auth` 等。选择**一种**方式并统一：`baseUrl` 含 `/api` 且 path 为 `/h5/auth`；或 `baseUrl` 不含 `/api` 且 path 为 `/api/h5/auth`。**不得两者混用**。
  - `Endpoints` 表仅声明 G0 需要的端点：`GET /api/h5/auth`、`POST /api/h5/auth/logout`，以及 **retry 白名单的另外两个 GET**（`GET /api/h5/state`、`GET /api/kyc`）。其余端点属 G1+，**不得出现**；**不得出现** `loan/quote`。
  - **重试白名单**：`Endpoints.retry` 默认 `none`，**仅**上述三个 GET 为 `boundedGet(2)`（连接错误、超时、503；退避+抖动）；4xx、429、全部 POST **一律不重试**。
  - `RetryPolicy` 修复 `default_value_in_redirecting_factory_constructor` 与未定义的 `_BoundedGetRetryPolicy`。
  - 开发环境（D-10）：`dev` 指向**本地模拟服务**（如 `http://10.0.2.2:<port>`），**不得**指向生产；`staging` 保留名称，**不假设 URL**，抛出明确的“尚未配置”错误（**错误信息不得使用 `WAITING_FOR_UX_CONTRACT` 之类的字样**）。生产构建只允许 `https`。
  - Release 清单禁用明文流量（`usesCleartextTraffic=false` 或 `network_security_config`），仅 debug 变体为模拟服务放行。
  - 二进制上传/下载（`postBytes/getBytes`）**不属于 G0**，不要实现。
- **Tests**：
  - `test/core/network/dio_factory_test.dart`：用 `FakeHttpClientAdapter`（自写，捕获 `RequestOptions`）断言**最终请求 URL** 为 `https://api.khmerx.org/api/h5/auth`（防 D-1）；主机不匹配时抛 `StateError`；`oai-*` 头被剥离。
  - `retry_policy_test.dart`：三个 GET 在 503/超时时重试 ≤2 次；POST 与 429 重试次数 = 0；总调用次数断言。
  - 架构测试：`Dio(` 仅出现在 `dio_factory.dart`。
- **Evidence**：Endpoints 表、测试输出、dev/prod `baseUrl` 取值。
- **DoD**：测试通过；URL 断言通过；`Endpoints` 无 G1+ 端点。

### G0-NET-02 Origin Interceptor
- **Goal**：所有适用 POST 自动带正确 `Origin`，**不在任何 Repository 手写**。
- **Files**：`core/network/interceptors/origin_interceptor.dart`。
- **Dependencies**：NET-01。
- **Implementation Constraints**：
  - **D-3 修复**：`Origin` 必须由 `Uri.origin`（或等价地**包含非默认端口**）推导：生产为 `https://api.khmerx.org`（无端口），模拟服务为 `http://10.0.2.2:<port>`。
  - 仅对 POST/PUT/PATCH/DELETE 设置；GET 不设置。
  - 值只来自 `NetworkConfig.baseUrl`。
- **Tests**：`origin_interceptor_test.dart`——生产 baseUrl 的 POST 收到 `Origin: https://api.khmerx.org`；带端口的 baseUrl（如 `http://10.0.2.2:8787`）收到 `Origin: http://10.0.2.2:8787`；GET 不含 `Origin`；架构测试：`'Origin'` 字符串只出现在 `origin_interceptor.dart`。
- **Evidence**：测试输出。
- **DoD**：测试通过；全工程无其他位置设置 `Origin`。

### G0-NET-03 Network State
- **Goal**：提供网络状态基础（仅作提示，真实结果以请求失败为准）。
- **Files**：`core/network/network_state.dart`、`network_notifier.dart`。
- **Dependencies**：FND-03。
- **Implementation Constraints**：`connectivity_plus 7.x` 的 `checkConnectivity()`/流返回 **`List<ConnectivityResult>`**（修复现有 `argument_type_not_assignable`）；`NetworkState` 为 `sealed`（`unknown/online/offline`），修复 `extends_non_class` 与缺失的 getter；**不**在此层做请求重试或写队列。
- **Tests**：用假连接流驱动 `NetworkNotifier`：`unknown → online → offline`；`[none]`、`[wifi, mobile]` 等列表映射正确。
- **Evidence**：测试输出。
- **DoD**：测试通过；无编译错误。

### G0-COOKIE-01 `cookie_jar` Spike
- **Goal**：用**真实的 `cookie_jar 4.0.9` / `dio_cookie_manager 3.5.0` API**回答下列问题。**不得在文档或代码注释中编造方法签名。**
- **Files**：`test/spike/cookie_jar_spike_test.dart`（可保留为回归测试）。
- **Dependencies**：DEP-01。
- **Implementation Constraints / 必须回答**：
  1. `Storage` 抽象类的**真实成员与签名**（当前代码猜测为 `init(bool persistSession, bool ignoreExpires)`、`read/write/delete/deleteAll(List<String>)`）；
  2. `PersistCookieJar` 构造参数（`persistSession`、`ignoreExpires`、`storage` 是否都存在）；
  3. **如何只删除 `payease_h5_session`** 而保留其他 3 个 Cookie（当前实现：读取全部 → `delete(uri, true)` → 重存非会话 Cookie，需验证是否保留原有过期时间与属性）；
  4. 无 `Expires/Max-Age` 的 Cookie 是否被持久化；
  5. 服务端 `Set-Cookie` 无 `Domain` 属性（host-only）时，预置的 `payease_company`（带 `domain`）与请求匹配的行为；
  6. `dart:io` `Cookie.sameSite` 支持与 `SameSite=Strict` 解析；
  7. `CookieManager` 对**多个 `Set-Cookie`** 头的处理；以及预置 `payease_company` 后 `Cookie` 请求头的组装结果；
  8. `Max-Age=0` / 过期 Cookie 的删除行为。
- **Tests**：每个问题对应一个断言明确的测试（使用 `FakeSecureKv` 与假适配器）。
- **Evidence**：每个问题的答案与对应测试名，写入报告的 **Cookie Spike** 一节；若实际行为与 `05` §7 的假设不同，写入 *Architecture Deviations*。
- **DoD**：8 个问题均有测试与结论；**`WhitelistCookieJar` 与 `SecureKvCookieStorage` 的实现以 spike 结论为准修正**。

### G0-COOKIE-02 Secure Persistence
- **Goal**：Cookie 经**安全存储**持久化；不写普通明文文件。
- **Files**：`core/storage/{secure_kv,key_schema}.dart`、`core/session/{secure_kv_cookie_storage,whitelist_cookie_jar}.dart`。
- **Dependencies**：COOKIE-01、STORAGE-01。
- **Implementation Constraints**：
  - **D-2 修复（P0）**：白名单值校验必须与**真实服务端格式**一致（`02` §1.2 / `05` §7.2）：
    | Cookie | 值格式 |
    |---|---|
    | `payease_visitor` | `^[a-f0-9-]{36}\.[a-f0-9]{64}$` |
    | `payease_h5_browser` | `^[a-f0-9]{64}$` |
    | `payease_h5_session` | `^[a-f0-9]{64}$` |
    | `payease_company` | `^t_[a-f0-9-]{36}$`，且**必须等于该 jar 所属 `CompanyId`** |
    **删除**当前臆造的 `v_`/`b_`/`s_` 前缀正则。
  - 只允许这 4 个名称；其余一律丢弃。`payease_company` **只接受 App 预置**，响应里同名但值不同的 Cookie 丢弃并记高优先级（已脱敏）日志。
  - `Max-Age=0`/过期表示删除，交给 `cookie_jar` 处理；**不自写 Cookie 解析器**。
  - 持久化失败抛 `StorageFailure`，**fail closed**，不静默吞掉。
  - 以 spike 结论为准处理 `flutter_secure_storage 11.x` 的 Android 选项（现有 `encryptedSharedPreferences` 参数**已不存在**，E3）；`resetOnError` 的语义必须与“解密失败 = 清空并视为登出”一致并在报告中说明。
  - `SecureKv` 补 `deleteAllWithPrefix`（`flutter_secure_storage` 无前缀删除，用 `readAll` 过滤后逐个删除；说明开销）。
  - 代码中**不得**出现 `File(`、`SharedPreferences`、`path_provider` 用于存放 Cookie。
- **Tests**：
  - `whitelist_cookie_jar_test.dart`：**真实格式**的 4 个 Cookie 被接受；`v_…`/`s_…` 旧臆造格式被拒绝；未知名称被拒绝；`payease_company` 值不等于本公司被拒绝；
  - `secure_kv_cookie_storage_test.dart`：写入的所有键都以 `v1/co/{companyId}/cookiejar/` 为前缀；
  - 架构测试：`lib/` 无 `File(`、`SharedPreferences`。
- **Evidence**：测试输出；`SecureKv` 在 `flutter_secure_storage 11.2.0` 下的实际选项与说明；（可选）真机上 Keystore 读写验证。
- **DoD**：测试通过；真实格式 Cookie 可被持久化与读回；无明文文件。

### G0-COOKIE-03 Company Isolation（**G0 Blocking Acceptance**）
- **Goal**：`Company A CookieJar != Company B CookieJar`；切换保留 A、激活 B；登出只清当前公司。
- **Files**：`core/session/{company_id,active_company,company_session_context,company_cookie_store,session_manager}.dart`、`features/auth/domain/auth_gate_state.dart`。
- **Dependencies**：COOKIE-02。
- **Implementation Constraints**：
  - `CompanyId`：**唯一**定义，校验 `^t_[a-f0-9-]{36}$`；修复 `duplicate_constructor`，删除 `core/types/company_id.dart`。
  - 领域类型：`CompanyId`、`ActiveCompany`、`CompanyContext`、`CompanySessionContext`。
  - **每家公司独立**：Cookie jar、存储 key 前缀（`v1/co/{companyId}/…`）、`ApiClient`/`Dio` 实例。
  - **切换语义**：`retain A, activate B`——**切换不得调用任何清理**。`clearSession(A)` 只删 `payease_h5_session`；`clearCompany(A)` 删 `v1/co/{A}/**`（二次确认由 G1 UI 负责）。
  - **Auth Gate（G0 只建立接口与状态，不做真实登录）**：`AuthGateState ∈ {unknown, unauthenticated, registrationIncomplete, authenticated}`；G0 仅由**本地**会话 Cookie 是否存在推导 `unknown/unauthenticated`，**不发网络请求**（会话恢复的 `GET /api/h5/auth` 属 G1）。`SessionState`（core）与 auth 层状态**改名，不得重名**。
  - active company 元数据经 `KeySchema` 键 `v1/app/activeCompanyId` 与 `v1/app/companies` 持久化与恢复。
- **Tests**（**阻塞项**）：
  - `company_isolation_test.dart`：`jar(A)` 与 `jar(B)` 是不同对象；在 A 保存的 Cookie，`B.loadForRequest` 读不到；A 写入的所有存储键前缀均为 `v1/co/{A}/`，**不含 B 的前缀**；
  - `logout_isolation_test.dart`：登录 A、B 后 `clearSession(A)` → **B 的会话仍在**；A 的 visitor/browser/company Cookie 仍在；`clearCompany(A)` 后 B 完整保留；
  - 切换测试：`activate(B)` 期间**没有任何删除调用**（用记录型 `FakeSecureKv` 断言）；
  - 在途请求：A 的请求在切换到 B 后完成，其响应 Cookie **只写入 A**。
- **Evidence**：测试输出（尤其上述四项）。
- **DoD**：四项隔离测试全部通过；全工程只有一个 `CompanyId`。

### G0-STORAGE-01 Secure Storage
- **Goal**：统一的安全存储封装与键方案。
- **Files**：`core/storage/{secure_kv,key_schema}.dart`。
- **Dependencies**：FND-03。
- **Implementation Constraints**：
  - 允许保存：Cookie、active company 元数据、少量安全元数据。**G0 不实现** `pending idempotency` 的存储（SC-1）。
  - **禁止**保存：密码、OTP、完整 KYC PII、证件图、签名图、任意响应体。
  - **所有键由 `KeySchema` 生成**（`05` §8.3），其他位置禁止拼接键字符串；键带版本前缀 `v1/`。
  - 读/解密失败：**fail closed**——清空并视为登出，记录脱敏日志。
  - `SecureKv` 是接口（便于 `FakeSecureKv` 注入）；`flutter_secure_storage` 只在 `core/storage` 与 `bootstrap` 中被 import。
- **Tests**：`key_schema_test.dart`（键格式、公司前缀）；`secure_kv_test.dart`（假实现行为、`deleteAllWithPrefix`）；架构测试（`flutter_secure_storage` 的 import 位置）。
- **Evidence**：测试输出。
- **DoD**：测试通过；无其他位置拼接键。

### G0-LOG-01 Safe Logger
- **Goal**：`SafeLogger` + `RedactionPolicy`，任何日志先脱敏。
- **Files**：`core/logging/{safe_logger,redaction_policy}.dart`、`core/network/interceptors/safe_logging_interceptor.dart`。
- **Dependencies**：FND-02。
- **Implementation Constraints**：
  - 字段名黑名单（大小写不敏感、包含匹配）：`password, passwd, code, otp, phone, cookie, set-cookie, authorization, token, session, bankAccount, bankHolder, surname, givenName, address, contact*, supervisor*, signature, idFront, idBack, selfie, body`。
  - 值模式：手机号 → `***1234`；64 位十六进制（会话、browser、`challengeId`）→ `[hex64]`；长数字串（银行账号）→ `***末4位`。
  - 异常消息与堆栈**先脱敏再记录**。
  - `SafeLoggingInterceptor` 只记录：方法、`Endpoint` 名、状态码、耗时、trace id、字节数；**永不记录** URL 查询值、请求头、请求体、响应体。
  - release 仅保留 `warn/error`；**仅内存环形缓冲**，不写文件、不上传。
  - 禁止 `print(`/`debugPrint(`（`avoid_print: error` 已配置，再加架构测试）。
- **Tests**：`redaction_policy_test.dart`——含 Cookie、Password、OTP、完整手机号、证件字段、银行账号、KYC 载荷、签名的 Map 被脱敏；64 位十六进制被替换；异常消息中的手机号被脱敏；`safe_logging_interceptor_test.dart`——断言记录的内容**不含**请求头、请求体、Cookie（用捕获型 logger）。
- **Evidence**：测试输出。
- **DoD**：测试通过；全工程无 `print`。

### G0-I18N-01 Localization
- **Goal**：`en`/`km`/`zh` 基础设施；可切换语言；可渲染高棉文；**必须能实际构建**。
- **Files**：`l10n.yaml`、`lib/l10n/app_{en,km,zh}.arb`、`pubspec.yaml`、`core/localization/*`、字体资产。
- **Dependencies**：DEP-01、FND-02。
- **Implementation Constraints**：
  - **只使用 gen-l10n**（E1/D-11 的唯一解）：`l10n.yaml` + `AppLocalizations`；删除 `S`、`flutter_intl:` 块、对不存在文件 `core/localization/generated/l10n.dart` 的 import。生成物的位置按 Flutter 3.47 的真实 gen-l10n 行为确定并记录（若 `synthetic-package`/`output-dir` 选项在 3.47 中不同，**以真实行为为准**）。
  - **干净检出必须仅靠 `flutter pub get` 即可编译**；若需要额外生成命令，必须在 README 与报告中写明，并保证 `flutter test`/`flutter build apk --debug` 前自动完成。
  - `MaterialApp.router` 配置 `localizationsDelegates`、`supportedLocales`（en、km、zh）、`locale`（由 `LocaleController` 控制）。
  - **内置 Noto Sans Khmer**（OFL）：字体文件放入资产并在 `pubspec.yaml` 声明；`TextTheme` 设 `fontFamilyFallback`；高棉文行高按 `04` §11 不低于 28/16（Body）。**记录字体版本与来源**。
  - 三份 ARB 键集合必须一致；**G0 不要求翻译完整**（报告记录未翻译条数）。
  - 占位页字符串一律来自 ARB。
  - 服务端中文字符串**只允许**出现在 `core/error/server_message_catalog.dart`（本文件）与 `lib/l10n/*.arb`（本卡）。
  - 语言可用性（`GET /api/h5/auth` 的 `languages`）与持久化属 G1，G0 不做。
- **Tests**：
  - `localization_bootstrap_test.dart`：以 `km` 启动，`AppLocalizations.of(context)` 非空，且屏幕上出现高棉文字符串；切到 `en`/`zh` 后文本改变；
  - ARB 键一致性测试；
  - 架构测试：除 catalog 与 ARB 外，`lib/` 无 CJK 字符（`[\u4e00-\u9fff]`）。
- **Evidence**：测试输出；（有模拟器/真机时）高棉文渲染截图；字体来源与版本。
- **DoD**：测试通过；`flutter build apk --debug` 成功；无 `generated/l10n.dart` 残留引用。

### G0-FLAG-01 Feature Flags
- **Goal**：`withdraw = false`、`repay = false` 默认关闭；报价端点在 G0 不可用。
- **Files**：`core/feature_flags/{feature_flags,remote_feature_config}.dart`、`app/config/app_config.dart`。
- **Dependencies**：FND-03。
- **Implementation Constraints**：
  - **D-4 修复**：`FEATURE_WITHDRAW`、`FEATURE_REPAY` 的 `--dart-define` 默认值**必须是 `false`**；删除 `core/config/app_config.dart` 中默认 `true` 的版本。
  - `FeatureFlags` 为 core 自有值类型（**不得 import `app/`**，D-6）；由 `app/` 从 `AppConfig` 构造。
  - `RemoteFeatureConfig`：**仅接口**，无实现、无后端依赖；规则：远程只能进一步关闭。
  - **CR-001 边界**：`Endpoints` 与全工程**不得出现** `loan/quote`；**G0 不创建** `LoanQuoteRepository`（SC-4）。
- **Tests**：`feature_flags_test.dart`——`FeatureFlags()` 默认全 false；`AppConfig.fromEnvironment()` 在**无任何 dart-define** 时 `withdraw/repay` 为 false；传入 `--dart-define=FEATURE_REPAY=true` 的构造路径可用（通过构造函数参数模拟）；架构测试：`lib/` 不含字符串 `loan/quote`。
- **Evidence**：测试输出。
- **DoD**：默认 false 被测试证明；无 `loan/quote`。

### G0-LINK-01 App Link Parser
- **Goal**：App Links 基础设施：严格解析公司链接；**只解析，不导航，不切换公司**。
- **Files**：`features/company/domain/company_link_parser.dart`、`app/router/deep_link_handler.dart`、`android/app/src/main/AndroidManifest.xml`。
- **Dependencies**：COOKIE-03（`CompanyId`）。
- **Implementation Constraints**：
  - 接受：`https://khmerx.org/app?c=t_<uuid>`；**严格**校验 scheme（仅 `https`）、host（仅 `khmerx.org`）、path（`/app`）、`c` 参数（`CompanyId` 正则，且仅出现一次）；其余一律拒绝，**非法链接不发起任何网络请求**。
  - **`app_links 7.2.2` 的真实 API**（当前代码调用不存在的 `getInitialAppLink`，E3）：以包的实际方法（初始链接 + 链接流）为准，并记录。
  - `DeepLinkHandler` 只把解析结果放入 `pendingDeepLinkProvider`（`Notifier`，非 `StateProvider`）；**G1 才接入公司选择与路由**。
  - `AndroidManifest.xml` 的 `autoVerify` intent-filter（host `khmerx.org`、`pathPrefix /app`）已存在，保留；`assetlinks.json`（CR-002）**非阻断**，只影响最终验收。
- **Tests**：`company_link_parser_test.dart`——合法链接；`http`、其他 host（含 `www.khmerx.org`、`evil.com`）、其他 path、缺少/重复/非法 `c`、含 userinfo、含端口、大写 UUID（按 `CompanyId` 规则）全部被拒绝。
- **Evidence**：测试输出；`app_links` 实际使用的方法名。
- **DoD**：测试通过；无编译错误；无导航副作用。

### G0-ERR-01 Error Foundation
- **Goal**：统一的 `Failure` 体系与 `ErrorMapper`，中文服务端文案**集中**映射。
- **Files**：`core/error/{failure,error_mapper,server_message_catalog}.dart`、`core/network/interceptors/error_mapping_interceptor.dart`。
- **Dependencies**：FND-03。
- **Implementation Constraints**：
  - **唯一** `Failure` 体系（`sealed`），删除 `core/types/app_failure.dart`、`shared/models/result.dart`（无调用则删）。
  - 构造器**统一接受可选 `StackTrace`**（修复 7 处 `stackTrace` 错误，E6）。
  - 类型：`OfflineFailure`、`TimeoutFailure`、`ServiceUnavailableFailure`、`AuthFailure(kind)`、`ConflictFailure(kind)`、`RateLimitFailure(retryAfter)`、`ValidationFailure`、`NotFoundFailure`、`PayloadFailure`、`StorageFailure`、`UnknownFailure`（`05` §17.1；`OperationRejectedFailure` 随 G3 的 `state` 流程再加，G0 可先定义）。
  - 映射输入：HTTP 状态码 + 端点 + 已知服务端文案 → 输出：内部类型 + l10n key + 重试元数据。**中文字符串只出现在 `server_message_catalog.dart`**。
  - `ErrorMappingInterceptor` 为最后一个拦截器；`403「不允许跨站操作」` 映射为 `AuthFailure.crossSite` 并记高优先级日志（视为客户端缺陷）。
- **Tests**：`error_mapper_test.dart`（表驱动，至少 10 行）——401 会话失效、401 登录页面已失效、401 凭据错误、403 跨站、403 公司无效、409、429（含 `retryAfter` 与 `Retry-After` 头）、503、超时、离线、**未命中的消息按状态码回退**；架构测试：除 catalog 与 ARB 外 `lib/` 无 CJK 字符。
- **Evidence**：测试输出。
- **DoD**：测试通过；只有一个 `Failure` 体系；无 `stackTrace` 编译错误。

### G0-TEST-01 Foundation Tests
- **Goal**：用自动测试证明 KhmerX Contract。
- **Files**：`mobile/test/**`、`mobile/test/support/*`。
- **Dependencies**：以上各卡。
- **Implementation Constraints**：
  - 删除默认 Counter 测试（FND-01）。
  - 测试基础设施：`test/support/` 提供 `FakeSecureKv`（内存、可记录删除调用）、`FakeHttpClientAdapter`（捕获请求、可编排响应/异常）、`TestBootstrap`（注入假依赖）。使用 **`mocktail`**，**不使用代码生成**。
  - **必需测试矩阵**（10 组，缺一不可）：

    | # | 组 | 文件（建议） | 断言要点 |
    |---|---|---|---|
    | 1 | Bootstrap | `app/bootstrap_test.dart` | 应用启动；无公司 → 公司选择占位页 |
    | 2 | Router guard | `app/router_gate_test.dart` | 四种 Auth 状态与无公司的重定向；feature 路由默认禁用 |
    | 3 | Company context | `core/session/company_context_test.dart` | `CompanyId` 校验；`ActiveCompany` 切换保留 A 激活 B；重启后恢复 |
    | 4 | Cookie isolation | `core/session/company_isolation_test.dart` | A≠B 的 jar、存储前缀、互不可见 |
    | 5 | Logout isolation | `core/session/logout_isolation_test.dart` | `clearSession(A)` 后 B 仍在；A 其余 Cookie 仍在 |
    | 6 | Origin | `core/network/origin_interceptor_test.dart` | POST 收到正确 `Origin`（含端口场景）；GET 无 |
    | 7 | Safe logging | `core/logging/redaction_policy_test.dart` | 敏感值被脱敏 |
    | 8 | Feature flags | `core/feature_flags/feature_flags_test.dart` | 默认 false |
    | 9 | Theme | `app/theme_test.dart` | KhmerX 主题而非默认紫 |
    | 10 | Localization bootstrap | `core/localization/localization_bootstrap_test.dart` | km 渲染；切换语言 |

  - **额外必需测试**（本次取证发现的缺陷回归）：
    - 最终请求 URL 含 `/api/…`（D-1）；
    - Cookie 真实格式被接受、臆造格式被拒绝（D-2）；
    - Riverpod 重试 OFF（FND-03）；
    - 重试白名单（NET-01）；
    - `cookie_jar` spike（COOKIE-01）；
    - `company_link_parser_test`；`error_mapper_test`；`key_schema_test`。
  - **架构测试** `test/architecture/`：依赖方向（core 不 import app/features；presentation 不 import dio/secure_storage）；`Dio(` 仅在 `dio_factory.dart`；`'Origin'` 仅在 `origin_interceptor.dart`；无 legacy provider；无 `print(`；无 `loan/quote`；除 catalog 与 ARB 外无 CJK；无 Counter 模板字样；无 `File(`/`SharedPreferences`；`flutter_secure_storage` 仅在 `core/storage` 与 `bootstrap`。
  - 测试不得依赖网络；不得向生产发请求。
- **Evidence**：`flutter test` 完整输出（含通过数）。
- **DoD**：10 组 + 额外测试 + 架构测试全部通过；无被跳过（`skip:`）的 G0 必需测试。

### G0-BUILD-01 Analyze / Test / APK
- **Goal**：干净检出可重复地分析、测试、构建。
- **Files**：（无新增，运行命令并取证）
- **Dependencies**：全部前置卡。
- **Implementation Constraints**：
  - 从**干净副本**（不含 `.dart_tool/`、`build/`）依次执行并记录**完整输出与退出码**：
    ```
    flutter doctor -v
    flutter pub get
    flutter analyze
    flutter test
    flutter build apk --debug
    ```
  - `flutter analyze`：**0 error、0 warning、0 info**（"No issues found!"）。若需要放宽某条 lint，必须在 `analysis_options.yaml` 中**显式关闭并在报告中说明理由**，不得静默忽略。允许使用 `dart fix`/`dart format` 清理。
  - 记录：APK 路径、大小、SHA-256；`minSdk/targetSdk/compileSdk`、`applicationId`。
  - **JDK 口径（以 `19` 为准）**：阻断项是 **Gradle Build JDK（`org.gradle.java.home`）兼容且有证据**，加上干净构建通过；`flutter doctor` 显示的 Flutter Tool JDK 属开发者环境项（Informational；与 JDK 17 不同记 P2），**不是 G0 阻断项**。报告须使用四个独立概念（System `JAVA_HOME`、PATH Java、Flutter Tool JDK、Gradle Build JDK），并附 `19` §8.2 的环境身份块。
  - **全部成功才允许申请 Codex 复验。**
  - 有 Android 模拟器或真机时：`adb install`、启动、截图（公司选择占位页；高棉语渲染）、`adb logcat` 无崩溃；**没有设备则明确写“NOT EXECUTED”及原因**，不得省略。
- **Tests**：本卡即验收。
- **Evidence**：五条命令的输出；设备运行证据或 NOT EXECUTED 说明。
- **DoD**：`pub get`、`analyze`、`test`、`build apk --debug` 全部退出码 0。

### G0-REPORT-01 Implementation Report
- **Goal**：由 **Trae** 提交可独立复核的实施报告。**Claude 与 Codex 不代写。**
- **Files**：`docs/flutter-android/08-G0-implementation-report.md`（**新建，位于 `mobile/` 之外**）。
- **Dependencies**：BUILD-01。
- **Implementation Constraints**：见 §5。
- **Tests / Evidence**：报告本身；每项声明必须附命令输出或文件路径。
- **DoD**：§5 的全部章节齐全；自评 PASS 的前提是 §10 所有阻断项均有证据。

---

## 5. G0 Report Contract（`08-G0-implementation-report.md` 必须包含）

| # | 章节 | 内容要求 |
|---|---|---|
| 1 | Environment | `flutter doctor -v`；Flutter/Dart 版本；Android SDK；**四个独立的 Java 概念**（System `JAVA_HOME`、PATH Java、Flutter Tool JDK、Gradle Build JDK）及 `19` §8.2 的**环境身份块**；是否有设备 |
| 2 | Dependencies | `pubspec.yaml` 依赖表；`pubspec.lock` 中 §2.3 各包的**解析版本**；`intl` 解析结果；与 §2.3 的偏差 |
| 3 | Files Changed | **按任务卡**列出新增/修改/删除的文件；明确列出**删除**项（Counter、重复类型、范围外代码） |
| 4 | Architecture | 实际目录树；`main → bootstrap → ProviderScope → KhmerXApp → Router` 链路；单一事实来源表（§3.6）的实际位置 |
| 5 | Tests | 测试文件清单；`flutter test` 完整输出与通过数；§4 G0-TEST-01 的 10 组 + 额外 + 架构测试逐项对应 |
| 6 | Analyze | `flutter analyze` 完整输出 |
| 7 | Build | `flutter build apk --debug` 输出；APK 路径、大小、SHA-256；`minSdk/targetSdk/applicationId` |
| 8 | Run | 设备/模拟器安装与启动证据（截图、`adb` 输出）；**没有则写 NOT EXECUTED + 原因** |
| 9 | Cookie Spike | G0-COOKIE-01 的 8 个问题逐一回答（真实 API 签名与行为），及据此对实现的修正 |
| 10 | Company Isolation | 四项隔离测试的名称与输出；存储键前缀样例 |
| 11 | Origin | 含端口与不含端口的测试输出；`Origin` 仅出现在拦截器的 grep 证据 |
| 12 | Safe Logging | 脱敏测试输出；拦截器不记录请求头/体的证据 |
| 13 | Defect Closure | **逐条**回应 §1.4 的 D-1 至 D-14：已修复/未修复，证据文件或测试名 |
| 14 | Known Issues | 未解决的问题与风险（诚实列出） |
| 15 | Architecture Deviations | 与 `05`/本文的任何偏差：内容、原因、影响（包括 Riverpod `retry` 的真实配置方式、gen-l10n 的真实输出位置、`flutter_secure_storage 11.x` 的选项差异） |
| 16 | Contract Gaps | 本文/`05`/`04` 中发现的缺口、歧义或错误 |
| 17 | Self Assessment | **G0 PASS/FAIL 自评**：必须列出 §10 每个阻断项的证据；任一阻断项无证据则只能自评 FAIL |

**报告纪律**：只陈述已执行并留有证据的事实；未执行的写 NOT EXECUTED；不得用“应该可以”代替结果。

---

## 6. Architecture Deviations（本文已记录，Trae 补充）

| 编号 | 偏差 | 原因 | 状态 |
|---|---|---|---|
| DEV-01 | `intl: any` 取代 `^0.19.0`；不使用 override | SDK 的 `flutter_localizations` 钉死 `^0.20.3`（§2） | 冻结 |
| DEV-02 | Riverpod 3.4.3；根容器 retry 的真实写法待 Trae 验证 | 现有代码按 3.x 写；`05` 以 3.x 为前提 | 待 Trae 记录实际写法 |
| DEV-03 | 路由采用 `04` 的名称：`/startup`、`/company/select`、`/auth/login`、`/home` | 用户口径的 bootstrap/company/auth/home 与 `04` 对应 | 冻结 |
| DEV-04 | `core/idempotency/*`、`core/security/*` 移出 G0 | §3.4 SC-1/SC-2 | 冻结 |
| DEV-05 | 本地化仅 gen-l10n；删除 `flutter_intl` | E1/D-11 | 冻结 |
| DEV-06 | `mockito+build_runner` → `mocktail`；删除 `mobile_scanner` | G0 无代码生成与扫码 | 冻结 |
| DEV-07 | `KhmerXApp` 位置由 `app/bootstrap/app.dart` 改为 `app/app.dart`；新增 `app/theme/` | 与 `05` §3 一致 | 冻结 |

---

## 7. Codex Acceptance Criteria（G0 复验）

Codex 从**干净副本**（不含 `.dart_tool/`、`build/`）独立执行 §4 G0-BUILD-01 的命令，并按下表判定。**任一 Blocking 项失败 → G0 FAIL。**

### 7.1 Blocking（缺一不可）
| # | 项 | 通过标准 |
|---|---|---|
| B-1 | 依赖可解析 | `flutter pub get` 退出码 0；`intl` 由 SDK 约束决定；无 `dependency_overrides`；`pubspec.lock` 含全部直接依赖 |
| B-2 | 静态分析 | `flutter analyze` 0 error、0 warning、0 info |
| B-3 | 测试 | `flutter test` 全绿；§4 G0-TEST-01 的 10 组 + 额外 + 架构测试全部存在且通过；无 Counter 测试 |
| B-4 | 构建 | `flutter build apk --debug` 成功并产出 APK；**Gradle Build JDK（`org.gradle.java.home`）为批准的兼容 JDK（当前 JDK 17）并有 `19` §8.3 的证据** |
| B-5 | Counter 已删除 | grep 无 `Counter`、`_incrementCounter`、`Flutter Demo`、`deepPurple`、`FloatingActionButton`、`MyApp` |
| B-6 | 启动链路 | `main → bootstrap → ProviderScope/容器 → KhmerXApp → MaterialApp.router → GoRouter` 可被 bootstrap 测试证明；`main.dart` 无业务 |
| B-7 | Riverpod 重试 OFF | 重试关闭测试通过；无 legacy provider |
| B-8 | **URL 正确（D-1）** | 最终请求 URL 含 `/api/h5/...` |
| B-9 | **Cookie 真实格式（D-2）** | 真实格式 Cookie 被接受并持久化读回；旧臆造格式被拒绝 |
| B-10 | **公司隔离** | A≠B；登出 A 不影响 B；切换不清理；在途响应不串 |
| B-11 | **Origin（D-3）** | POST 带正确 `Origin`（含端口）；仅在拦截器设置 |
| B-12 | Feature Flag（D-4） | `withdraw/repay` 默认 false，且路由层拒绝；无 `loan/quote` |
| B-13 | 安全存储与日志 | 键均经 `KeySchema`；无明文文件；脱敏测试通过；拦截器不记录头/体/Cookie |
| B-14 | 无重复类型（D-5/D-6） | `AppConfig`、`CompanyId`、`Failure` 各一份；`core` 不 import `app`/`features` |
| B-15 | Theme / 本地化 | KhmerX 主题（含暗色）；km 可渲染；gen-l10n 唯一；无 `generated/l10n.dart` 引用 |
| B-16 | 报告 | `08-G0-implementation-report.md` 存在且章节齐全，§13 逐条回应 D-1 至 D-14 |

### 7.2 Non-blocking（记录，不阻断）
真机运行证据（无设备可 NOT EXECUTED）；高棉文翻译完整度；`km/zh` 未翻译条数；`staging` 环境尚不存在；**Flutter Tool JDK / System `JAVA_HOME` / PATH Java 与 JDK 17 的差异（P2，见 `19`）**。

### 7.3 Codex 的额外复核
- 抽查 Trae 报告中的命令输出是否可复现；
- 复核 `04` 是否与 Option B 与 AF-6 一致（`09` 中 R-1 至 R-14）——**这是 G1 前的条件，不是 G0 的阻断**；
- 不接受“代码写完”作为 PASS；只接受证据。

---

## 8. G1 Entry Criteria

**G1 现在是 HOLD。** 只有以下全部满足，才可改为 **G1 = GO**：

1. **G0 Contract implemented**（§4 全部任务卡关闭，§1.4 缺陷逐条关闭）；
2. **G0 tests pass**（`flutter test` 全绿，含全部必需测试）；
3. **APK build pass**（`flutter build apk --debug` 成功）；
4. **Codex G0 Review = PASS**，且**无 P0/P1**；
5. `08-G0-implementation-report.md` 已提交并通过对账；
6. 三方 Gate Review（Architecture + UX + API）完成；
7. Codex 已修订 `04` 中 G1 相关的 Review Item：**R-3**（公司切换缓存措辞）、**R-5**（`/auth/recover/reset` 路由）、**R-12**（同意框不预勾选）——见 `09`。

**G1 将负责**（本轮**不得**提前实现）：公司选择、扫码/粘贴公司链接、App Link 接入路由、会话恢复（`GET /api/h5/auth`）、验证码登录、密码登录、设置密码、找回密码、登出、`SecureWindow`/`LifecycleMask`。

## 9. G2 / G3 Status

| Gate | 状态 | 说明 |
|---|---|---|
| **G2** | **HOLD** | 依赖 G1 Exit；另需 `04` 的 R-4、`options.json` 副本版本确认 |
| **G3** | **BLOCKED BY CR-001** | `07` 仍为 `PROPOSED`；解除需 8 项全部满足（`CR-001 APPROVED` + `Quote API IMPLEMENTED` + `AF-6 IDEMPOTENCY FIX IMPLEMENTED` + `QUOTE/CREATE ATOMICITY PASS` + `CONTRACT TEST PASS` + `CONCURRENCY TEST PASS` + `UNKNOWN-OUTCOME RETRY TEST PASS` + `ANDROID INTEGRATION TEST PASS`）。**Flutter Foundation 的开始不改变 CR-001 状态。** G0 不得调用 `POST /api/loan/quote`，不得有客户端费用计算 |

---

## 10. Trae 约束汇总
1. **只修改 `mobile/`**，以及新建 `docs/flutter-android/08-G0-implementation-report.md`；不得修改 `04`、`05`、`07`、后端、Web、`app/`、`lib/`（仓库根的服务端代码）、`deploy/`。
2. 不进入 G1；不实现真实 Auth、KYC、Loan、Quote、Repayment；不调用 `POST /api/loan/quote`。
3. **生产冒烟**只允许：`GET /api/h5/auth` 与无副作用的 `POST /api/h5/auth/logout`（体 `{}`）。**不得发送验证码、创建账号、KYC 或贷款数据。** 自动化测试**不得**访问生产。
4. 不得为通过编译而降级依赖、不使用 `dependency_overrides`、不把错误吞掉。
5. 任何与本文不一致的实现，必须记录到报告的 *Architecture Deviations*。

---

## 附录 A　取证快照（仅用于核对，非规范）

- 取证时间：实验 A/B/C 约 10:53；漂移复核 11:07–11:08（§1.5）；环境：Flutter 3.47.0 / Dart 3.13.0；方法：隔离副本，**未修改 `mobile/`**（取证期间 `mobile/` 中的变化均来自 Trae 的并行工作）。
- 实验 B（仅 `intl: any`）：`pub get` 成功；`analyze` 51 error / 15 warning / 29 info。实验 C（§2.3 版本集）：`pub get` 成功；`analyze` 52 error / 13 warning / 47 info。
- 实验 C 的 52 个错误按文件分布：`network_notifier.dart` 8、`error_mapping_interceptor.dart` 7、`providers.dart` 5、`router.dart` 5、`main.dart` 4、`app.dart` 4、`money.dart` 3、`company_link_parser.dart` 3、`retry_policy.dart` 2，其余单条（`bootstrap.dart`、`deep_link_handler.dart`、`failure.dart`、`retry_interceptor.dart`、`network_state.dart`、`company_cookie_store.dart`、`company_id.dart`、`session_state.dart`、`company_pages.dart`、`locale_notifier.dart`、`widget_test.dart`）。
- **本文没有声明 G0 PASS，也没有声明任何一项已修复。**
