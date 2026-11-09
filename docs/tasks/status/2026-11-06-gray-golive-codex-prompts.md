# 灰度上线前置：Codex 任务卡（2026-11-06）

依据：`docs/tasks/status/2026-11-06-gray-golive-readiness.md`（下称"就绪评估"）。基线：`origin/main` = `6ae15944c066cb55f7ee8b8b7c2a0cba842825b3`（`6ae1594`，PR #192，2026-11-06 14:12）。每张卡开工前先 `git fetch origin`；如果 `origin/main` 已经不是这个提交，就在报告第一行写明实际提交，以及与 `6ae1594` 之间新增的提交列表。
执行人：苏晨的 Codex。每张卡单独粘贴，彼此独立，可以并行；GL-3 随时可做。
规范来源：`docs/tasks/queue/start-codex.md`、`docs/tasks/queue/_common.md`、`docs/tasks/codex-workflow.md`，全部规则对每张卡都适用。
**GL-4 不能凭本文件开工**：D-34 的历史授权不解除当前的 VPS HOLD，执行前必须有技术负责人在当前对话中对 GL-4 的明确 SSH 只读授权。本文件**不批准任何部署、迁移或线上写操作**。

| 卡 | 内容 | 是否碰服务器 | 合并条件 |
|---|---|---|---|
| GL-1 | 本地运行时复验（就绪评估 G1） | 否 | 只改 `docs/review/**`，Claude 验收证据 |
| GL-2 | 灰度配置模板与文档修正（G2、G3） | 否 | 改动 `deploy/**`：Claude 评审后须**技术负责人本人批准**合并（D-37） |
| GL-3 | 提交就绪评估与本文件 | 否 | 纯文档 |
| GL-4 | 灰度机只读预检（G4-b） | 是，SSH **只读**；**须当前对话中的明确授权** | 只改 `docs/tasks/status/**` |

---

## GL-1　本地运行时复验（就绪评估 G1）

```
【卡】GL-1 本地运行时复验　分支：docs/review/gray-golive-g1-20261106　Line: server
【目标】在本机（Windows 开发机）上，用最新 origin/main 跑出灰度上线前的运行时证据。只采集证据，不修代码。

【准备】
1. git fetch origin；git worktree add ../wt-GL-1 -b docs/review/gray-golive-g1-20261106 origin/main；之后的所有操作都在 ../wt-GL-1 里做。
2. 记录 `git rev-parse HEAD`（应为 6ae1594 或更新的提交），写进报告第一行。
3. 先读：docs/tasks/status/2026-11-06-gray-golive-readiness.md（如果 main 上还没有，就读主目录里的未提交副本）、docs/review/acceptance-20261103.md、docs/review/acceptance-p2-20261105.md、docs/review/client-auth-config-audit-20261105.md、docs/review/institution-callback-wiring-20261106.md、scripts/dev-app-backend/README（或 start.mjs 头部注释）。

【必须产出的证据】每一项都写清楚：命令、关键输出、通过或失败。
E1 全新状态：确认 worktree 里没有 .wrangler/state。
   - 依赖安装受"不得联网安装依赖"的约束：只允许 `npm ci --offline`（只用本机缓存）。
   - 如果离线安装失败，**停止本卡**，报告缺少哪些包，并请求技术负责人批准一次联网 `npm ci`（锁定文件、不新增依赖）。不得改用联网安装，也不得复用版本不一致的 node_modules。
   - 安装成功后，用 scripts/dev-app-backend/start.mjs 启动，日志里要能看到 `dev migrations applied: 63`。
E2 审计 seq（复验 P1-1）：
   - 用 Playwright 或手工：登录本地后台（虚构 checker/admin 账号），把所有菜单各打开一次，再执行一次员工写操作（例如 KYC 跟进备注）。
   - 运行 `node scripts/audit-seq-verify.mjs --db <本地 sqlite 路径>`，要求 seqNull=0。
   - 再新建一份 v3 清单，要求 version=3 且 match=true。
E3 客户全流程（复验 P3-2）：用虚构客户走完 注册 → KYC 提交 → 审核通过 → 申请贷款 → 签名机构回调 loan.approved → 复核员（checker）复核 → 签约 → 测试放款 → 部分还款。
   - 每一步记录贷款状态，不能停在 kyc_approved。
   - 机构回调用测试里现成的签名方法（参照 tests/team-integration.test.mjs），不要另写签名代码。
   - 另外验证 loan.rejected 和重复回调各一次：重复回调要幂等，不能产生第二次状态变化。
E4 D-42 门禁：
   (a) 375px 宽度下 /h5 登录页的 zh/en/km 三张截图；
   (b) H5 demo 模式：虚构号码 +12025550100 用 123456 能登录；
   (c) 负向：PAYEASE_H5_AUTH_MODE 不是 demo，或 PAYEASE_DEMO_OTP_ALLOWED 不是 true 时，123456 必须被拒绝，且响应里没有 demoCode；
   (d) 带 initData 的 Mini App 请求不返回 demoCode（可以用现有单测或 fixture 证明，写明用的是哪个）。
E5 全量门禁：npm test、npm run typecheck、npm run lint、npm run check:client-boundary、npm audit --omit=dev。贴摘要，要求漏洞数为 0。

【交付】
- 新建 docs/review/gray-golive-g1-20261106.md：报告第一行写基线提交；每项 E1–E5 一节，写明通过/失败、证据位置；最后写结论（全部通过 / 哪项失败）。
- 截图放在 docs/review/assets/gray-golive-g1-20261106/，并列出每张截图的 SHA-256。
- 只提交这两个位置的文件。推送分支后，把分支名发给 Claude 验收。

【禁止】
- 修改任何代码、迁移、部署配置。发现缺陷时：在报告里写清"复现步骤 / 实际结果 / 预期结果"，标为 P0 或 P1，然后继续做其余各项；不要自己修，修复另开卡。
- **立即停止（不是继续）**：任何一步需要连接服务器或 VPS、请求 khmerx.org 的任何域名、使用真实手机号，或向 Telegram/Gateway 发出请求时，立即停止本卡并报告，不要寻找绕过办法。
- 访问任何 VPS 或 khmerx.org 域名；向真实手机号或 Telegram 发送任何东西。
- 只用虚构数据，不把令牌、cookie、验证码以外的敏感值写进报告。
- 跳过的测试不算通过；做不到的项写"未完成"，并说明原因。
```

