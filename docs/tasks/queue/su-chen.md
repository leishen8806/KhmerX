# 苏晨的任务队列（服务端与数据线）

通用规则见 `_common.md`。**App（Flutter）线自 2026-10-15 起也由苏晨负责（决策清单 D-20）**：Q14、Q15 提交说明末尾写 `Line: app`，分支用 `feat/app/…`；Q14 沿用已有的 PR #8 分支。状态栏：☐ 未开始　◐ 进行中　☑ 已合并。每张卡完成后把状态改成 ☑ 并写 PR 链接。

| 序 | 卡 | 期限 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | Q1 S2 返修 | 第 1 天 | — | ◐ |
| 2 | Q2 S4b 返修（独立分支） | 第 1 天 | — | ◐ |
| 3 | Q3 S-LT1 返修（独立分支） | 第 1 天 | — | ◐ |
| 4 | Q4 灰度机部署模板与脚本 | 第 2 天 | Q2 | ☐ |
| 5 | Q5 S6 客户分片（表 + 仓储 + shadow） | 第 5 天 | Q1，ARC-01-lite | ☐ |
| 6 | Q6 S7 回填、反向合并、对账 | 第 7 天 | Q5 | ☐ |
| 7 | Q7 S8 切读 + 员工分页聚合 | 第 8 天 | Q6 | ☐ |
| 8 | Q8 上传服务端稳定化 | 第 5 天 | Q1 | ☐ |
| 9 | Q9 扫描机部署脚本（Licensed 机） | 第 4 天 | Q4 | ☐ |
| 10 | Q10 备份脚本 | 第 5 天 | Q4 | ☐ |
| 11 | Q11 灰度自动关闭/恢复 | 第 10 天 | Q4 | ☐ |
| 12 | Q12 按压测报告调优 | 第 11–12 天 | 压测报告 | ☐ |
| 13 | Q13 S3 安全收口（上生产前） | 第 15 天后 | — | ☐ |
| 14 | Q14 Flutter CI 返修（PR #8，App 线） | 第 2 天 | — | ☐ |
| 15 | Q15 Flutter 错误映射与上传重试（App 线） | 第 9–10 天（可顺延，不阻塞服务端主线） | Q1 | ☐ |

人工操作（不是 Codex 任务，苏晨在服务器上做）：第 2–3 天按 Q4 的产物在 159.223.77.134 部署并让 `testapi.khmerx.org` 不再返回 521；第 4 天在 165.22.108.5 部署扫描服务；第 5 天配置备份并做一次恢复演练；第 12 天配合压测做资源采样。

---

## Q1 S2 返修　分支 `feat/server/S2`
先读：`lib/http/*`、`lib/h5-auth.ts`、`lib/kyc/server.ts`、`lib/store.ts`、`app/api/h5/state/route.ts`、`app/api/bots/route.ts`、`deploy/standalone/server.mjs`。
```
【任务】S2 评审返修，只改本分支已改动的文件。
1. lib/h5-auth.ts 的 failure()/json() 错误分支、lib/kyc/server.ts 的 failed()：编号一律用 requestIdOf(request) ?? resolveRequestId(request)；补测试：客户端不带 X-Request-Id 时，route() 内返回的错误响应头与响应体 requestId 相同。
2. deploy/standalone/server.mjs：413 的 code 改为 PAYLOAD_TOO_LARGE；网关的 503/413 响应体加 requestId（网关自生成 UUID，同时放进响应头）。
3. lib/store.ts 的 mutate()：乐观锁重试耗尽时抛带 code 'CONFLICT'、状态 409 的错误；app/api/h5/state/route.ts 的 POST 不再把所有异常吞成 400，未知异常交给 route() 走 500 INTERNAL_ERROR（日志带 requestId）。
4. app/api/bots/route.ts 的 catch：只映射已知的 Telegram 验证失败，其余记日志并交给 route()。
5. readJsonBody：先检查 Content-Length，超限直接 413，再读取请求体。
6. 网关设置 server.headersTimeout/requestTimeout（普通请求 30s，上传 60s）。
每项配测试；PR 小于 400 行。
```

