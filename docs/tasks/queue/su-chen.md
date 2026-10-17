# 苏晨的任务队列（唯一执行人：服务端 + 客户端 + App 全部在这里）

通用规则见 `_common.md`。自 2026-10-15 起所有任务由苏晨一个人（一个 Codex 会话为主）执行，大旺的队列已并入本文件（决策清单 D-21）。
提交说明末尾按任务写 `Line: server`、`Line: client` 或 `Line: app`；分支前缀 `feat/server/`、`feat/client/`、`feat/app/`。

## 容量说明（必读）
剩余未完成的工作量约 **27 人天**，而 15 个工作日一个人只有约 15 人天（Codex 的实际提效未经实测）。所以任务分成三档，**严格按档位顺序做，不跳档**：
- **第一档：必做**（支撑闸门 A→E 的关键路径，合计约 14–15 人天，已无余量）。
- **第二档：有余力再做**（第一档全部合并之后才开始）。
- **第三档：延期到第 15 天之后**（不在本期计划内；如要提前，需技术负责人明确指示并说明从哪里挪时间）。
任何一张第一档的卡落后超过半天，立即在状态文件里写明，并给出"缩范围 / 顺延"选项，由技术负责人决定。

## 第一档：必做
| 序 | 卡 | 期限 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | Q1 S2 返修（PR #16） | 第 1 天 | — | 已修，等待合并 |
| 2 | Q2 S4b 返修（PR #14） | 第 1 天 | — | 已修，等待合并 |
| 3 | Q14 Flutter CI 返修（PR #8，`Line: app`） | 第 2 天 | — | 已验收，证据见 `../status/2026-10-16-Q14-ci-acceptance.md` |
| 4 | L1-A fixture + L1-B rows 场景（见 L1 契约修订，`Line: server`） | 第 2–3 天 | — | ☐ |
| 5 | Q4 灰度机部署模板与脚本（并由苏晨在服务器上部署） | 第 2–4 天 | Q2 | ☐ |
| 6 | L2 灰度机压测执行与报告（原 P10，人工 + 脚本） | 第 3 天首轮；第 11–12 天复测 | Q4、L1、L1-G | ☐ |
| 7 | Q5 S6 客户分片（表 + 仓储 + shadow） | 第 5 天 | Q1，ARC-01-lite | ☐ |
| 8 | Q6 S7 回填、反向合并、对账 | 第 7 天 | Q5 | ☐ |
| 9 | Q7 S8 切读 + 员工分页聚合 | 第 8 天 | Q6 | ☐ |

已合并、不再做：Q3（S-LT1，#13）、D1 返修（#12）、Flutter 入库（#11）、上传压缩与重试（D7a，#9）。

## 第二档：有余力再做（第一档全部合并后才开始）
| 序 | 卡 | 说明 |
|---|---|---|
| 10 | Q8 上传服务端稳定化 | 网关已有过载保护，本卡补配额、扫描并发上限与统一大小限制 |
| 11 | Q11 灰度自动关闭/恢复 | **如果不做，10-31 至 11-02 周末不得有灰度用户，或由技术负责人手动停服务**（决策清单 D-08） |
| 12 | Q12 按压测报告调优 | 取决于 L2 的报告 |
| 13 | Q10 备份脚本 | 灰度数据为虚构（D-02），优先级低于上面几项 |

## 第三档：延期到第 15 天之后
Q9 扫描机部署（灰度先让扫描与应用同机，有内存争用风险，已在 master-plan 登记）；P5 错误码多语言（D4，`Line: client`）；Q15 Flutter 错误映射与上传重试（`Line: app`）；P9 管理后台员工列表分页（D6，`Line: client`）；Q13 S3 安全收口。这些卡的提示词保留在本文件末尾，提前启动需要技术负责人指示。

人工操作（不是 Codex 任务，苏晨在服务器上做）：第 2–4 天按 Q4 的产物在 159.223.77.134 部署并让 `testapi.khmerx.org` 不再返回 521；第 11–12 天压测时在 159.223.77.134 上运行采样脚本、在 165.22.108.5 上运行压测。

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


---

## L1 压测：fixture 与 rows 场景（已按契约修订，拆为 L1-A / L1-B）
**唯一依据：`docs/tasks/codex-prompts/L1-rows-loadtest-revision.md`**（契约 v2，冻结两种场景、虚构账号/会话 fixture、重试与统计口径、安全顺序、验收）。旧版"600 虚拟客户 创建→保存资料→提交"的描述作废：KYC 保存/提交不写客户分片，B0 的 600 VU 只对应 100 个身份。

- **L1-A**　分支 `feat/server/L1-A`（`Line: server`）：fixture、manifest、预检、清理。提示词见契约 §10。
- **L1-B**　分支 `feat/server/L1-B`（`Line: server`，依赖 L1-A 评审通过，可堆叠）：rows 场景、统计、本地 50 客户验收。提示词见契约 §10。
- 范围：**仅本地 harness 与单元测试**；灰度执行与 fixture 写入由人工完成，Codex 不得操作 159.223.77.134 / 165.22.108.5。灰度运行另被 Q4 返修（灰度 config 样例无法启动，契约 OPEN-2）阻塞。
- 已有 B0/B0b 脚本的推送（原 P1 的 README 机器分工、--origin-ip/--host、报告字段）若 main 尚缺，另用小 PR 处理，不得与 L1-A/L1-B 混合；`b0-main-flow.js` 在 L1-B 中不得修改。

---

