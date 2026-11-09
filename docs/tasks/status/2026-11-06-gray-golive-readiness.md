# 灰度上线就绪评估与窗口运行单（2026-11-06）

作者：Claude。基线：`origin/main` = `6ae1594`（PR #192，2026-11-06 14:12）。§2 的核对最初基于 `b1aad82`（PR #203）；之后新增的 9 个提交见 §2.1。范围：D-40 灰度——金融服务公司 VPS `159.223.77.134`，域名 `testpayease` / `testadmin` / `testapi` / `test.khmerx.org`，**只用虚构数据**。
本文**不批准任何窗口**；部署、迁移、线上写操作仍须技术负责人逐项书面批准（D-37）。服务器操作由 OPS / 苏晨人工执行（D-34）。

## 1. 结论
代码侧**可以进入灰度准备**，但开窗前还有 4 项必须完成（§3 G1–G4），其中 G1 必须在 Windows 开发机上跑出运行时证据，G4 是你的决定。

## 2. 已核对（Claude，只读，基于 `b1aad82`）
| 项 | 结论 | 依据 |
|---|---|---|
| P1-1 审计 `seq` 为 NULL（11-03 验收阻塞） | **代码层已关闭**：`app/`、`lib/` 中对 `team_audit` 的写入全部经过 `lib/team/audit-writer.ts`（`seq = MAX(seq)+1`，唯一索引兜底）；唯一的裸 `INSERT` 在历史迁移 `0013`，由 0062 的回填覆盖 | `git grep` 全量扫描 |
| P3-2 客户贷款停在 `kyc_approved` | **根因已修**：机构审批回调原先只入库不消费，#199（`f0d41ff`、`d074863`）补上消费与版本冲突重试；复核员（checker）第二人门禁保留 | `docs/review/institution-callback-wiring-20261106.md` |
| 单元测试 | 529 通过 / 0 实际失败 / 19 跳过（需要 workerd）。在 Linux 导出副本上有 2 个失败，均为环境原因（非 git 目录；`core.autocrlf=true` 产生 CRLF），修正后通过 | `node --test tests/*.test.mjs` |
| `9701b1e`、`01daad0`（D-37 补评审） | 代码**可接受**：登录、登出、SSO、引导、KYC 跟进均改走共享写入器；`auth/route.ts` 中的 `auditInsertSql` 来自 `lib/team/server.ts` 已绑定 `db` 的包装函数，参数正确；`INSERT OR IGNORE` 冲突时调用方会回读并在缺失时报 409，不会静默丢记录。**但 `9701b1e` 原地修改了 `drizzle/0062`**，见 G4 | `git show` |
| 机构后台域名 | 不阻塞：D-40 只含 4 个域名，机构员工从 `testadmin` 的 `/team/login` 切换"持牌机构后台"登录 | `deploy/standalone/gray/check-config.mjs` |
| 灰度部署模板 | 已齐：`deploy/standalone/gray/`（bootstrap、check-config、compose、Caddy、备份/恢复、健康检查、营业时段、verify-artifact） | — |

### 2.1 `b1aad82..6ae1594` 增量（PR #197、#192）
- `lib/h5-auth-core.ts`、`lib/registration-policy.ts`、`app/api/h5/auth/account/route.ts`：只给错误增加错误码（`VERIFICATION_RATE_LIMITED`、`VERIFICATION_EXPIRED`、`REGISTRATION_STEP_DISABLED`）；demo 验证码门禁和限流阈值**没有变化**，§2 的结论不受影响。
- **#192（Flutter 公司渠道配置）需要补评审**：
  - `company_channel_config.dart` 允许 `apiBaseUrl` 使用 `http`；
  - `whitelist_cookie_jar.dart` 发送 cookie 的主机改由配置里的 `cookieHosts` 决定，代码层没有与 `hosts`/`origins` 或固定白名单交叉校验。
  - 如果这份配置能被远程下发或篡改，App 的会话 cookie 可能经明文发送，或发往非预期主机。
  - 这一项**不阻塞 H5 灰度**，但 App 接入灰度前必须由 Claude 评审，并确认配置来源。

## 3. 开窗前必须完成
### G1 运行时复验（苏晨 / Codex，在 Windows 开发机上，本地，不碰 VPS）
1. 全新 `.wrangler/state` → 启动脚本输出 `dev migrations applied: 63`。
2. 浏览器登录后台、打开各菜单，再运行 `node scripts/audit-seq-verify.mjs --db <sqlite>` → 要求 `seqNull=0`；新建 v3 清单 → `match=true`。（复验 P1-1）
3. 客户全流程：注册 → KYC → 审核通过 → 申请 → 签名回调批准 → 复核员复核 → 签约 → 测试放款 → 还款；状态逐步推进，不停在 `kyc_approved`。（复验 P3-2）
4. D-42 门禁：375px 三种语言登录截图；H5 全流程；**非 demo 模式下 `123456` 被拒绝**的负向证据；Mini App 请求不返回 `demoCode`。
5. `npm audit --omit=dev` = 0，且使用与构建机相同的 `package-lock.json`。
证据放到 `docs/review/`，由 Claude 验收。

