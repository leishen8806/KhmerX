# C3R：Flutter 上传重试（C3-b）的测试补强、竞态修复与主线整合

来源：对 PR #67（C3-b，`20bd678`）的独立评审。代码评审 PASS（P0/P1 为 0），本机验收 COMPLETE（`flutter analyze` 无问题、435 项通过），但有两条 P2 测试缺口、一条 P3 竞态，**并且 C3-b 尚未进入 main**。
本卡分两部分：**A 补测试与小修复**、**B 主线整合**。两部分在同一个 PR 完成。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；**不改服务端与网页端**；不改认证、限流、迁移；只用虚构数据，不发送真实 Telegram 消息；不新增依赖。

## 1. 评审发现与现状

| # | 事实 | 证据 |
|---|---|---|
| C3R-F1（P2） | **页面销毁时取消上传**这一行为没有测试：把 `ref.onDispose(...)` 的取消逻辑删掉，`flutter test test/features/kyc` 仍全部通过（变异测试幸存） | `mobile/lib/features/kyc/presentation/kyc_controller.dart:172` |
| C3R-F2（P2） | **取消之后不得呈现失败结果**这一行为没有测试：删掉 `if (token.isCancelled) {…return;}` 守卫，测试仍全部通过；现有取消用例只断言"正在重试/取消"文案消失，没有断言不出现失败文案与 `uploadFailures` | 同文件 `:359`；`mobile/test/features/kyc/kyc_pages_test.dart` 的 `C3 retry state and cancellation are localized` |
| C3R-F3（P3） | 选图期间对**同一槽位**连续触发两次 `uploadSlot`（`uploading.contains(slot)` 的检查发生在 `await pick` 之前），两个上传会同时进行；`_uploads[slot]` 被第二个覆盖，第一个完成时 `_uploads.remove(slot)` 会把第二个的令牌也移掉，之后取消按钮取消不到它，销毁时也取消不到。该竞态在 C3-b 之前就存在，但 C3-b 的取消功能依赖它 | `kyc_controller.dart:346` |
| C3R-F4（整合） | **main（`9355f3a`）包含 C3-a（`82e9d3d`），不包含 C3-b**：`#66` 先合入 main，`#67` 之后才合入父分支 `feat/app/D5`（`a965410`），所以 `feat/app/D5` 比 main 多 `20bd678` 与合并提交 `a965410` | `git log origin/main..origin/feat/app/D5` |
| C3R-F5（已核实，保持） | 服务端上传路径在扫描或存储失败时会删除对象和待定行（补偿），503/429 之后重试不会残留状态；该结论不得被改动破坏。重试范围保持：仅 HTTP 503/429，首次 + 最多 3 次重试，每次等待 ≤ 30 秒；超时、断连、500、413、409、400、401、403 不重试 | `lib/kyc/server.ts` `recordFile`；`kyc_repository.dart` |

## 2. 先读
`mobile/lib/features/kyc/presentation/kyc_controller.dart`（全文，尤其 `build`、`uploadSlot`、`cancelUpload`）、`mobile/lib/features/kyc/data/kyc_repository.dart`（`upload`、`_wait`）、`mobile/test/features/kyc/kyc_pages_test.dart`、`mobile/test/features/kyc/upload_retry_test.dart`、`mobile/lib/features/kyc/presentation/kyc_pages.dart`（上传按钮与取消按钮）。

## 3. A：补测试与小修复

### 3.1 允许 / 禁止
- **允许**：`mobile/lib/features/kyc/presentation/kyc_controller.dart`（仅 `uploadSlot` 的重入保护、令牌管理）、`mobile/test/features/kyc/**`（新增或扩充用例）。
- **禁止**：服务端与网页端任何文件、`mobile/pubspec.yaml`/lock、CI 工作流、`kyc_repository.dart` 的重试语义（不得改变重试范围、次数、等待上限）、`error_mapper.dart`（C3-a 已在 main，另议）、`mobile/lib/l10n/*`（不新增文案）。**mobile 下 Dart 源码不得出现中日韩文字。**

### 3.2 实施要求
1. **R-A1 重入保护（修 F3）**：在 `await pick` **之前**同步登记该槽位"正在选择/上传"（例如把槽位加入一个同步集合，或沿用 `uploading` 的原子更新并放在 `await` 之前），使同一槽位的第二次触发立即返回；选图失败、取消选图、上传结束（成功/失败/取消）时都要释放。不改变 UI 文案与布局。
2. **R-A2 令牌管理**：同一槽位同一时刻只存在一个 `CancelToken`；完成时只移除**自己的**令牌（先比较再移除），避免移掉后来者。
3. 不改变现有行为：取消仍然取消当前请求/等待，取消后不呈现失败；销毁仍然取消所有在途上传。

