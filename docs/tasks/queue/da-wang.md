# 大旺的任务队列（客户端线）

通用规则见 `_common.md`。**App（Flutter）的修复与开发自 2026-10-15 起由苏晨负责（决策清单 D-20）**，P4、P7 已转到 `su-chen.md` 的 Q14、Q15；大旺不再改动 `mobile/**`。状态栏：☐ 未开始　◐ 进行中　☑ 已合并。提交身份请用独立克隆目录并设置本人名字（见 `operating-rules.md` §6）。

| 序 | 卡 | 期限 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | P1 压测脚本 B0/B0b 推送并修正 | 第 1 天 | — | ◐ |
| 2 | P2 D1 返修 | 第 1 天 | — | ☐ |
| 3 | P3 Flutter 入库（R-01） | 第 2 天 | — | ☐ |
| 4 | ~~P4 Flutter 持续集成（D2）~~ → 转苏晨（Q14） | — | — | 转出 |
| 5 | P5 错误码多语言（D4） | 第 4 天 | P2 | ☐ |
| 6 | P6 上传压缩与重试（Web/小程序） | 第 5 天 | Q8 的限制常量 | ☐ |
| 7 | ~~P7 Flutter 错误映射与上传重试~~ → 转苏晨（Q15） | — | — | 转出 |
| 8 | P8 压测脚本扩展（按客户分片场景） | 第 7 天 | P1、Q5 | ☐ |
| 9 | P9 管理后台员工列表分页（D6） | 第 8 天 | Q7 的接口文档 | ☐ |
| 10 | P10 灰度机压测执行与报告 | 第 3 天首轮、第 11–12 天复测 | 灰度机部署完成 | ☐ |

人工操作（不是 Codex 任务）：P10 在 `165.22.108.5` 上运行 k6（脚本由 P1/P8 提供），并把报告提交到 `scripts/loadtest/reports/`；压测前提醒苏晨在 `159.223.77.134` 上启动采样脚本。

---

## P1 压测脚本推送并修正　分支 `feat/client/B0`
先读：你已有的 `scripts/loadtest/` 全部内容、`docs/tasks/codex-prompts/day1.md` 中 B0 与 B0b 的要求。
```
【任务】把 B0、B0b 的脚本推送成一个分支并修正以下问题，只改 scripts/loadtest/。
1. 采样脚本 sample-resources.sh 必须在跑应用容器的服务器（159.223.77.134）上运行，README 里不得写成在 165.22.108.5 运行；--origin-ip/--host 参数属于压测脚本而不是采样脚本，若误加到采样脚本请移除。
2. 压测脚本支持 --origin-ip 与 --host：直连源站 IP 并带 Host 头；主机白名单仍用 LOADTEST_ALLOWED_HOSTS，生产域名一律拒绝。
3. 报告输出到 scripts/loadtest/reports/，必须包含：每秒请求数、p50/p95/p99、按状态码和 code 分类（尤其 409、CONFLICT、STATE_MUTATION_FAILED）、写冲突重试次数、上传成功率、总用时。
4. README 写清"谁在哪台机器上运行什么"：压测在 165.22.108.5（发起）、采样在 159.223.77.134（被测）。
自查：脚本自检、shellcheck、git diff --check。PR 小于 400 行。
```

## P2 D1 返修　分支 `feat/client/D1-fix`（从 origin/main 新开）
先读：`lib/api-client.ts`、`lib/analytics.ts`、`app/workspace.tsx`、`tests/api-client.test.mjs`。
```
【任务】D1 评审返修，只改 lib/api-client.ts、lib/analytics.ts、app/workspace.tsx、tests/api-client.test.mjs。
1. apiFetch 增加选项 notifyAuth（默认 true）；埋点请求和路径以 /api/h5/auth 开头的请求传 notifyAuth:false，不派发 khmerx:auth-required；补测试。
2. app/workspace.tsx：只有 customerMode 为 true（/api/h5/state）时才传 idempotencyKey；员工模式（/api/state）不传；在 lib/api-client.ts 注释写明"传 idempotencyKey 的接口必须自己保证幂等，当前服务端不读取 X-Idempotency-Key 头"。
3. 重试：503 带 Retry-After 时用它（上限 5 秒），否则指数退避加 0–250ms 随机抖动；增加单次 apiFetch 总时限 totalTimeoutMs（默认 30 秒）；补测试。
4. "request id helper" 测试改为加载真实 lib/client-id.ts，置空 crypto.randomUUID 后断言结果匹配 UUID v4 正则。
PR 小于 400 行。
```

## P3 Flutter 入库　分支 `app/flutter-import`
先读：`docs/flutter-android/README-现状与下一步.md`、`mobile/pubspec.yaml`、`scripts/apk/README.md`。
```
【任务】把 mobile/、scripts/dev-app-backend/、scripts/apk/、docs/flutter-android/ 提交到仓库（来源分支 wip/gate-b-local 或本地副本）。
1. 不得提交：mobile/build、mobile/.dart_tool、*.apk、*.bak、*.log、.tmp-*、build/ 目录；新增或补充 .gitignore 覆盖这些。
2. 不得提交任何密钥（key.properties、*.jks、.env）；提交前运行一次 git ls-files | grep -E "\.apk|\.jks|key.properties|\.env" 确认为空。
3. 先在 PR 描述里列出提交的目录与文件数。
验收：flutter pub get && flutter analyze 0 问题；flutter test 全绿；仓库里没有构建产物。可拆成"mobile 源码"和"文档与脚本"两个 PR。
```