## Q2 S4b 返修　分支 `feat/server/S4b`（从 origin/main 新开，不要带 S2/S3 的文件）
先读：`deploy/standalone/server.mjs`、`deploy/standalone/hosts.mjs`、`tests/standalone-hosts.test.mjs`、`deploy/client/Caddyfile`、`docs/master-plan-20261015.md` §12.3a。
```
【任务】S4b：灰度域名可配置 + 信任 Cloudflare 的真实 IP，只改 deploy/standalone/ 与 tests/。
1. 保留已有实现：主机列表来自 config.json（publicClientHosts/adminHosts/apiHosts，缺省为当前正式域名）；X-Real-IP 仅在连接来自回环/私网时信任；转发给 Worker 的 cf-connecting-ip 与限流键使用解析后的真实 IP。
2. 新增 deploy/standalone/Caddyfile.gray 模板与 README 说明：灰度域名反代到网关 127.0.0.1:4300；header_up X-Real-IP {client_ip}；servers { trusted_proxies static <Cloudflare 官方 IP 段> client_ip_headers CF-Connecting-IP }；tls internal（Cloudflare 为"完整"模式）；官网 test.khmerx.org 走静态目录；明确写"没有这份配置不得信任 X-Real-IP"。
3. server.mjs 启动断言：若配置的主机含 payease/admin/api/payeas.khmerx.org 之一，则出现 PAYEASE_LIMIT_SCALE 或 PAYEASE_GATEWAY_RATE_SCALE 时拒绝启动。
4. 补测试：断言上面第 3 点；默认配置下行为与现在一致。
PR 小于 400 行。
```

## Q3 S-LT1 返修　分支 `feat/server/S-LT1`（从 origin/main 新开）
先读：`lib/h5-auth-core.ts`、`lib/h5-auth.ts`、`deploy/standalone/server.mjs`（限流部分）、`tests/h5-rate-limits.test.mjs`。
```
【任务】S-LT1：限流分层与倍率开关，只改限流相关代码与测试。
1. 保留已有实现（租户级默认 5000、ownerLimits、PAYEASE_LIMIT_SCALE 仅 local/gray 生效、网关 PAYEASE_GATEWAY_RATE_SCALE）。
2. 修复：网关倍率 gatewayScaleValue 用 Number.isFinite 校验，非法值（如 abc）按 1 处理并告警，不得产生 NaN 使限流失效；补"倍率为 abc 时限额仍为默认值"的测试。
3. 把"PAYEASE_ENV 是否为 local/gray"的判断抽成一个共用函数，网关与 lib/h5-auth.ts 共用。
4. 在 docs/tasks/gray-shortcuts.md 登记：租户级限流默认 5000 是灰度捷径，上生产前要用每手机号/浏览器/IP 补强。
PR 小于 400 行。
```