---

## GL-2　灰度配置模板与文档修正（就绪评估 G2、G3）

```
【卡】GL-2 灰度配置模板修正　分支：feat/server/GL-2-gray-config-origins　Line: server
【注意】本卡改动 deploy/**。按 D-37，Claude 评审通过后，还须技术负责人本人批准才能合并。PR 描述第一行写上这一点。

【目标】
1. 灰度配置模板显式包含 PAYEASE_ALLOWED_ORIGINS（D-26），并由 check-config.mjs 强制检查；
2. 修正文档里"灰度 KHMERX_TEST_MODE=true"的错误描述，与代码一致。

【先读】lib/request-security.ts（PAYEASE_ALLOWED_ORIGINS 的解析：逗号分隔、精确匹配）、deploy/standalone/gray/config.json.example、deploy/standalone/gray/check-config.mjs、deploy/standalone/gray/README.md、docs/review/client-auth-config-audit-20261105.md、提交 829c834 的说明、decision-log D-26。

【允许修改】
- deploy/standalone/gray/config.json.example
- deploy/standalone/gray/check-config.mjs
- deploy/standalone/gray/README.md
- docs/review/client-auth-config-audit-20261105.md（只追加一段"2026-11-06 更正"，不改原文）
- tests/ 下与 check-config 相关的测试（已有就改，没有就新增 tests/gray-check-config.test.mjs）

【要求】
1. config.json.example 的 bindings 增加：
   "PAYEASE_ALLOWED_ORIGINS": "https://testpayease.khmerx.org,https://testadmin.khmerx.org,https://test.khmerx.org"
   先核对 request-security.ts 的格式（是否带协议、能否有尾斜杠），以代码为准。
2. check-config.mjs 增加检查，以下情况都要失败并给出清楚的提示：
   - 缺少 PAYEASE_ALLOWED_ORIGINS；
   - 含有非 https 的来源；
   - 含有不在灰度域名集合里的主机（尤其是 payease/admin/api.khmerx.org 这几个正式域名）；
   - 含有通配符。
   集合里的值必须是 config 里 publicClientHosts 的子集。
3. README.md 第 49–50 行附近：改为与 check-config 一致——灰度为 KHMERX_TEST_MODE=false + PAYEASE_DEMO_OTP_ALLOWED=true + PAYEASE_H5_AUTH_MODE=demo + PAYEASE_IDENTITY_PROOF_REQUIRED=true，并补一句原因（test mode 会同时放宽 MFA 和双人复核）。README §2 里加上 PAYEASE_ALLOWED_ORIGINS 的说明，以及"冒烟测试时从真实页面来源发起一次写请求"的验证步骤。
4. 测试至少覆盖：合法配置通过；缺键、http 来源、正式域名、通配符这四种情况各失败一次。
5. 不改 lib/**、app/**、生产模板、compose 或 Caddy 文件。

【自查】npm test、npm run typecheck、npm run lint、npm run check:client-boundary；另外对 config.json.example 跑一次 check-config.mjs，确认它按设计报"样例不可部署"（README 说样例必须写明 NOT DEPLOYABLE，行为不要改）。
【交付】PR 描述写"做了什么 / 没做什么 / 假设 / 风险 / 回退方法"，然后把分支名发给 Claude。
```

