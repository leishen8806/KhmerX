# 前后端拆分版上灰度：Codex 任务卡（2026-11-06）

> **已撤回（2026-11-06 17:25）**：技术负责人撤回 D-55。周一 11-09 的窗口照 D-54 部署单容器版，SEP-1～SEP-3 暂不执行。本文件只作留档。

背景：技术负责人 2026-11-06 17:18 决定，**用现有的过渡拆分（`payease-api` 服务端 + `payease-client` 前端）上灰度机，取代 D-54 原定的单容器灰度**（记为 D-55，见文末）。
基线：`origin/main` = `6ae1594`；开工前先 `git fetch`，如果 main 已前进，在 PR 第一行写明实际基线。
规范：`docs/tasks/queue/start-codex.md`、`_common.md`、`codex-workflow.md`。worktree 一律用 `git -c core.autocrlf=false worktree add ...` 创建，保持 LF 换行。
本文件**不批准任何部署、服务器写操作或迁移**。

## Claude 盘点：拆分版现在不能直接上灰度的原因
| # | 问题 | 位置 |
|---|---|---|
| 1 | 拆分 compose 里 api 没有 `group_add: 65534`，写不了扫描令牌（`scanner-secrets` 属主是 `1000:65534`、权限 2750），启动会失败；内存 768m，也低于灰度单容器的 1536m；缺少 `PAYEASE_MAX_*` 过载保护参数 | `deploy/separated/compose.yaml`、`deploy/api/compose.yaml` |
| 2 | 拆分 compose 自带一个 1.5G 的 ClamAV；而灰度机现在用的是同机 `oa-system-clamav-1`（`oa` 网络）。4GB 内存的机器放不下两份 | 同上，对照 `deploy/standalone/gray/compose.gray.yaml` |
| 3 | 灰度 Caddy 把三个域名都指向 4300；拆分后 `testpayease`、`testadmin` 要指向前端 4310，`testapi` 仍指向 4300。拆分 compose 里 api 只有 `expose`，没有映射到主机端口 | `deploy/standalone/Caddyfile.gray` |
| 4 | 制品来源：`verify-artifact.sh` 只认单体的 `dist/`（`BUILD_INFO.json`、`dist.sha256`）；`package-separated.mjs` 不带 `BUILD_INFO`，拆分制品无法核对来源（正是 O2 的老问题） | `deploy/standalone/gray/verify-artifact.sh`、`scripts/package-separated.mjs` |
| 5 | 备份、营业时段、健康检查脚本按 compose 里的服务名 `payease` 操作 | `deploy/standalone/gray/*.sh` |
| 6 | 真实客户端 IP：前端容器转发到 api 时必须保留主机 Caddy 设的 `X-Real-IP`，否则限流会把所有用户算成同一个来源（master-plan §2 提过的老问题） | `deploy/client/Caddyfile` 与 `server.mjs` 的 `resolveClientIp` |

执行顺序：SEP-1、SEP-2 可以并行 → SEP-3（本地验证）→ Claude 给"可开窗"结论。SEP-1、SEP-2 改动 `deploy/**` 或 `scripts/**`：Claude 评审后，**`deploy/**` 的部分还须技术负责人本人批准合并**（D-37）。

---

## SEP-1　拆分版灰度部署模板