### 3.3 测试（必须能区分有无修复，**变异测试要被杀死**）
- **T1 销毁取消（F1）**：启动一次上传并让它停在"重试等待"中；销毁 provider/容器；断言令牌已被取消且**之后不再有新的 HTTP 请求**（适配器请求计数不增加），随后不抛出未处理异常。
- **T2 取消不呈现失败（F2）**：启动上传、触发重试等待、点击取消；断言 `uploadFailures[slot]` 为空、`notice` 不是失败类通知、界面没有失败文案、`uploading`/`retrying` 已清空、文件未附加；再次选图可以重新上传。
- **T3 同槽位重入（F3）**：对同一槽位在 `pick` 未完成时连续触发两次；断言只发起**一个**上传请求；第一个完成后取消按钮、销毁取消仍对"当前"上传有效。
- **T4 令牌归属（2026-10-17 修订，见 §3.4）**：实现保留"完成时只移除自己的令牌"的防御性比较（`identical`）；**不再要求用测试杀死"无条件移除"变异**，因为在"同一槽位同一时刻至多一个在途上传（含选图阶段）"的约束下，该变异不可达、行为等价。T4 改为：由 T3 证明该约束成立，并在 PR 描述附 §3.4 的等价性核对表。（原条款："第一个上传完成时不会移除第二个；用可控的假仓库复现"——见 §3.4 历史记录。）
- **变异要求**：在 PR 描述附上变异结果表——① 删除 `ref.onDispose` 的取消 → T1 必须失败；② 删除取消守卫 `if (token.isCancelled)` → T2 必须失败；③ 去掉重入保护 → T3 必须失败（以上三条必须由目标断言触发失败，不得是编译错误或环境错误）；④ 完成时无条件 `_uploads.remove(slot)` → **按 §3.4 作为经独立审核的等价变异记录，允许幸存**。①–③ 任一幸存即未达标；④ 必须如实记录为 SURVIVED，不得改写成 KILLED，也不得为杀死它而新增生产测试入口、破坏重入保护或组合多个变异后冒充单项结果。
- 原有 435 项测试**全部保持通过**，不降低、不删除；`upload_retry_test.dart` 的 18 项不变。

### 3.4 T4 条款修订记录与等价性证明（2026-10-17，独立评审后）

**历史记录（不得抹去）**：原 T4 要求"完成时无条件 `_uploads.remove(slot)` 的变异必须被杀死"。Codex 实测该变异 **SURVIVED**；独立评审在 `e6fea36` 上复现，同样 **SURVIVED**（其余三条变异在目标断言处被杀死：T1 `Expected: true / Actual: false`；T2 `uploadFailures` 期望为空、实际含 `UnknownFailure`，en/km/zh 各一；T3 `Expected: <1> / Actual: <2>`）。

**修订理由**：该变异只有在"同一槽位同一时刻存在两个令牌"时才会与防御性比较产生差异；评审核对表明，在当前代码下这条路径不可达（核对表如下，行号为 `e6fea36` 的 `mobile/lib/features/kyc/presentation/kyc_controller.dart`）。因此第四条变异是**等价变异**，而不是测试缺口。

| # | 不可达路径的必要条件 | 代码依据 |
|---|---|---|
| E1 | 选图阶段同槽位重入被同步集合阻止 | `:338` `!_picking.add(slot)`；`:176` `_picking` |
| E2 | 释放选图保护到建立上传状态之间**没有 `await`** | `:345-351`：`finally` 释放后只有同步语句（`bytes == null` 判断、`CancelToken()`、`_uploads[slot] = token`、`state = copyWith(uploading: {...})`） |
| E3 | 上传期间 `uploading` 一直占用槽位，且入口检查它 | `:338` `state.uploading.contains(slot)`；`uploading` 只在 `:351` 加入、`:362/:366/:372` 移除 |
| E4 | 令牌移除先于释放 `uploading` | `:359` 先 `_uploads.remove`，`:360-362` 之后才从 `uploading` 移除 |
| E5 | `cancelUpload` 不提前释放槽位 | `:177` 只调用 `cancel()`；槽位在仓库返回、控制器继续执行时才释放 |
| E6 | 其他入口不能重置 `uploading` 或令牌表 | `_adopt`/`load` 使用 `state.copyWith`（`:188`），保留 `uploading`；provider 不会被 `invalidate`（全仓无 `invalidate(` 调用），`build` 只执行一次；销毁时 `onDispose` 取消全部令牌（`:172`） |

