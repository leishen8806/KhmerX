# VPS 灰度上线评估——资料汇总初稿

> 日期：2026-11-06
>
> 结论：当前只能形成“本地验收证据汇总”，不能据此批准 VPS 灰度。全面验收已在本地 standalone + dev harness 完成了若干真实本地会话/接口项目，但仍有明确的阻塞项、模拟项和未执行项；正式环境保持暂停。最终是否上 `159.223.77.134` 由负责人决定，并须按单独的部署/迁移授权执行。

> 2026-11-07 更新：#187、#189、#205、#206、#196、#212 已合并进入当前 main；#204 的三语截图是实际点击语言按钮后得到的 3 个不同 blob，`customer_enter` 已用真实请求验证 Cookie 与 H5 一致，`server.mjs` 已收窄为默认值兼容且仅增加可选运行时配置；#208 已用真实会话和真实接口完成 KYC 员工 UI 审核、`loan.approved` 回调和 checker 复核，放款段在本地临时合入 #211 后 13 项通过、0 失败。当前 main 唯一未闭合的依赖是 #211 尚未合并；#204/#208 仍须按剩余清单取得批准并在最终 main 复跑。

## 1. 决定、范围与不变项

| 项目 | 当前口径 | 出处 |
| --- | --- | --- |
| D-37 合并规则 | 代码 PR 先经 Claude 独立评审，并由 Claude 明确写“Claude 批准合并 #n”；CI 通过（或账单阻塞时按临时本地全量门禁）后才可用普通 merge commit；禁止 squash、强推。迁移、部署配置、资金/放款/还款、部署和线上写操作仍需负责人本人批准。 | `docs/tasks/decision-log.md` D-37；`docs/tasks/approvals/2026-10-29-d37-merge-rule.md` |
| D-38 审计实施 | 审计清单排序实施另行立项；#129 按评审合并。 | `docs/tasks/decision-log.md` D-38 |
| D-39 Plan-R | R-1/R-2 只批准本地可选迁移及本地/备份 dry-run/apply 文档；不得远程、生产、部署或自行合并；合并仍需明确批准。 | `docs/tasks/decision-log.md` D-39 |
| D-40 VPS 范围 | 仅测试 VPS `159.223.77.134`，域名为 `testadmin.khmerx.org`、`testapi.khmerx.org`、`test.khmerx.org`、`testpayease.khmerx.org`；不包括 `165.22.108.5`。部署、迁移、线上写操作须另卡授权。 | `docs/tasks/decision-log.md` D-40；`claude-bridge/pending/full-acceptance-after-deploy.md` |
| D-41 本地先行 | 必须先在本地测试环境全面验收和评审，再决定是否执行 D-40。 | `docs/tasks/decision-log.md` D-41 |
| D-42 | 已补入决策清单：H5 绑定公司并支持手机号登录；Telegram Mini App 使用 Telegram 登录免手机号验证；H5/App 走正常手机号验证；测试阶段统一使用 `123456`，正式环境禁止 demo OTP。 | `docs/tasks/decision-log.md` D-42（PR #213，2026-11-07 合并）；负责人 2026-11-05 原话经 Claude 记录 |
| 方案 A：渠道配置 | Telegram Mini App、H5、App 以公司级渠道记录解析公司归属；结果必须唯一一致，跨来源冲突返回 `CHANNEL_COMPANY_MISMATCH`；不改资金、放款、还款状态机。 | `docs/plans/2026-11-05-company-channel-config.md` |
| 方案 A：后台边界 | 第一阶段只读；密钥只显示 configured/脱敏状态，不回显 secret；写入未来必须 MFA、租户管理员、二人复核和审计。 | `docs/plans/2026-11-05-company-channel-config.md` |
| 09:16 环境范围 | 只做测试环境；`159.223.77.134` 仍未执行 VPS 灰度测试。 | `claude-bridge/pending/full-acceptance-after-deploy.md`（11-06 09:16 补充） |
| 09:18 更正 | 全面验收改为本地 standalone + dev harness，不依赖 VPS 部署；所有修复 PR 必须进 main 且 standalone 能本地启动。验收通过后再整理 VPS 评估交负责人；本地 Telegram 用规则签名的测试 initData，必须标为模拟。 | `claude-bridge/pending/full-acceptance-after-deploy.md`（11-06 09:18 更正） |
| 16:48 环境更正 | `159.223.92.104` 是独立测试环境；负责人授权范围仅包括写入 Demo 认证配置、重启测试服务、用虚构号码验证 `123456`。本任务未访问、未写入、未重启该环境；在负责人评估前仍不把它作为本地或 VPS 证据。 | 负责人 11-06 16:48 授权记录；本卡本地证据 |
| 验收 OTP 边界 | `123456` 只能作为本地/受控灰度 demo 验证码；正式环境禁止 demoCode/demo OTP。现有证据不是短信提供商已接通的证明。 | `docs/plans/2026-11-05-company-channel-config.md`；`claude-bridge/outbox/20261105-1720-02-standalone-boot-acceptance.result.md` |
| H5 规则 | H5 由 host/origin 解析公司，手机号认证和 phone verification 强制开启；demo 仅 local/gray。 | `docs/plans/2026-11-05-company-channel-config.md` |
| Telegram 规则 | 先校验 initData，再按经验证的 bot 标识和公司解析；必须与部署公司一致，冲突 fail-closed 为 `CHANNEL_COMPANY_MISMATCH`，不回退到其他租户。 | `docs/plans/2026-11-05-company-channel-config.md`；`docs/review/h5-miniapp-company-binding-20261105.md` |
| App 规则 | 按 API host + 唯一公司 cookie 解析，保留公司 cookie 隔离；客户端不应跨公司复用 cookie。当前 App 标识头 `X-Payease-Client: app` 只能作为识别信号，不能当作不可伪造的证明。 | `docs/plans/2026-11-05-company-channel-config.md`；PR #206 评审资料 |
| 单公司绑定 | standalone 可在无公司 cookie 时注入唯一 `companies[0]` 作为单公司兼容兜底；多公司环境不能按第一家公司静默猜测，需 `customer_enter` 或显式 host→tenant 映射。 | `docs/review/client-auth-config-audit-20261105.md`；`docs/plans/2026-11-05-company-channel-config.md` |