## Q4 灰度机部署模板与脚本　分支 `feat/server/GRAY-1`
先读：`deploy/standalone/README.md`、`compose.yaml`、`Dockerfile`、`server.mjs`（config.json 的字段）、`docs/master-plan-20261015.md` §12.3、§12.3a、`docs/tasks/decision-log.md`。
```
【任务】产出在 Ubuntu 灰度机（2 vCPU/4GB，159.223.77.134）上部署现有 standalone 栈所需的模板和脚本，全部放在 deploy/standalone/gray/。不含任何密钥。
1. config.json.example：列出全部字段（占位符），host/publicClientHosts/adminHosts/apiHosts 用灰度域名 testpayease/testadmin/testapi.khmerx.org；PAYEASE_ENV=gray；KHMERX_TEST_MODE 不得为 true（启动会拒绝）。
2. compose.gray.yaml：在现有 compose 基础上加内存上限（应用 1.5G、clamd 1.2G 视扫描机而定）、restart: unless-stopped、日志轮转、PAYEASE_MAX_IN_FLIGHT / PAYEASE_MAX_UPLOADS 环境变量。
3. bootstrap-gray.sh：幂等脚本——创建 /opt/payease/{app,data,clamav}、2GB swap、安装 Docker 与 Compose、UFW 只放 22/80/443；每一步先检查再执行并输出结果。
4. Caddyfile.gray 引用 S4b 的模板（若 S4b 尚未合并，先复制其内容并注明）。
5. healthcheck.sh：依次检查容器状态、127.0.0.1:4300 健康接口、Caddy、磁盘与内存，输出 OK/FAIL；可被 cron 调用，FAIL 时退出码非 0。
6. 部署步骤写进 deploy/standalone/gray/README.md，按"先做什么、验证什么、失败怎么办"排列。
【验收】shellcheck 无错误；脚本重复运行结果一致；README 的每一步都有验证命令。
```

## Q5 S6 客户分片（表 + 仓储 + shadow）　分支 `feat/server/S6`
先读：`docs/contracts/ARC-01-lite-customer-state-rows.md`（全文）、`lib/store.ts`、`lib/domain.ts`、`lib/workspace-payload.ts`、`lib/team/workflow.ts`、`drizzle/` 最新几个迁移、`lib/public-id-store.ts`。
```
【任务】按 ARC-01-lite 实现 §2、§3 的表、仓储层和 CUSTOMER_ROWS=off|shadow|on 开关。本卡只做到"off 行为不变 + shadow 异步写新表 + on 读写新表"，回填与对账是 Q6。
允许修改：新增 drizzle 迁移（customer_workspaces、loan_index，带回退脚本）、新增 lib/customer-shards.ts（仓储层）、lib/store.ts、app/api/h5/state/route.ts（仅接线）、tests/ 新增。
禁止修改：lib/domain.ts 的业务规则；其它路由。
要点：
- 读取时把租户配置（bots/activeBotId/postloan）与客户分片拼成 State 交给现有 customerAction；写回只取分片部分；公开编号只在创建时 claim 一次；on 模式下读路径不再调用 hydratePublicRefs。
- 乐观锁冲突重试耗尽抛 409 CONFLICT；loan_index 与分片在同一次 db.batch 里更新。
- 幂等 requests/requestDigests 保存在分片内。
验收：ARC-01-lite §5 的第 1、2、3 条有测试（第 2 条可用本地 600 虚拟客户并发写测试）；off 模式下现有全部测试通过。PR 超过 400 行必须拆成"迁移+仓储"和"接线+开关"两个 PR。
```

## Q6 S7 回填、反向合并、对账　分支 `feat/server/S7`
先读：ARC-01-lite §4、§5；Q5 产物；`lib/store.ts`。
```
【任务】在 scripts/customer-rows/ 下实现：1) backfill：把现有租户 JSON 里的客户贷款、事件、分录、通知、幂等记录按 customerId 拆进 customer_workspaces，并补 loan_index 与公开编号；幂等、可重复运行、可指定租户与批量大小；2) reverse-merge：把分片合回租户行（回退用）；3) reconcile：逐客户逐字段对比旧 JSON 与新分片，输出差异报告（JSON + 摘要），差异为 0 时退出码 0；4) 造数脚本：生成 5000 个虚构客户的测试数据集。
允许修改：scripts/customer-rows/**、tests/ 新增。
验收：ARC-01-lite §5 第 4、5 条；5000 客户数据集上回填 < 5 分钟；脚本不会修改旧 JSON（只读）。PR 小于 400 行。
```

