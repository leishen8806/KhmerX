# C3：Flutter 错误映射与上传重试（原 Q15/D5，已授权提前）

基线：`origin/main` = `34d09d2`。分支：`feat/app/D5`，提交末尾 `Line: app`。独立 worktree，一个任务一个分支一个 PR，PR < 400 行；超过按 §6 拆分。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；**不改服务端**；不改认证、限流、迁移；只用虚构数据，不发送真实 Telegram 消息。

## 1. 已核实事实（`34d09d2`）

| # | 事实 | 证据 |
|---|---|---|
| C3-F1 | 错误映射 `ErrorMapper` 只对 **429** 单独产出 `RateLimitFailure(retryAfter)`；其余状态码交给 `ServerMessageCatalog.from(...)`（224 行）与 `_statusFallback`；响应体里读取的是 `retryAfter`/`retry_after`，**而 ARC-00 的信封把退避秒数放在 `params.retryAfterSeconds`** | `mobile/lib/core/error/error_mapper.dart:46-70,105-124` |
| C3-F2 | 未见 `INTERNAL_ERROR`、`VALIDATION_FAILED`、`ACCOUNT_ALREADY_REGISTERED`、`PAYLOAD_TOO_LARGE` 的专门映射；失败提示里也没有显示 `requestId`（只有 `traceId` 字段） | `grep` 结果；`failure.dart` |
| C3-F3 | 网络层重试策略只有 `RetryPolicy.none()` 与 `boundedGet`（仅 GET，对 503 重试，**429 不重试**）；KYC 仓库与控制器**没有上传重试**，也没有 5MB/10MB 的大小常量 | `retry_policy.dart`、`kyc_repository.dart`、`kyc_controller.dart` |
| C3-F4 | 服务端契约（已合并）：上传图片 ≤ 5MB、PDF ≤ 10MB（`lib/kyc/limits.ts` 为单一来源），超限 413 `PAYLOAD_TOO_LARGE`；扫描不可用/过载 503 `SERVICE_UNAVAILABLE` 带 `params.retryAfterSeconds` 与 `Retry-After`；每客户容量超限 409 `CONFLICT` | Q8（#29）、ARC-00 §3、`lib/kyc/limits.ts` |
| C3-F5 | Flutter 本地工具链：Flutter 3.47.0 stable / Dart 3.13.0，CI 同版本；基线 `flutter analyze` 无问题，`flutter test` 410 项通过 | `docs/tasks/status/2026-10-16-Q14-ci-acceptance.md` |

## 2. 先读
`mobile/lib/core/error/*`（`error_mapper.dart`、`failure.dart`、`failure_text.dart`、`server_message_catalog.dart`）、`mobile/lib/core/network/*`（`retry_policy.dart`、`dio_factory.dart`、`interceptors/`）、`mobile/lib/features/kyc/data/kyc_repository.dart`、`mobile/lib/features/kyc/presentation/kyc_controller.dart`、`kyc_pages.dart`、`mobile/lib/l10n/app_{en,km,zh}.arb`、`docs/contracts/ARC-00-error-and-envelope.md` §3、§5–§7、`lib/kyc/limits.ts`（只读）、`mobile/test/**` 现有错误映射与 KYC 测试。

## 3. 允许 / 禁止修改
- **允许**：`mobile/lib/**`（上述相关目录）、`mobile/lib/l10n/*.arb`（并按仓库流程重新生成 gen-l10n 产物）、`mobile/test/**`。
- **禁止**：服务端与网页端任何文件、`mobile/pubspec.yaml`/lock（**不新增依赖**）、CI 工作流。**mobile 下 Dart 源码不得出现中日韩文字**（走 l10n，仓库有针对性的 grep 测试）。

## 4. 实施要求
1. **错误映射**：
   - 新增并测试 `INTERNAL_ERROR`、`VALIDATION_FAILED`、`ACCOUNT_ALREADY_REGISTERED`、`PAYLOAD_TOO_LARGE` 的映射；`SERVICE_UNAVAILABLE`（503）与 `CONFLICT`（409，含乐观锁/容量）按 ARC-00 对应文案；未知 code 回退到通用文案。
   - 退避秒数同时从响应头 `Retry-After` 和 **`params.retryAfterSeconds`** 读取（C3-F1 的缺口），优先头，其次 `params`，再次旧字段；非法值回退默认。
   - 在 en/km/zh 三份 `.arb` 补文案，三份 key 集合一致。