## 2. 11-05 起已合并 PR

以下合并提交和 PR 状态由当前 GitHub 只读查询确认；“验收关系”只说明它能支持的范围，不等于整体验收通过。

| PR | 解决的问题 | 合并提交 | 验收关系 |
| --- | --- | --- | --- |
| #180 | 拆分 H5 手机认证与 Telegram 渠道运行时，避免认证路径混用。 | `42ae5f4f570bdfb96ad17d4d71b842fa6599506b` | 支持 H5/Telegram 入口分离；不能证明短信提供商已接入。 |
| #182 | 补充 SMS OTP provider 集成设计。 | `74a759796839dbae72db879c25e99ea2e0dbea94` | 作为 OTP 边界和后续接入依据；本身不是短信发送实现。 |
| #183 | 记录后台管理员权限与运行时配置审计。 | `2ab483a0c6dea3c9575bda51803770ff02cadbda` | 支持角色/配置验收的资料口径；不能代替真实后台逐角色点击。 |
| #184 | 展示后台认证状态和公司绑定状态。 | `7911a8328125a9dd7f10e0414b67b9fcf4df687c` | 支持后台状态可见性检查。 |
| #186 | 提供标准化公司渠道配置方案和静态原型。 | `b6a038108f3d56486ea273844e287c2af7fad853` | 提供三渠道、权限、脱敏和语言验收基线；原型数据是虚构值。 |
| #188 | 将 H5/Mini App 绑定到部署公司，阻止跨公司回退。 | `90efe9c16d09b8cf9b4bc8fd2a61dedc01a60764` | 支持 cookie/bot mismatch 拒绝和部署绑定检查；过期 initData 的边界仍需单独记录。 |
| #192 | 支持动态公司 cookie host。 | `6ae15944c066cb55f7ee8b8b7c2a0cba842825b3` | 支持 App/H5 公司 cookie 隔离和动态 host；未证明 VPS 配置正确。 |
| #193 | 本地化 H5 登录文案。 | `33c75acd87b357745d2b0fd7d329d82f0ca1e932` | 支持中文/English/ខ្មែរ 登录入口检查。 |
| #194 | 消费机构审批回调。 | `3a9a34883f5bce68ddbab80fe2f7588d76419972` | 支持机构回调链路的实现基础；真实 testadmin 角色链路仍未完整验收。 |
| #195 | 澄清灰度运行手册的公司前置条件。 | `9a9fb0f9d1250794cad6bc021465d3257c085b40` | 支持上 VPS 前的配置/owner 检查清单。 |
| #197 | 本地化公司渠道错误状态。 | `c6c6194cee088dd4e797bdd9d92ed6de1edd7f5b` | 支持 mismatch、停用等错误态的文案检查。 |
| #199 | 对机构回调 revision conflict 做内联重试。 | `7b603bdb6950e9ad17e5b31cdbfa6961cfb65cf8` | 支持回调并发冲突的可靠性；不代表回调→checker→finance 全链路已真实点击验收。 |