```
【卡】SEP-1 拆分版灰度模板　分支：feat/server/SEP-1-separated-gray　Line: server
【注意】改动 deploy/**：Claude 评审后，还须技术负责人本人批准合并。PR 第一行写明这一点。
【先读】docs/tasks/status/2026-11-06-separated-gray-codex-prompts.md（Claude 盘点表）、deploy/separated/*、deploy/api/*、deploy/client/*、deploy/standalone/gray/*（compose.gray.yaml、Caddyfile.gray、README.md、backup.sh、gray-hours.sh、healthcheck.sh）、deploy/standalone/Caddyfile.gray、deploy/standalone/server.mjs 中的 resolveClientIp。
【允许修改】只新增目录 deploy/separated/gray/；deploy/client/Caddyfile（只限第 4 条）；deploy/standalone/gray/ 下的 .sh 脚本（只限第 5 条需要的参数化）；tests/ 下新增或修改相关测试。
【要求】
1. 新增 deploy/separated/gray/compose.gray.yaml，以 deploy/standalone/gray/compose.gray.yaml 为底稿：
   - API 服务**保留服务名 `payease`**（这样备份和营业时段脚本不用改服务名），用 deploy/api/Dockerfile 构建；user node、group_add 65534、PAYEASE_MAX_* 环境变量、mem_limit 1536m、端口 127.0.0.1:4300、/data 和 scanner-secrets 挂载，全部与现有灰度一致。
   - 新增 client 服务：用 deploy/client/Dockerfile 构建，PAYEASE_API_UPSTREAM=http://payease:4300，端口 127.0.0.1:4310，mem_limit 128m，**不挂载**任何数据卷或密钥目录。
   - scanner 与现有灰度完全一样，复用 oa 网络上的 oa-system-clamav-1；**不新增 clamav 服务**。
2. 新增 deploy/separated/gray/Caddyfile.gray：
   - testpayease、testadmin → 127.0.0.1:4310；testapi → 127.0.0.1:4300；test.khmerx.org 保持静态站点不变。
   - 信任代理和 X-Real-IP 的设置与 deploy/standalone/Caddyfile.gray 一致。
3. 新增 deploy/separated/gray/README.md，写成运行单：
   - 构建（npm run build:separated → docker compose build）
   - 启动与健康检查（/healthz、/readyz、/version，前端 4310 的首页）
   - 切换 Caddy
   - **回退到单容器**：恢复 deploy/standalone/Caddyfile.gray 的引用，用原 compose 启动
   - 数据目录不变，两种形态共用 /opt/payease/data
4. deploy/client/Caddyfile：确认转发到 api 时保留请求里的 X-Real-IP（Caddy 默认会透传，但要写成显式的 header_up X-Real-IP {header.X-Real-IP}，并加注释说明：主机 Caddy 会覆盖这个头，浏览器无法伪造）。同时保留原有的身份头剥离。
5. 如果 backup.sh、gray-hours.sh、healthcheck.sh 写死了 compose 路径，改成可以通过环境变量指定（默认值不变）；服务名不用改。
6. 测试：
   - 用 docker compose config 校验新 compose（没有 Docker 就跳过，与现有测试同样处理）；
   - 静态断言：client 服务没有任何 volumes；没有 clamav 服务；payease 服务带 group_add 65534；Caddyfile.gray 的三个域名分别指向正确端口；client Caddyfile 含身份头剥离和 X-Real-IP 透传。
7. 不改 lib/**、app/**、drizzle/**、生产模板、deploy/separated/compose.yaml 原文件。
【自查】npm test、npm run lint、npm run check:client-boundary；没装依赖跑不了的项写明，由 Claude 在 Linux 上补验。不联网安装依赖。
【交付】PR 描述写"做了什么 / 没做什么 / 假设 / 风险 / 回退方法"。推送后把分支名发给 Claude。
```

---

## SEP-2　拆分制品的来源校验