2. **requestId**：服务端错误（至少 `INTERNAL_ERROR`、`SERVICE_UNAVAILABLE`）的失败提示显示 `requestId`（来自信封 `requestId` 或 `X-Request-Id`，不要用本地生成值冒充）；不显示服务端中文原文。
3. **上传重试**：
   - 仅对**明确被服务端拒绝、未处理**的响应重试：`503`（含 `SERVICE_UNAVAILABLE`）与 `429`；按 `retryAfterSeconds` 退避，**最多 3 次**，每次上限 30 秒；界面显示"正在重试"状态（走 l10n），可取消。
   - **不重试**：超时、连接中断、`4xx`（含 `413`、`409`、`400`、`401`、`403`）、`5xx` 中的 `500`——因为请求可能已处理，盲目重试会重复上传（先阅读 `app/api/kyc/files/route.ts` 与 `lib/kyc/server.ts` 确认上传是否幂等，把结论写进 PR；不幂等时上述限制必须保持）。
   - 实现为上传专用策略，**不要**扩大现有 `boundedGet` 的语义，也不要让普通 POST 自动重试。
4. **大小限制**：在 Dart 侧定义与服务端一致的常量（图片 5MB、PDF 10MB），选择文件后在本地先行校验并给出 l10n 提示；超限不发请求。常量处加注释指向 `lib/kyc/limits.ts` 为单一来源。
5. 不改页面布局和导航；不重构无关代码。

## 5. 验收（缺一不通过）
- 映射测试：每个 code 都有用例，覆盖有无 `requestId`、有无 `Retry-After` 头、仅 `params.retryAfterSeconds`、非法值回退；未知 code 回退。
- 上传重试测试（使用 Dio 的测试适配器/模拟，不发真实网络）：
  - 503 带 `retryAfterSeconds` → 退避后重试，最多 3 次，第 4 次不再重试并向用户显示失败；重试期间状态为"正在重试"；取消生效；
  - 429 同上；
  - 超时、断连、500、413、409、400 **不重试**，且只发出一次请求；
  - 重试时请求体（同一文件）不变。
- 大小限制测试：5MB 边界内通过，超出（图片 5MB+1、PDF 10MB+1）本地拒绝且不发请求。
- l10n：三份 arb key 一致；Dart 源码无 CJK（现有 grep 测试通过）；`requestId` 展示不含服务端原文。
- `flutter analyze` 0 问题；`flutter test` 全部通过，**不少于基线 410 项**；不降低或删除现有测试。
- 回归：`npm test`、`typecheck`、`lint`（errors = 0）、`check:client-boundary` 无新增失败（本卡不应触及这些，确认即可）；`git diff --check` 无输出。

## 6. 拆分建议（PR < 400 行）
- **C3-a**：错误映射 + 文案 + requestId + 测试。
- **C3-b**：上传重试策略 + 大小限制 + 测试（堆叠在 C3-a 上，描述第一行写"基于 <分支>，等其合并后需 rebase"）。

## 7. 验证环境
执行人本机 Flutter 3.47.0 / Dart 3.13.0（与 CI 一致）；不挂载生产配置或凭据；没有设备或灰度运行验证，PR 里如实写"未验证设备/灰度"。

## 8. 假设、风险与回退
- 假设：`params.retryAfterSeconds` 是 ARC-00 规定的位置（以 ARC-00 与现有服务端实现为准；若与实际响应不符，停下报告）。
- 风险：上传幂等性——不确定时按"只重试 503/429"这一最保守规则处理。
- 回退：还原 `mobile/lib` 与测试、arb 的改动，不涉及服务端与数据。

## 9. 给 Codex 的提示词
```
【任务】C3：Flutter 错误映射与上传重试。严格按 docs/tasks/codex-prompts/C3-flutter-error-upload.md 执行；先读 §2 的文件。
在独立 worktree 里基于最新 origin/main 建分支 feat/app/D5（建议拆 C3-a、C3-b）。只改 mobile/ 下的 lib、l10n、test；不改服务端与网页端，不新增依赖；Dart 源码不得出现中日韩文字（走 l10n）。
只对 503/429 做最多 3 次、按 retryAfterSeconds 退避的上传重试；超时/断连/500/4xx 不重试；先读服务端上传路由确认幂等性并写进 PR。
用虚构数据，不发送真实 Telegram 消息，不访问任何 khmerx.org 域名；不要操作 159.223.77.134 / 165.22.108.5。
PR 小于 400 行；提交末尾 `Line: app`；按固定格式汇报，假设写进 PR 描述；flutter analyze 0 问题、flutter test 不少于 410 项且全绿。
```