## 3. PR 与验收分支状态

| PR | 当前状态（2026-11-06） | 阻塞/说明 |
| --- | --- | --- |
| #187 | 已合并（`922e8f7`）。 | 渠道迁移已进入当前基线；仍需按本地验收结果核对运行配置。 |
| #189 | 已合并（`131a133`）。 | 服务端渠道解析/API 已进入当前基线；不等于 VPS 配置已核对。 |
| #205 | 已合并（`30df6de`）。 | 后台渠道配置页已进入当前基线；本地只读/脱敏行为仍需专门复核。 |
| #206 | 已合并（`a4d979e`）。 | 渠道状态 guard/UI 已进入当前基线；请求头识别仍有 P2 可伪造风险。 |
| #196 | 已合并（`a29131c`）。 | check-config/部署配置清理已进入当前基线；不构成部署授权。 |
| #212 | 已合并（`b29aca2`）。 | 生成构建产物排除项已进入当前基线；本地 lint 证据通过。 |
| #204 | OPEN；本地验收 harness，最新 head `f96c56c`，CI 通过，未合并。 | 三语截图已由真实语言按钮点击产生 3 个不同 blob；`customer_enter` 已真实验证 Cookie 与 H5 一致；`server.mjs` 已收窄为默认 `/app`、`/data`、4300、`0.0.0.0` 不变，仅增加可选环境变量。因改动 `deploy/**`，合并仍需负责人批准。 |
| #208 | OPEN；roles/institution acceptance 分支，已用真实会话和真实接口完成 KYC 员工 UI 审核、`loan.approved` 回调、checker 复核；放款段在本地临时合入 #211 后 13 PASS、0 FAIL。 | 当前 main 的阻塞仅为 #211 尚未合并；合并 #208 后仍须在最终 main 复跑，不能把 detached 临时验证当成当前 main 已闭环。 |

## 4. 验收矩阵

状态口径：通过 = 当前证据足够支持该项的本地范围；阻塞 = 有证据但有未闭合条件；未执行 = 没有做或不在本次授权范围；失败 = 有可复现失败。`真实`列明确区分真实本地会话/接口、模拟签名/角色事件和完全未执行。