**由此得到的约束（必须保持）**：**单槽位至多一个在途上传（含选图阶段）**。T3 负责证明该约束。

**保留项**：防御性比较 `if (identical(_uploads[slot], token)) _uploads.remove(slot);` 继续保留，不得删除。

**再次开启条件**：若今后允许"取消后立即启动同槽位新请求"，或允许同槽位并发上传，必须**恢复 T4**：新增双令牌竞争测试（可控的假仓库，让旧请求在新请求建立后才完成），并要求"无条件移除"变异被杀死。

**独立评审发现真实可达反例时**：必须列出具体调用时序，并修实现或测试；**不得**以本条款豁免。

## 4. B：主线整合（修 F4）

**不要**再把子分支合进"已经合并过的父分支"。做法：
1. 从**最新** `origin/main` 新建整合分支 `fix/app/D5-upload-integration`（独立 worktree）。
2. 合入 C3-b：`git merge --no-ff origin/feat/app/D5`（带入 `20bd678` 与 `a965410`）；如有冲突，只解决冲突，**不顺手改动**，并在 PR 描述逐文件说明。
3. 在合入之上追加 §3 的修复与测试提交。
4. **PR 的目标分支是 `main`**（不是 `feat/app/D5`）；PR 描述第一行写"整合 C3-b（#67）并补强测试；目标 main"。
5. 合并后核对：`git merge-base --is-ancestor 20bd678 origin/main` 为真；`origin/main..origin/feat/app/D5` 为空。
6. 技术负责人合并之后，`feat/app/D5` 与 `feat/app/D5-upload` 两个旧分支不再使用，可由技术负责人决定删除（Codex 不删）。

## 5. 验收（缺一不通过）
- 本机 Flutter 3.47.0 / Dart 3.13.0（与 CI 一致）：`flutter analyze` 0 问题；`flutter test` 全部通过且**不少于 435 项加新增用例**；`flutter gen-l10n` 重新生成后无 diff；Dart 源码无 CJK（仓库既有 grep 测试通过）。
- 变异结果表（§3.3）：①②③ 被目标断言杀死；④ 记录为 SURVIVED，并附 §3.4 的等价性核对（已由独立评审确认）。
- 整合：`20bd678` 在 main 中；`git diff --check` 无输出；无服务端/网页端改动；`git diff --stat origin/main` 只包含 `mobile/` 下的文件。
- 回归：`npm test`、`typecheck`、`lint`（errors = 0）、`check:client-boundary`（容器内）无新增失败（本卡不应触及，确认即可）。
- 如实写明未验证项：没有真机/模拟器、没有真实网络、没有灰度。

## 6. 拆分
通常不超过 150 行变更；若超过 400 行，把 A（测试与修复）与 B（合并提交）分成两个提交，仍在同一 PR，不要拆成两个 PR。

## 7. 假设、风险与回退
- 假设：C3-b 的合并提交 `a965410` 可以直接带入 main；`#66` 的内容与 main 已一致，不会产生实质冲突。
- 风险：T1 依赖 Riverpod 容器销毁的时序，用可控的假仓库与 `pump` 驱动，避免真实计时。
- 回退：还原整合分支的合并提交与追加提交（不涉及服务端与数据）。

## 8. 给 Codex 的提示词
```
【任务】C3R：补强 C3-b 的测试、修复同槽位上传竞态，并把 C3-b 整合进 main。严格按 docs/tasks/codex-prompts/C3R-flutter-upload-fixes-and-integration.md 执行；先读 §2 的文件。
在独立 worktree 里基于最新 origin/main 建分支 fix/app/D5-upload-integration，先 `git merge --no-ff origin/feat/app/D5` 带入 C3-b，再追加 §3 的修复与测试。PR 目标分支是 main，不要再把 PR 指向 feat/app/D5。
只改 mobile/lib/features/kyc/presentation/kyc_controller.dart 与 mobile/test/features/kyc/**；不改重试范围/次数/等待上限，不改服务端与网页端，不新增依赖，Dart 源码不得出现中日韩文字。
先写 T1–T3，并在 PR 描述附变异结果表（前三条必须被目标断言杀死；第四条按 §3.4 的等价性条款如实记录为幸存）；原 435 项测试全部保持通过。本机验证：Flutter 3.47.0；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名；只用虚构数据。
PR 小于 400 行；提交末尾 `Line: app`；按固定格式汇报，假设写进 PR 描述；未验证真机/真实网络/灰度要如实写明。
```