## Q7 S8 切读 + 员工分页聚合　分支 `feat/server/S8`
先读：ARC-01-lite §3（员工行）、`lib/team/workflow.ts`（scopedState、staffAction）、`app/api/state/route.ts`、`app/api/team/route.ts`、Q5/Q6 产物。
```
【任务】1) 员工按贷款的操作先用 loan_index 找到客户行再读写；2) scopedState() 改为分页聚合（loan_index 状态/时间索引，默认 50、最大 200，批量读取客户行；events/notifications 只返回最近 200 条）；3) 为现有员工列表接口加 page/pageSize 参数，保持不传参数时行为兼容；4) 在预发把 CUSTOMER_ROWS 打开做端到端检查；5) 文档：在 docs/contracts/ARC-01-lite-customer-state-rows.md 末尾追加"员工列表接口"的请求/响应示例，供客户端线使用。
允许修改：lib/team/workflow.ts、app/api/state/route.ts、app/api/team/**（仅分页相关）、lib/customer-shards.ts、tests/、上述契约文档。
验收：ARC-01-lite §5 第 6 条（5000 客户第 1 页 p95 < 500ms）；员工操作的现有测试全通过。PR 小于 400 行，可拆成"后端分页"和"接口兼容"两个。
```

## Q8 上传服务端稳定化　分支 `feat/server/S10a`
先读：`app/api/kyc/files/route.ts`、`lib/kyc/server.ts`（recordFile、scanFile、boundedBody）、`lib/kyc/limits.ts`、`lib/kyc/core.ts`、网关里的 PAYEASE_MAX_UPLOADS。
```
【任务】1) 统一大小限制：图片 ≤ 5MB、PDF ≤ 10MB（lib/kyc/limits.ts 为单一来源，并导出给客户端提示使用），超限返回 413 PAYLOAD_TOO_LARGE；2) 每客户总容量上限（默认 40 份、50MB），超限 409 CONFLICT 带可读 params；3) 扫描服务不可用或超时（30s）时返回 503 SERVICE_UNAVAILABLE 带 retryAfterSeconds，不放行；4) 扫描请求加并发上限（进程内信号量，默认 8，环境变量可调），满了立即 503 + Retry-After，不排队占连接；5) 日志记录每次上传的耗时与扫描耗时（不含文件内容）。
允许修改：app/api/kyc/files/route.ts、lib/kyc/server.ts、lib/kyc/limits.ts、tests/。
验收：对应测试；超限、配额、扫描失败三类错误体符合 ARC-00；现有 KYC 测试全绿。PR 小于 400 行。
```

## Q9 扫描机部署脚本（165.22.108.5，临时承担）　分支 `feat/server/GRAY-2`
```
【任务】在 deploy/clamav-gateway/ 旁新增 deploy/clamav-gateway/gray/：compose（2 个 clamd 实例 + 现有扫描网关，监听私网/公网端口，必须校验 KYC_SCAN_TOKEN 且只允许 159.223.77.134 来源，UFW 规则写在脚本里）、内存上限、特征库更新（freshclam）每日、healthcheck.sh、README。并在 README 开头写明：这台机器是持牌机构灰度机，扫描仅为临时用途，持牌机构系统（M4）开始前必须迁走。
验收：shellcheck 无错误；README 每一步有验证命令；金融服务公司侧只需把 KYC_SCAN_URL 指过来。
```

## Q10 备份脚本　分支 `feat/server/BACKUP`
```
【任务】在 deploy/standalone/gray/ 新增 backup.sh 与 restore.sh：1) 每日把 /opt/payease/data（SQLite 与对象存储目录，文件已加密）用 rclone 同步到另一区域的 DigitalOcean Spaces（桶名、端点、密钥从 /opt/payease/backup.env 读取，文件权限 600，不入库）；2) SQLite 使用 sqlite3 .backup 取一致快照后再上传；3) 保留策略：每日 7 份 + 每周 4 份（可配置）；4) restore.sh 从指定日期恢复到临时目录并运行校验（表数量、最近一条记录时间），输出 OK/FAIL；5) cron 模板与 README；6) 备份失败时退出码非 0 并写日志。
验收：shellcheck 无错误；README 写明一次"备份 → 恢复演练"的完整步骤。
```