| 范围项目 | 状态 | 证据 | 真实会话/接口还是模拟 |
| --- | --- | --- | --- |
| standalone 启动、`/healthz`、`/readyz`、最新迁移 | 通过 | `claude-bridge/outbox/20261105-1720-02-standalone-boot-acceptance.result.md`；standalone migration/health checks | 真实本地 Node/Miniflare HTTP；不是 VPS。 |
| H5 手机号 + `123456` 登录/注册/会话 | 通过 | `20261105-1720-02`；`20261106-1220-01-local-acceptance-harness.progress.md` | 真实本地 H5/API 会话；验证码是受控 demo，不是短信。 |
| H5 KYC 上传、提交、needs-info、补件、重提、批准 | 通过 | `20261105-1440-01-acceptance-round3-fixups.result.md` | 真实本地浏览器/API，虚构测试数据。 |
| H5 借款、账单确认、签名、申请状态 | 通过/需保留 | `20261105-1440-01-acceptance-round3-fixups.result.md` | 真实本地客户流；`decision_pending` 是当前正确状态，不等于机构批准。 |
| H5 完整客户链路到最终 active | 阻塞（仅剩 #211/main 依赖） | #208 真实会话/真实接口已完成 KYC 员工 UI 审核、`loan.approved` 回调和 checker 复核；#211 临时本地合入后放款段 13 PASS、0 FAIL | KYC 员工段和 checker 段是真实本地会话/接口；放款段仍是临时合入验证，待 #211 合并到最终 main 后复跑。 |
| H5 390px 与三种语言 | 通过 | `claude-bridge/outbox/20261107-1015-01-screens/acceptance-evidence.json`；#204 `f96c56c` | 真实本地 Playwright 浏览器实际点击 English / ភាសាខ្មែរ / 中文；3 个 PNG blob/hash 不同；不代表 VPS 域名。 |
| Telegram Mini App 登录、免手机号验证、同公司 | 通过（本地模拟） | `20261105-1720-02`；#204 signed initData checks | 本地生成测试 bot token，并按 Telegram 规则签名 initData；不是真实 Telegram 设备/机器人会话。 |
| Telegram bot/company mismatch 拒绝 | 通过（本地模拟） | `20261105-1720-02`；`docs/review/h5-miniapp-company-binding-20261105.md` | 本地真实 HTTP 断言，输入和签名材料为测试构造。 |
| Flutter App 手机登录、同公司 cookie | 通过（接口范围） | #204 local acceptance harness；`20261105-1720-02` | 本地 API/dev harness；没有真实 Flutter 设备端到端证据。 |
| App API host + cookie mismatch | 通过（本地接口） | #204；Plan A resolver matrix | 本地接口测试；App 标识头可伪造，见 P2。 |
| `customer_enter` 公司入口 | 通过（本地真实接口） | #204 本地真实 `POST /api/team` → H5 公司 Cookie 一致性证据 | 真实本地请求与 H5 行为；多公司错误公司矩阵仍属于已知风险，不外推为 VPS 证据。 |
| 正式环境不返回 demoCode/demo OTP | 通过（本地启动门禁） | `20261105-1720-02` production/demo startup refusal | 本地配置拒绝检查；未连接正式环境。 |
| 错误 OTP、频率限制 | 通过 | `20261105-1720-02`；#204 | 本地真实接口/harness；不是短信网络。 |
| 过期 OTP | 通过（本地慢跑） | `claude-bridge/outbox/20261107-1015-01-screens/local-acceptance-slow.json` | 真实等待 310000ms 后返回 `VERIFICATION_EXPIRED`；普通 locale 跑仍按设计标为 blocked。 |
| 过期 Telegram initData + 部署绑定 | 阻塞/需明确预期 | `docs/review/h5-miniapp-company-binding-20261105.md`；绑定逻辑把不匹配归为 `CHANNEL_COMPANY_MISMATCH` | 代码/隔离测试边界已记录；未完成 VPS/真实 Telegram 验收，不能据此宣称通过。 |
| 后台 admin/business/reviewer/checker/finance_checker 等角色入口与操作 | 通过（放款依赖 #211） | `claude-bridge/outbox/20261107-1015-01-screens/admin-flows-211.json`；#208 真实会话/真实接口证据；#211 临时合入后放款段 13 PASS、0 FAIL | KYC 员工 UI、`loan.approved` 回调、checker 复核为真实本地会话/接口；#211 仍未合并，不能升级为最终 main 或 VPS 通过。 |
| lender/finance 签名回调边界 | 阻塞 | Plan A 与 pending 范围；无完整真实 testadmin UI/回调验收报告 | 仅设计/模拟或局部接口证据。 |
| 系统配置/渠道页只读、脱敏、语言、产品费率 | 阻塞 | #205/#206 已进当前基线，但本地页面/权限/环境禁用专项复核仍未闭合；#186 是静态原型 | 原型为虚构数据；不能作为 VPS 已部署页面证据。 |
| 机构链：loan.approved→checker→签约→finance→finance_checker→active | 阻塞（仅剩 #211/main 依赖） | `admin-flows-211.json`：#208 真实会话/接口段已完成；本地临时合入 #211 后 13 PASS、0 FAIL | #211 合并前不能作为当前 main 已闭环证据；合并后需最终 main 完整复跑。 |
| audit-seq-verify `seqNull=0` | 通过（本地） | `20261105-1440-01` fresh local D1 verifier：`rows=1 seqNull=0 seqUnique=true orderCheck=passed`；`20261105-1720-02` | 真实本地数据库校验；未在 VPS/正式环境执行。 |
| 备份/恢复等价演练 | 通过（本地等价） | `20261105-1720-02` backup/restore equivalent pass | 本地等价验证；不是远程服务器备份。 |
| VPS 四域名配置、版本/buildId | 未执行 | D-40 和 09:16/09:18 明确范围/顺序；本卡禁止线上写且当前无 `159.223.77.134` 读取证据 | 未执行；不能推断已配置。 |
| 独立测试环境 `159.223.92.104` | 未执行/待负责人窗口 | 11-06 16:48 仅授权 Demo 配置/重启/虚构号码 `123456` 验证；本卡未执行任何远程操作 | 未访问、未写入、未重启。 |

## 5. 已知问题与风险

### P0