### G2 配置文档矛盾（GL-2 本地修模板和文档；实际配置由 OPS 在窗口内写入）
分工：GL-2（Codex）只在本地修改 `deploy/standalone/gray/` 下的模板、检查脚本、README 和测试，不碰服务器；灰度机上 `/opt/payease/data/config.json` 的实际写入，由 OPS 在获批的部署窗口内人工执行（§4 第 4 步），并以 `check-config.mjs` 通过为准。
`deploy/standalone/gray/README.md` 第 49–50 行和 `docs/review/client-auth-config-audit-20261105.md` 写的是灰度 `KHMERX_TEST_MODE=true`，但代码（`829c834` 之后的 `check-config.mjs`）要求的是：
`KHMERX_TEST_MODE=false` + `PAYEASE_DEMO_OTP_ALLOWED=true` + `PAYEASE_H5_AUTH_MODE=demo` + `PAYEASE_IDENTITY_PROOF_REQUIRED=true` + `PAYEASE_ENV=gray`。
**以 `check-config.mjs` 和 `config.json.example` 为准**（test mode 还会放宽 MFA 和双人复核，不应打开）。文档修正可单独提一个 docs PR。

### G3 `PAYEASE_ALLOWED_ORIGINS`（D-26，仍待核实）
`config.json.example` 没有这个键。未设置时，允许来源只有请求自身来源加两个正式域名。只要页面和 API 跨域（例如页面在 `testpayease`、API 在 `testapi`），写请求就会返回 403 `CROSS_SITE_REQUEST`。
建议灰度配置：`https://testpayease.khmerx.org,https://testadmin.khmerx.org,https://test.khmerx.org`。冒烟测试时必须**从真实页面来源发起一次写请求**来验证。

### G4 需要技术负责人决定
| 编号 | 决定 | Claude 建议 |
|---|---|---|
| G4-a | 批准 0062 在部署时对**所有** `team_audit` 行执行回填（超出 D-39 "R-2 仅本地/备份"的范围） | 批准，仅限灰度虚构数据。回填按 `(created_at,id)` 排序，灰度可接受；改为按 `rowid` 排序留到生产前再定 |
| G4-b | 追认 `9701b1e` 原地修改 0062 | 追认，**附条件**：部署前确认灰度库的 `d1_migrations` 中**没有** 0062（灰度现跑 `02ddd0d`，预计没有）。若已有，原地修改后的回填和更严格的触发器不会执行，必须另写一个迁移 |
| G4-c | 灰度制品改为从 `6ae1594`（或 G1 通过后的 main 头部）构建；构建机上的联网 `npm ci`（按锁定文件、不新增依赖）**只有在技术负责人于当前对话中明确批准后才能执行，批准前不得执行**；本文不构成该批准 | D-27 的批准只覆盖 `02ddd0d`，需要你对新提交号**重新批准**；在此之前保持"不得联网安装依赖" |
| G4-d | 关闭 PR #198 | 关闭（已被 audit-writer 取代） |
| G4-e | 窗口时间 | 周一至周五 13:00–17:30（D-08：不放在周六） |

## 4. 部署窗口运行单（OPS 人工执行；Claude 只读核对证据）
**窗口前（不碰灰度）**
1. 在构建机上从批准的提交构建制品，生成 `BUILD_INFO` / `BUILD_DEPS` / `dist.sha256`；运行 `verify-artifact.sh`；Claude 核对后回复"可开窗"。
2. 只读预检（Codex 经 SSH 可做，D-34）：在灰度库里查询 `d1_migrations` 的最后一条（必须早于 0062）；记录磁盘、内存、当前容器镜像。

**窗口内**
3. 停止应用 → 做本机副本 `cp -a /opt/payease/data /opt/payease/data.backup.<时间戳>`（README §6）→ 记录副本的大小和 sha256。
4. 按 README §2 更新 `config.json`（G2、G3 的取值）→ 运行 `check-config.mjs`，必须全部通过。
5. 替换制品、重建容器（README §4）。启动时自动应用迁移到 0062。
6. 验证：
   - `healthz`：三个域名都返回 200（README §5）
   - 认证预检：200、`mode telegram`、公司为 KhmerX Gray
   - 在灰度库上运行 `audit-seq-verify`：`seqNull=0`
   - 用虚构号码跑一遍 demo 验证码登录 → KYC → 申请
   - 后台登录
   - 从真实页面来源发一次写请求（G3）
7. 任何一步失败就**回退**：停止应用 → 恢复第 3 步的副本 → 换回旧制品 → 启动 → 确认 `healthz` 正常。**17:30 是硬截止**，到时间还没验证通过的一律回退。

**窗口后**
8. OPS 提交窗口报告（操作人、时间、每一步的输出、副本位置）→ Claude 验收 → 你决定是否保留副本、是否开放给测试人员。

## 5. 本次灰度明确不覆盖（不得写成"已上线"）
不含正式生产，也不含真实客户或真实手机号；以下各项均未完成：
- 短信验证码供应商、真实 Telegram 投递
- PostgreSQL、多实例
- 异地备份（D-28 为灰度例外）
- 压测（闸门 A、E、G）
- 法务四项
- 持牌机构独立系统（165.22.108.5）
- 资金功能