## Q11 灰度自动关闭/恢复　分支 `feat/server/GRAY-HOURS`
先读：`deploy/standalone/server.mjs`。
```
【任务】网关读取标记文件（默认 /data/gray-closed，路径可配置）：文件存在时，对所有业务请求返回 503 + 维护页（中/英/高棉三语简短文字，带 Retry-After），但 /healthz 仍然正常；新增 deploy/standalone/gray/gray-hours.sh（close/open 两个子命令创建/删除标记文件）与 cron 模板（周六 17:45 close、周一 08:45 open，服务器时区 Asia/Phnom_Penh，需在 README 里写明如何验证时区）。
验收：测试覆盖"标记存在 → 503 维护页、/healthz 仍 200；标记删除 → 恢复"；README 含演练步骤。PR 小于 400 行。
```

## Q12 按压测报告调优　分支按问题命名
```
【任务】读 scripts/loadtest/reports/ 里最新一轮报告（A/B 两组、100/300/600 三档）和资源采样 CSV，列出按影响排序的瓶颈（每项给数据依据），逐项修复：每个修复一个 PR，PR 描述里写"问题—证据—改动—复测结果"。不得为了数字好看放宽错误处理或限流语义；任何放宽都要写入 docs/tasks/gray-shortcuts.md。
验收：复测同一场景，目标指标见 master-plan §8.2；未达标的项写明原因与下一步。
```

## Q13 S3 安全收口（上生产前）　分支 `feat/server/S3`
灰度阶段后移（决策清单 D-11）。内容见 `docs/tasks/codex-prompts/day1.md` 的 S3 提示词；在 Q1 合并后基于最新 `origin/main` 重新开始，不要使用本地混杂的未提交改动。

## Q14 Flutter CI 返修（PR #8）　分支沿用 PR #8 的分支
先读：`.github/workflows/flutter.yml`、`mobile/pubspec.yaml`、`mobile/pubspec.lock`（末尾的 `sdks:`）。
```
【任务】PR #8 返修：把 .github/workflows/flutter.yml 的 flutter-version 从 '3.29.3' 改为 '3.47.0'（channel: stable）。原因：pubspec.lock 要求 Dart >=3.12、Flutter >=3.44，3.29.3 上 flutter pub get 会失败。在 PR 描述写明原因；合并后用一个故意引入分析错误的临时分支证明 CI 会失败（贴日志或截图后删除该分支）。
验收：PR 上 flutter pub get、flutter analyze、flutter test 全绿；故意出错的分支会让检查失败。提交说明末尾写 Line: app。
```

## Q15 Flutter 错误映射与上传重试（App 线）　分支 `feat/app/D5`
先读：`mobile/lib/core/error/`、`mobile/lib/core/network/`、`mobile/lib/features/kyc/presentation/kyc_controller.dart`、`mobile/lib/l10n/*.arb`、ARC-00 §5–§7、Q8 的上传限制（图片 5MB、PDF 10MB）。
```
【任务】1) 错误映射增加 INTERNAL_ERROR、VALIDATION_FAILED、ACCOUNT_ALREADY_REGISTERED、PAYLOAD_TOO_LARGE，并在 en/km/zh 三份 arb 里补文案；2) 在失败提示里显示 requestId（服务端错误时）；3) 上传遇到 503/429 带 retryAfterSeconds 时退避重试最多 3 次，界面显示"正在重试"；4) 大小限制常量与服务端一致（图片 5MB、PDF 10MB）；5) 补测试。
注意：mobile 下 Dart 源码不得出现中日韩文字（走 l10n）；本卡不改服务端。
验收：flutter analyze 0 问题；flutter test 全绿。PR 小于 400 行。提交说明末尾写 Line: app。
```
