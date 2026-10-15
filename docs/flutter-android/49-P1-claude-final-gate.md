# P1 — Claude Final Gate（Contract Owner Confirmation）

```
Document:  49-P1-claude-final-gate.md
Date:      2026-10-08
Reviewer:  Claude（Product / Requirements / Architecture / API Contract Owner）
Reviewed:  45 P1 Contract（v2）· 47 Codex 合同终审（PASS）· 48 Trae Engineering Gate（GO WITH CONDITIONS）
Evidence:  48 全文；对 48 中与 45/02/21 有出入的点现场核对了服务端代码（403 错误码来源）
Not done:  不改 Flutter 代码；不重开 Product Remap；不重设计 P1；不改 45 的业务要求。
```

## 0. Project Identity

```
PROJECT IDENTITY CHECK: PASS
PROJECT: KhmerX
ROOT: E:\KhmerX\KhmerX
HEAD: ea3a4d0e38bb336398dbd7ae2be77ee100931625
REMOTE: git@github.com:leishen8806/KhmerX.git
worktree: 仅 docs/ 与 mobile/ 未跟踪；无已跟踪文件改动。45 / 47 / 48 均存在。
```

## 1. 结论

**CLAUDE P1 FINAL GATE: GO（含 4 条实现澄清，均不改变业务要求）**
- 合同层 P0 = 0，P1 = 0；无 Contract Gap；无需重开任何已冻结决策。
- 48 未引入 P2/P3/P4 范围扩张；其全部 "工程发现" 都是实现工作，不是合同缺口。
- 48 中有 5 处**实现假设与 45/02/21 不一致**，已列为**约束条件 C1–C5**（§4），实施与验收以 45/02/21 为准。

## 2. 48 对照 45：逐域核对