## P4 Flutter 持续集成　分支 `feat/client/D2`（P3 合并后）
```
【任务】新增 .github/workflows/flutter.yml：在 mobile/ 下运行 flutter pub get、flutter analyze、flutter test；仅当 mobile/** 变化时触发；缓存 pub；Flutter 版本固定为 pubspec 对应版本。
验收：PR 上自动运行并通过；故意引入一个分析错误能让检查失败（在描述里附截图或日志）。
```

## P5 错误码多语言　分支 `feat/client/D4`（P2 合并后）
先读：`docs/contracts/ARC-00-error-and-envelope.md` §5、`app/h5/login.tsx`、`lib/i18n.tsx`（只读，不要改它）、`lib/admin-i18n.tsx`、`lib/api-client.ts`。
```
【任务】1) 新建 lib/error-messages.ts（en/km/zh 三份错误文案表，key 为错误码，覆盖 ARC-00 第 3、6、7 节所有 code，未知 code 回退到 REQUEST_FAILED）；2) 提供 messageForError(error, locale) 工具函数；3) 客户端所有展示错误的位置改为按 code 取文案，不再显示服务端中文 error 原文；4) 删除 app/h5/login.tsx 里 message.includes('请使用验证码或密码登录') 的判断，改为判断 ApiClientError.code === 'ACCOUNT_ALREADY_REGISTERED'；5) 监听 khmerx:auth-required：回到登录页并保留返回地址，登录相关页面本身不触发；6) 显示 requestId（SERVICE_UNAVAILABLE / INTERNAL_ERROR 时）。
禁止修改：lib/i18n.tsx。
验收：缺任何一个 code 的文案时测试失败；三种语言覆盖一致；界面不再出现服务端中文 error 原文。PR 小于 400 行。
```

## P6 上传压缩与重试（Web/小程序）　分支 `feat/client/D7a`
先读：`app/kyc/client.tsx`（upload 函数与文件选择部分）、`lib/kyc/limits.ts`、`lib/api-client.ts`、Q8 的限制常量。
```
【任务】1) 选择图片后在浏览器里压缩：长边 ≤ 1600px、JPEG 质量约 0.8、保持方向（处理 EXIF 方向），PDF 不压缩；压缩后仍超过限制（图片 5MB / PDF 10MB）给出明确提示；2) 上传一份一份进行（不并行）；3) 收到 503/429 且带 Retry-After 时按其退避重试，最多 3 次，界面显示"正在重试"；4) 界面提示的大小限制从 lib/kyc/limits.ts 取，不再写死"5 MB"；5) 保留原图选择、进度与失败重试按钮；6) 不新增依赖，使用 canvas。
允许修改：app/kyc/client.tsx、新增 lib/image-compress.ts、tests/。
验收：压缩函数单元测试（尺寸、质量、方向）；上传重试测试；现有 KYC 页面测试通过。PR 小于 400 行。
```

## P7 Flutter 错误映射与上传重试　分支 `feat/client/D5`
先读：`mobile/lib/core/error/`、`mobile/lib/core/network/`、`mobile/lib/features/kyc/presentation/kyc_controller.dart`、ARC-00 §5–§7。
```
【任务】1) 错误映射增加 INTERNAL_ERROR、VALIDATION_FAILED、ACCOUNT_ALREADY_REGISTERED、PAYLOAD_TOO_LARGE，并在 en/km/zh 三份 arb 里补文案；2) 在失败提示里显示 requestId（服务端错误时）；3) 上传遇到 503/429 带 retryAfterSeconds 时退避重试最多 3 次，界面显示"正在重试"；4) 大小限制常量与服务端一致（图片 5MB、PDF 10MB）；5) 新增对应测试。
注意：mobile 下 Dart 源码不得出现中日韩文字（走 l10n）。
验收：flutter analyze 0 问题；flutter test 全绿。PR 小于 400 行。
```

## P8 压测脚本扩展（按客户分片场景）　分支 `feat/client/B1`
```
【任务】在 scripts/loadtest/ 增加场景：单租户 600 虚拟客户并发"创建 → 保存资料 → 提交 → 状态轮询"，输出 409 CONFLICT 比例、写重试次数与按客户的状态一致性检查（每个客户最终状态都应是预期状态）；增加 --scenario 参数（baseline、rows）；报告新增"最终状态不一致的客户数"。
验收：本地 50 用户可跑通；报告字段齐全。
```

## P9 管理后台员工列表分页　分支 `feat/client/D6`
先读：`docs/contracts/ARC-01-lite-customer-state-rows.md`（含 Q7 追加的"员工列表接口"示例）、`app/team/client.tsx`、`app/workspace.tsx`。
```
【任务】管理后台的客户/贷款列表适配分页接口（page、pageSize，默认 50）：加载下一页、显示总数与当前页；切换筛选时回到第 1 页；加载与失败状态完整；不传分页参数时旧行为不变。
允许修改：app/team/client.tsx（仅列表相关）、components/ 下列表组件、tests/。不要重构无关代码。
验收：列表在 5000 条数据下滚动与翻页流畅（给出本地截图或测量）；现有后台测试通过。PR 小于 400 行。
```

## P10 灰度机压测执行与报告（人工 + 脚本）
```
前提：159.223.77.134 已部署并且 testapi.khmerx.org 不再返回 521；S4b、S-LT1 已合并；灰度机 PAYEASE_ENV=gray。
步骤：1) 苏晨在 159.223.77.134 启动 sample-resources.sh；2) 大旺在 165.22.108.5 运行压测，A 组（限流保持现状）、B 组（放宽租户限流）各跑 100/300/600；3) 报告与资源采样 CSV 提交到 scripts/loadtest/reports/，把分支名发给 Claude 做闸门评审；4) 第 11–12 天按调优后的版本复测。
```