1. **尚不能批准 VPS 灰度。** 剩余门槛按依赖顺序为：#211 负责人批准；#204 负责人批准 `deploy/**`；#208 合并；在最终 main 上完整复跑；负责人决定是否部署 `159.223.77.134`。这些门槛完成前不能用 CI 绿灯或临时本地验证替代灰度批准。
2. **迁移/部署/线上写操作的授权缺口。** #187 涉及 `drizzle/**`，#196 涉及 `deploy/**`；任何迁移、部署、服务器/DNS/Cloudflare 配置和线上写入都不能由本报告代批。
3. **最终 main 尚未完成机构金融链路闭环。** #208 的 KYC 员工 UI、`loan.approved` 回调和 checker 复核已有真实会话/接口证据；放款段仅在临时合入 #211 后 13 项通过，待 #211 合并后在最终 main 复跑。

### P1

1. **短信 OTP 尚未接入。** #182 是 provider 设计文档；当前 `123456` 是受控 demo 验证码，不能当作短信发送/送达证据。
2. **#211 仍需负责人批准。** 临时本地验证有 13 PASS/0 FAIL，但 #211 未进入最终 main，不能把临时合入升级为当前基线。
3. **多公司 `customer_enter` 矩阵仍需补齐。** #204 已真实验证 Cookie 与 H5 一致；owner/错误公司矩阵和部署环境证据仍未完整闭合。
4. **VPS 配置、buildId、域名和迁移状态尚未核对。** 本地 standalone 通过不等于 `159.223.77.134` 已运行同一 main。
5. **本地 Docker 不可用。** 1720-02 用独立 Node/Miniflare standalone 做等价验证；这不是 Docker/VPS 部署证据。
6. **App header spoof、过期 initData 错误边界、H5 RSC prefetch `TypeError: m is not a function`、channels 页面只读/环境禁用行为仍为 P2/后续复核。** 这些不应被当前本地截图或 lint 证据覆盖。
7. **独立测试环境 `159.223.92.104` 尚未验证。** 虽已获 16:48 的受限 Demo 配置授权，但本卡未执行远程操作；`159.223.77.134` 仍完全未动。

### P2

1. **App 请求头可伪造。** `X-Payease-Client: app` 是识别信号，不是密码学认证；在 H5/App 必须严格分开时需要签名或版本证明。当前同公司、同规则时影响有限，但不能当作强隔离。
2. **部署绑定与过期 initData 的错误边界。** 过期/不再可验证的 initData 可能落入统一 `CHANNEL_COMPANY_MISMATCH`；需要在受控时间和实际部署配置下确认用户可理解的错误文案，而不是把它记为成功或错误公司。
3. **本地 H5 `/h5` 仍有 RSC prefetch `TypeError: m is not a function` 复现记录。** 当前被报告为非阻塞 follow-up；需在真实发布构建前复核。
4. **#204 的 deploy/** 合并仍需负责人批准。** `server.mjs` 已收窄为向后兼容的可选运行时配置，但部署配置路径仍不适用 Claude 代批规则。

## 6. 上 VPS 灰度前的剩余事项

### 负责人必须决定/执行

1. 负责人批准 #211；资金回调仍不得由本报告代批。
2. 负责人批准 #204 的 `deploy/**` 改动；`server.mjs` 已收窄为默认行为不变、仅增加可选环境变量。
3. 在依赖满足后合并 #208；#208 的真实会话/接口验收和 #211 临时本地 13 PASS 不能替代合并。
4. 在最终 main 上完整复跑本地 standalone + dev harness，并记录精确 commit/buildId、三语 distinct blobs、`customer_enter` Cookie 一致性及机构链路结果。
5. 负责人依据最终 main 复跑结果，单独决定是否部署 `159.223.77.134`；部署、迁移和回滚窗口仍需负责人/OPS 另行执行和授权。

### 已知风险（不改变上述剩余事项）

- 短信 OTP 尚未接入真实提供商，`123456` 仅限本地/受控灰度 demo。
- 真实 Telegram 机器人、App 请求头可伪造、过期 initData 错误码、后台渠道配置只读等风险仍需单独跟踪。
- 正式环境和 VPS 均未因本报告获得部署授权；本报告不执行任何线上写操作。

### 在本地/合并前应补齐

1. 按上述依赖顺序完成 #211 approval、#204 deploy/** approval、#208 merge，避免把 detached 临时验证当成当前 main。
2. 最终 main 复跑时保留 `customer_enter` 成功/错误公司、真实后台角色矩阵、机构链路和三语 distinct blobs 的可审计证据。
3. 保留短信 OTP、真实 Telegram、App header spoof、过期 initData 和 channels 只读/环境禁用等已知风险，不将本地证据外推成 VPS 通过。

### 灰度执行后（不属于当前授权）

仅在负责人另行授权后，按 D-40 测试域名做只读/验收检查；本报告没有执行 VPS 写操作、部署、DNS/Cloudflare 改动或正式环境操作。