| 域 | 45 要求 | 48 的工程落点 | 结果 |
|---|---|---|---|
| Entry / Company | §13：所有切换经候选确认+预检；预检失败禁用确认；运行中 App Link | E1/E1f/E1g，P1-ENTRY-01 | 一致 |
| Auth / Session | §14/§15：E.164、consent 用户勾选、重发用 E.164、pending 恢复、401 | E2/E3/E5，P1-AUTH-01/02 | 一致 |
| Real Home / `GET /api/h5/state` | §10 H1–H22(+H21')、§9 DTO | 新 `features/customer_state/*`、纯函数 `decide` | 一致 |
| Loans / Detail / 最近 5 事件 / 还款摘要 | §18–§21 | §11（排序、短编号、剩余 clamp、过滤取 5） | 一致（见 C4） |
| Me / Locale / Password | §22–§24 | §12 | 一致（见 C3） |
| Company Switch / Logout | §25/§26 | E17，P1-NAV-02 统一失效点 | 一致 |
| 401 / Return Intent | §15.4 | E5 蓝图（仅 GET 位置，POST 不重放） | 一致 |
| Offline / Error | §27 | E9、重试/Guard 修复 | 一致（见 C1、C2） |
| Accessibility / Runtime | §30/§31 | E7、E6（Exit 依赖） | 一致 |
| 范围 | §4 排除、§7.2 禁止端点 | 双保险：静态守卫 + 假服务请求计数 | 一致；`Endpoints.getKyc` KEEP、P1 零调用 |
| P1/P4 边界 | §19 "P4 extends P1" | 同一 `/loans/:loanId` 脚手架 | 一致 |

**范围扩张检查**：48 提到的 App Link `pathPrefix`/assetlinks（CR-002）、Release 签名、FLAG_SECURE、真实 OTP 手工联调均被它自己归为 P2/P5/Exit，**未纳入 P1 实现范围**。没有新后端 API、没有未定义 DTO、没有 P2/P3 行为。

## 3. 工程发现是否为实现工作（逐项）

| 发现 | 判定 | 理由 |
|---|---|---|
| 页面硬编码英文 | **IMPLEMENTATION**（E15） | 45 §23/§33 已规定 ARB 与守卫 |
| 缺 401 生命周期 | **IMPLEMENTATION**（E5） | 45 §15.4 已定义行为 |
| GET 重试 / Guard | **IMPLEMENTATION**（E10） | 45 已规定：不复制 `cookie` 头；真测 CF0-T8；修法确定 |
| `error.code` / `retryAfter` 解析 | **IMPLEMENTATION**（E9） | 02 §1.5、21 §5.11.1 已定义（见 C1、C2） |
| SafeLogger 空实现 | **IMPLEMENTATION**（E11） | 45 §29 |
| debug cleartext 过宽 | **IMPLEMENTATION**（E12） | 45 §31，仅 `10.0.2.2` |
| 语言持久化 | **IMPLEMENTATION**（E18） | 45 §23.2/23.3 确定性规则 |
| 公司/登出瞬时状态失效 | **IMPLEMENTATION**（E17） | 45 §25/§26 |
| 运行中 App Link | **IMPLEMENTATION**（E1f） | 45 §13.4 |
| 扫码验证 | **IMPLEMENTATION / VERIFY**（E4） | 代码已实现，补真实页面测试 |
| A11y 溢出失败 | **IMPLEMENTATION / EXIT**（E7） | 页面未包可滚动容器，属布局修复 |
| 无 Android 运行证据 | **P1 EXIT DEPENDENCY**（E6） | 45 §31/§37 |
| fresh debug build | **P1 EXIT**（45 §37-11） | 历史构建通过；基础无已知不可构建迹象 |

**没有任何一项需要新的产品/API 行为 → 无 CONTRACT GAP，无需 HOLD。**

## 4. 约束条件（实现澄清，**不改变业务要求**，实施与验收以 45/02/21 为准）

48 在以下几点的**实现假设**与已批准的合同/真实服务端不一致。它们不是合同缺口（合同已明确），而是实施时必须按合同做、否则验收失败：

| # | 48 的说法 | 与权威来源的差异 | 约束（以谁为准） |
|---|---|---|---|
| **C1** | §15.2：403 仅在已知 code `CROSS_SITE_FORBIDDEN` 时才判为 crossSite，其它 403 → 通用 | 服务端**从不发出** `CROSS_SITE_FORBIDDEN`（核对 `lib/error-codes.ts`：所有未带显式码的 403 推断为 `FORBIDDEN`；跨站由文案「不允许跨站操作」区分） | 403 的区分必须依据 **`21` §5.11 的文案目录**（跨站 / 注册未完成 / 公司不可用）+ 显式码（`CUSTOMER_SETTLEMENT_FORBIDDEN` 等）；**不得依赖不存在的 code**。未知 403 → 通用「无权访问」，**不得默认 crossSite**（45 §27.3） |
| **C2** | §15.2：`retryAfter` "clamp 60..3600" | 合同是 **default 60 / min 1 / max 3600**：缺失、非法、≤0 → 60；**1..3600 保持服务端值**；>3600 → 3600；来源顺序 **body `retryAfter` → `Retry-After` 头 → 60**（`21` §5.11.1，RA-1…RA-11） | 实现与测试按 RA-1…RA-11；**1..59 秒不得被抬高到 60** |
| **C3** | §12.2：语言偏好键 `v1/app/locale/${companyId}`，存于 SecureKv | 45 §23：**经 KeySchema 的公司级键**（`21` §5.15：`v1/co/{id}/prefs`；无公司时 `v1/app/locale`） | 使用 `KeySchema` 公司级键；不得手拼字符串键；非敏感，明文可 |
| **C4** | §9.2：`billing.net` 缺失 → `principal ?? amount` | 45 §8/§9、02 §3.7.2：**`billing.net ?? amount`** | 缺失时用 `amount`，**不是** `billing.principal`；另 Loans 空列表**仅说明文字，不出现任何按钮（含禁用的申请按钮）**（45 §17），48 §11.1 的"禁用按钮与说明"不适用于 Loans 空列表 |
| **C5** | §18.3：基线 "165 → ≥285 tests"；45 §32.1 写"当前 183 项不减少" | 183 是此前对 `test(`/`testWidgets(` 的**静态文本计数**；`flutter test` **实际执行数 = 165**（162 通过 + 3 个 A11y 失败） | 回归基线以**实际执行结果**为准：**已通过的 162 项不得回退**；3 个 A11y 失败属 E7 待修，不计入回归；P1 Exit 要求全部通过 |

## 5. 基线失败与构建

- `flutter test` 162/165：3 个失败（A11Y-01 Select、A11Y-03 Login、A11Y-05 Home 占位）= **IMPLEMENTATION / EXIT WORK，不是启动阻断**。Home 占位页将被真实 Home 替换，失败**不上升**为合同阻断；Select/Login 溢出是页面缺可滚动容器的布局修复，**不暴露 Foundation 问题**。（此数据为 48 报告，本轮我未重跑。）
- `flutter analyze` 0 issues（48 报告）。
- **fresh `flutter build apk --debug` = P1 Exit 条件**（45 §37-11）；48 未重跑，历史构建通过，**不是启动阻断**。
- **Android 运行证据 = P1 EXIT DEPENDENCY**（R1+R2，45 §31/§37-12）；当前无设备/adb 不在 PATH，不阻断开工，但**必须在最终验收前 PASS**。

## 6. 非阻断（P2）确认

FLAG_SECURE（OQ-3）· reject 事件文案（OQ-5）· Android 设备/运行证据 · 手工真实 OTP 联调（45 R2 用假服务，**不要求**真实 OTP；R3 需书面授权）· 工具链/环境债务 · 高棉/中文语言学终审 · fresh debug build 证据 · App Link `pathPrefix`/assetlinks（CR-002）· Release 签名/targetSdk（P5）。**均不提升为 P1。**

## 7. Contract Status

```
P1 CONTRACT = APPROVED FOR IMPLEMENTATION（Contract Owner 终审，据 47 + 48 + 本文）
```
- 业务要求**未改**；已在 `45` 头部状态行记录该状态，并指向本文 §4 的 C1–C5 作为实施约束。
- **实施启动仍需最终三方 Gate**（Claude = GO · Codex 合同终审 = PASS · Trae 工程 Gate = GO WITH CONDITIONS 已齐；剩项目方书面批准）。**本文不授权 Trae。**

## 8. Final Summary

```
CLAUDE P1 FINAL GATE: GO

PROJECT IDENTITY: PASS

P0: []
P1: []
P2: Android 运行证据 / 手工 OTP / FLAG_SECURE / reject 文案 / 工具链 / 语言学终审 / fresh debug build 证据
    + 实现澄清 C1–C5（403 文案目录、retryAfter 1..3600、KeySchema 键、billing.net 缺失与 Loans 空态、测试基线口径）

CONTRACT: APPROVED FOR IMPLEMENTATION

ENGINEERING CONDITIONS: ACCEPTED AS NONBLOCKING

RECOMMENDATION: AUTHORIZE TRAE AFTER FINAL THREE-PARTY GATE
```