---

## GL-3　提交就绪评估与本文件

```
【卡】GL-3 提交灰度就绪文档　分支：docs/tasks/gray-golive-20261106　Line: server
【目标】把主工作目录里两个未提交的文档放进一个文档 PR。
1. git fetch origin；git worktree add ../wt-GL-3 -b docs/tasks/gray-golive-20261106 origin/main。
2. 从主工作目录 E:\KhmerX\KhmerX 原样复制这两个文件到 worktree 的相同路径（内容不改）：
   - docs/tasks/status/2026-11-06-gray-golive-readiness.md
   - docs/tasks/status/2026-11-06-gray-golive-codex-prompts.md
3. 只 git add 这两个文件。主目录里的其他未跟踪文件（.codex-apply-test.txt、docs/tasks/orchestration/、K-R1 提示词、2026-10-24 状态文件）不要碰，也不要删除。
4. 不改 decision-log.md：就绪评估里 G4 的各项决定要等技术负责人回复，由 Claude 另行记录。
5. 提交、推送，开 PR，把分支名发给 Claude。
```

---

## GL-4　灰度机只读预检（就绪评估 G4-b）

```
【卡】GL-4 灰度机只读预检　分支：docs/tasks/gray-preflight-20261106　Line: server
【授权范围】D-34：Codex 经 SSH 访问灰度机 159.223.77.134，仅限只读。
- 不得停止、重启、重建任何容器；
- 不得写入、复制、移动、删除任何文件；
- 不得安装任何软件包；
- 不得修改配置，不得执行迁移；
- 不得访问 165.22.108.5 或 159.223.92.104。
任何一步需要写操作才能继续时，立即停止并报告。

【要回答的问题】
Q1 灰度库是否已经执行过迁移 0062（就绪评估 G4-b 的前提）？
   - 只读定位 /opt/payease/data 下的 D1 SQLite 文件（列出路径和大小）。
   - 如果主机上已有 sqlite3，就用只读方式打开（例如 `sqlite3 "file:<路径>?mode=ro" "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5;"`；表名以实际为准，先 `.tables` 确认）。
   - 报告最近 5 条迁移名，以及是否包含 0062。
   - 没有 sqlite3 时不要安装，写"无法验证：主机无 sqlite3"，并给出 OPS 人工核对的命令。
Q2 当前运行的是哪个制品：容器名、镜像 ID、创建时间；/opt/payease 下是否有 BUILD_INFO 及其内容（D-29 / O2 的问题是否仍然存在）。
Q3 资源余量：df -h、free -m、docker ps 的状态（只读）。
Q4 当前生效配置里是否有 PAYEASE_ALLOWED_ORIGINS、KHMERX_TEST_MODE、PAYEASE_DEMO_OTP_ALLOWED、PAYEASE_H5_AUTH_MODE 这四个键。
   - **只报告键是否存在，以及非密钥键的取值**；任何 token、secret、key 的值一律不输出、不记录。

【交付】
- 在 worktree（基于 origin/main）里新建 docs/tasks/status/2026-11-06-gray-preflight-readonly.md：
  - 每个问题写结论和命令输出摘要；
  - 第一行写操作时间（Asia/Phnom_Penh）以及"只读，未做任何写操作"的声明。
- 只提交这一个文件。推送分支，把分支名发给 Claude。
```