```
【卡】SEP-2 拆分制品来源校验　分支：feat/server/SEP-2-separated-artifact　Line: server
【注意】改动 scripts/** 和 deploy/**：Claude 评审；deploy/** 的部分还须技术负责人本人批准合并。
【先读】scripts/package-separated.mjs、scripts/build-verified.sh、scripts/run-framework.mjs、deploy/standalone/gray/verify-artifact.sh、deploy/standalone/gray/README.md 的 "Reviewed gray artifacts (C2)" 一节。
【基于】最新 origin/main。如果 GL-5（Windows 路径修复）还没合并，就基于 fix/scripts/GL-5-windows-root-path 堆叠，并在 PR 第一行写"基于 GL-5，等其合并后需 rebase"。
【允许修改】scripts/package-separated.mjs、新增 deploy/separated/gray/verify-artifact.sh、tests/ 下相关测试。
【要求】
1. package-separated.mjs：如果 dist/BUILD_INFO.json、dist/BUILD_DEPS.json 存在，复制到 dist-separated/api/ 和 dist-separated/client/；
   为两个目录各生成一份 dist.sha256（格式与单体 dist.sha256 一致，排除自身和 BUILD_INFO.json）；
   artifact.json 里写入来源提交号（从 BUILD_INFO 读取，没有就写 null 并给出警告）。
2. 新增 deploy/separated/gray/verify-artifact.sh：
   - 对 dist-separated/api 和 dist-separated/client 分别做与单体 verify-artifact.sh 相同的检查：文件类型、sha256、BUILD_INFO 与 BUILD_ID 一致、文件数一致；
   - 两份 BUILD_INFO 的提交号必须相同；
   - client 目录里不得出现 .env、config.json、密钥、sqlite、drizzle 等文件（复用 package-separated 的禁止规则，再加上 *.sqlite 和 drizzle/）。
3. 测试：用临时目录造一份假制品，覆盖通过、sha 被篡改、提交号不一致、client 混入 config.json 四种情况。
4. 不改单体的 verify-artifact.sh 和 build-verified.sh 的行为。
【自查】同 SEP-1。推送后把分支名发给 Claude。
```

---

## SEP-3　拆分版本地验证（在有 Docker 的 Linux 机器上）

```
【卡】SEP-3 拆分版本地验证　分支：docs/review/separated-gray-local-20261106　Line: server
【前置】SEP-1、SEP-2 已推送，并经 Claude 评审通过（未合并也可以，基于两个分支合并后的临时分支验证，不推送这个临时分支）。
【在哪里跑】需要一台有 Docker 的 Linux 机器。当前 Windows 开发机没有 Docker；只能用技术负责人指定的机器（例如 D-27 的构建机）。
**没有明确指定的机器就停下，等技术负责人回复**，不要自己找机器，也不要在灰度机上跑。
【不联网安装依赖】只有技术负责人另行批准时才可以联网。
【步骤】只用虚构数据，在临时数据目录里做，不用 /opt/payease：
1. npm run build:separated → 运行 deploy/separated/gray/verify-artifact.sh，要求通过。
2. 用 SEP-1 的 compose 启动 payease、client、scanner。没有 oa-system-clamav-1 时，用一个临时 clamav 容器模拟，并在报告里写明。
3. 检查：
   - 4300 的 /healthz、/readyz、/version
   - 4310 的首页、/h5、/team/login 能打开，静态资源由前端容器返回
   - 经 4310 访问 /api/h5/auth 返回 200
   - 浏览器写请求带正确 Origin 时被接受
   - 伪造 oai-authenticated-* 身份头被剥离
   - 通过前端容器请求时，api 日志里记录的是 X-Real-IP 而不是前端容器 IP
4. 回退演练：停掉拆分版，用单容器 compose 在同一个临时数据目录上启动，/readyz 正常，数据还在。
5. 报告写在 docs/review/separated-gray-local-20261106.md：每一步写命令、结果、通过或失败。推送后把分支名发给 Claude。
```

---

## D-55（待提交进决定记录）
| 编号 | 决定 | 范围与条件 | 状态 |
|---|---|---|---|
| D-55（已撤回） | 灰度改为部署前后端过渡拆分版（`payease-api` + `payease-client`），取代 D-54 的单容器形态 | 技术负责人 2026-11-06 17:18 在对话中决定。D-54 的窗口时间（11-09 13:00–17:30）和其他前置条件保留；**新增前置条件**：SEP-1、SEP-2 已合并，SEP-3 本地验证通过。任一项不满足，窗口顺延，另行商定时间。纯静态前端（客户端渲染）不在本次范围内。**2026-11-06 17:25 撤回：目标是两家公司硬分离，前后端容器拆分对此没有帮助** | 已撤回 |