## L1-G 灰度 fixture 与灰度压测入口（拆为 L1-G1 / L1-G2）
**唯一依据：`docs/tasks/codex-prompts/L1-G-gray-fixture.md`**（在 L1 契约基础上新增 `gray-config` 档、`db-check`、灰度压测放行；rows 流程、统计口径、数据集、清理规则沿用 L1 契约）。
- **L1-G1**　分支 `feat/server/L1-G1`（`Line: server`）：fixture 的 gray-config 档 + db-check + 本机 Docker（node:22.22.1，无网络）测试。
- **L1-G2**　分支 `feat/server/L1-G2`（`Line: server`，依赖 L1-G1 评审通过，可堆叠）：rows 脚本的灰度放行（直连源站、仅直连时跳过证书校验）与测试。
- 范围：**仅代码与本机测试**；不得操作 159.223.77.134 / 165.22.108.5，不得访问任何 khmerx.org 域名。灰度执行是人工步骤，条件见契约 §9，且每个窗口需 owner 批准。

---

## L1-G3 db-check 绑定 manifest（小卡，不阻塞灰度窗口）
**唯一依据：`docs/tasks/codex-prompts/L1-G3-dbcheck-binding.md`**。分支 `feat/server/L1-G3`（`Line: server`）：`db-check` 输出新增 `runId`、`binding`、`checkedAt`，`verify-rows` 校验绑定，拒绝旧 9 键格式与取自其他运行的 JSON。仅本地代码与测试，不得操作灰度/VPS。

---

## 现有检查错误修复队列（R1 → R2 → R3）
基线 `461d070`：`npm test` 1 失败、typecheck 1 错误、lint 2 errors。**执行顺序固定：R1 → R2 → R3**；不改变上方各卡状态，不把任何灰度操作标记为可执行。
- **R1**　`docs/tasks/codex-prompts/R1-notification-retry-audit.md`　分支 `fix/server/notification-retry-audit`（`Line: server`）：补 `audit` 导入，修复运行时失败与 typecheck 的同一根因；R1-B（审计原子性）为可选的单独分支。
- **R2**　`docs/tasks/codex-prompts/R2-locale-render-refs.md`　分支 `fix/client/locale-render-refs`（`Line: client`）：消除两处渲染期写 ref 的 lint error，不降级规则。
- **R3**　`docs/tasks/codex-prompts/R3-full-recheck.md`：R1、R2 合并后做全量复核，只出报告。
- 仅本机 Docker（`node:22.22.1-bookworm-slim`，`--network none`）验证；L2/Q12、灰度/VPS 仍为 HOLD。
- **状态（2026-10-17）：R1-A、R1-B（#58，Claude 评审通过，P0/P1 为 0）、R2、R3 均已合并，修复队列关闭。** 证据范围：本机 SQLite 适配器与 Miniflare D1；**未做远端 D1 验证**。L2/Q12、灰度/VPS 仍为 HOLD。

---

## L2 灰度机压测执行与报告（人工 + 脚本）
```
前提：159.223.77.134 已部署并且 testapi.khmerx.org 不再返回 521；S4b、S-LT1 已合并；灰度机 PAYEASE_ENV=gray。
步骤：1) 苏晨在 159.223.77.134 启动 sample-resources.sh；2) 大旺在 165.22.108.5 运行压测，A 组（限流保持现状）、B 组（放宽租户限流）各跑 100/300/600；3) 报告与资源采样 CSV 提交到 scripts/loadtest/reports/，把分支名发给 Claude 做闸门评审；4) 第 11–12 天按调优后的版本复测。
```

---

## 延期卡（第三档）

## P5（延期） 错误码多语言　分支 `feat/client/D4`（P2 合并后）
先读：`docs/contracts/ARC-00-error-and-envelope.md` §5、`app/h5/login.tsx`、`lib/i18n.tsx`（只读，不要改它）、`lib/admin-i18n.tsx`、`lib/api-client.ts`。
```
【任务】1) 新建 lib/error-messages.ts（en/km/zh 三份错误文案表，key 为错误码，覆盖 ARC-00 第 3、6、7 节所有 code，未知 code 回退到 REQUEST_FAILED）；2) 提供 messageForError(error, locale) 工具函数；3) 客户端所有展示错误的位置改为按 code 取文案，不再显示服务端中文 error 原文；4) 删除 app/h5/login.tsx 里 message.includes('请使用验证码或密码登录') 的判断，改为判断 ApiClientError.code === 'ACCOUNT_ALREADY_REGISTERED'；5) 监听 khmerx:auth-required：回到登录页并保留返回地址，登录相关页面本身不触发；6) 显示 requestId（SERVICE_UNAVAILABLE / INTERNAL_ERROR 时）。
禁止修改：lib/i18n.tsx。
验收：缺任何一个 code 的文案时测试失败；三种语言覆盖一致；界面不再出现服务端中文 error 原文。PR 小于 400 行。
```

## P9（延期） 管理后台员工列表分页　分支 `feat/client/D6`
先读：`docs/contracts/ARC-01-lite-customer-state-rows.md`（含 Q7 追加的"员工列表接口"示例）、`app/team/client.tsx`、`app/workspace.tsx`。
```
【任务】管理后台的客户/贷款列表适配分页接口（page、pageSize，默认 50）：加载下一页、显示总数与当前页；切换筛选时回到第 1 页；加载与失败状态完整；不传分页参数时旧行为不变。
允许修改：app/team/client.tsx（仅列表相关）、components/ 下列表组件、tests/。不要重构无关代码。
验收：列表在 5000 条数据下滚动与翻页流畅（给出本地截图或测量）；现有后台测试通过。PR 小于 400 行。
```