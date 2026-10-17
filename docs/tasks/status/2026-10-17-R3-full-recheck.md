# R3 全量复核报告

日期：2026-10-17（Asia/Bangkok）

执行人：苏晨 / Codex

范围：仅本机断网 Docker；本 PR 只提交此报告，不修改应用、测试、迁移或部署代码。

## 1. 项目与基线

- Root：`E:\KhmerX\KhmerX`；remote：`git@github.com:leishen8806/KhmerX.git`。
- 独立复核目录：`E:\KhmerX\wt-R3`。
- 复核基线：`7b4e0ea4f8ba98d59d1a2c2dda74cedc6c38319c`，已通过 fetch 核对为开始复核时的 `origin/main`。
- 报告分支：`docs/server/R3-full-recheck-20261017`，仅用于文档 PR。
- 依据：`docs/tasks/codex-prompts/R3-full-recheck.md`，以及 R1/R2 修复卡。
- [R1-A #54](https://github.com/leishen8806/KhmerX/pull/54)：已合并；修复提交 `d91ffaad82ba33244532ba32f4926626b39eeb8a`。
- [R2 #56](https://github.com/leishen8806/KhmerX/pull/56)：已合并；修复提交 `5f2728514274c9644b2a8bcc2a773cffc7168ec6`。
- 两个修复提交均为复核基线的祖先，已独立用 `git merge-base --is-ancestor` 验证。

### 合并顺序偏差

用户授权按 #54 → #56 合并。执行 #54 合并确认期间，#56 已被并发操作合入；发现后没有重复合并或改写 main。
远端 first-parent 记录实际为：

| PR | 合并提交 | 提交时间（+07:00） |
|---|---|---|
| #56 | `5f9b0173a8c14710c47ddfd0a59280e4572f3208` | 2026-10-17 09:29:33 |
| #54 | `7b4e0ea4f8ba98d59d1a2c2dda74cedc6c38319c` | 2026-10-17 09:29:44 |

#54 合并由本执行会话确认；#56 在页面检查时已为 Merged，不归称为本会话执行。
这不符合所要求的合并顺序，但最终 main 包含两项完整修复；本报告验证的是该最终合并状态。

## 2. 验证环境与可复现命令

- 镜像：`node:22.22.1-bookworm-slim`。
- 本机镜像 ID：`sha256:4f77a690f2f8946ab16fe1e791a3ac0667ae1c3575c3e4d0d4589e9ed5bfaf3d`。
- 所有测试和静态检查均使用 `--network none`；源码、已有 `node_modules` 均只读挂载。
- 依赖复用 `E:\KhmerX\KhmerX\node_modules`；没有安装或新增依赖。
- 普通轮使用镜像默认用户，无 `L1G_CONTAINER` / k6 注入，`/tmp` 为临时文件系统。
- 门控轮使用 `--user 1000:1000`、`L1G_CONTAINER=1`，`/data`、`/out` 均为 tmpfs。
- k6 复用本机现有工具包，在临时目录解压；工具目录只读挂载，不挂载生产配置或凭据。

普通轮（在 PowerShell 中执行，输出重定向到本机忽略文件）：

```powershell
docker run --rm --network none -e CI=1 --tmpfs /tmp `
  -v E:/KhmerX/wt-R3:/app:ro `
  -v E:/KhmerX/KhmerX/node_modules:/app/node_modules:ro `
  -w /app node:22.22.1-bookworm-slim npm test
```

门控轮：

```powershell
docker run --rm --network none --user 1000:1000 -e CI=1 `
  -e L1G_CONTAINER=1 -e L1G_K6_BIN=/tmp/k6-v2.3.0-linux-amd64/k6 `
  --tmpfs /tmp:exec,mode=1777 `
  --tmpfs /data:uid=1000,gid=1000,mode=755 `
  --tmpfs /out:uid=1000,gid=1000,mode=700 `
  -v E:/KhmerX/wt-R3:/app:ro `
  -v E:/KhmerX/KhmerX/node_modules:/app/node_modules:ro `
  -v E:/KhmerX/wt-L1-G2/.tmp-tools:/tools:ro `
  -w /app node:22.22.1-bookworm-slim `
  sh -c 'tar -xzf /tools/k6.tar.gz -C /tmp && npm test'
```

静态检查使用相同镜像、断网和只读挂载，以 UID 1000 依次执行：

```text
npm run typecheck -- --incremental false
npm run lint
npm run check:client-boundary
```

`git diff --check` 在宿主机执行。k6 冒烟中的域名仅作模拟 Host/Origin 字符串，既有测试将连接固定映射到容器 `127.0.0.1`；无真实域名解析、灰度/VPS 连接或 Telegram 发送。

### 首轮门控环境错误及处理

首次门控执行为 271 通过 / 1 失败 / 4 跳过，唯一失败是 k6 启动报 `EACCES`。
独立检查 `/proc/mounts` 确认 Docker 默认 `/tmp` 为 `noexec`，k6 文件本身已具备执行权限。
仅把该临时挂载改为 `/tmp:exec,mode=1777`，保留断网、UID 和只读约束；未修改测试或应用代码。
随后完整重跑门控轮通过。首次失败不是忽略或改为 skip，最终结果如下。

## 3. 结果与原基线对比

| 检查 | 原基线 `461d070`（任务卡记录） | 本次合并基线实测 |
|---|---|---|
| 普通 `npm test` | 268 项 / 255 pass / 1 fail / 12 skip | 276 项 / 264 pass / 0 fail / 12 skip；exit 0 |
| 门控 `npm test` + k6 | 未提供同环境对照 | 276 项 / 272 pass / 0 fail / 4 skip；exit 0 |
| typecheck | 1 error：`audit` 未定义 | 0 errors；exit 0 |
| lint | 2 errors / 577 warnings | 0 errors / 577 warnings；exit 0 |
| client-boundary | 通过 | 通过，扫描 113 个源文件；exit 0 |
| `git diff --check` | 未提供对照 | 无输出，exit 0；报告提交前再次执行 |

测试总数增加 8：R1-A 新增 1 项、R2 新增 7 项。skip 不计入 pass。
普通轮约 70.51 秒，最终门控轮约 29.93 秒；两轮运行条件不同，不据此作性能结论。

已实际通过：

- 原失败项 `Telegram signed subscription, tenant isolation, one-time delivery and unsubscribe`。
- R1-A 新增人工重试测试：两种合法状态、完整审计字段、拒绝无变更、跨租户、重复重试。
- R2 的 7 项组件/ESLint 测试及原 `h5-navigation` 测试；未降低 lint 规则或删除测试。
- L1-G 的真实 Telegram 模式注册守卫、create/confirm_bill、拒绝路径、清理/审计保留和 CLI 测试。
- G2 真实 k6 本机 HTTPS 冒烟及 G3 数据库证据绑定测试。

## 4. 全部跳过项

| 测试名称 | 普通轮 | 最终门控轮 | 原因 / 补跑结果 |
|---|---|---|---|
| Q4 Compose resolves app build root and permits only app writes to scanner secrets | SKIP | SKIP | 指定容器内无 Docker Compose CLI |
| Q4 bootstrap metadata repairs are idempotent in a disposable Linux fixture | SKIP | SKIP | 指定容器内无 Docker CLI/daemon；未挂载 Docker socket |
| local KYC: draft → submit → supplement → resubmit → approval → loan; isolation and stale review | SKIP | SKIP | 未设置 `KYC_TEST_URL`，没有为本卡启动 KYC HTTP 服务 |
| G1 gate 5.1-2/3: real Telegram guard, create and confirm_bill; immutable public seed | SKIP | PASS | 普通轮未注入 `L1G_CONTAINER=1`；门控轮实际执行 |
| G1 refusals leave every table unchanged; no links, placeholders, production or unsafe operator declarations | SKIP | PASS | 同上 |
| G1 unused five datasets cleanup, rollback, ownership guards and audit preservation | SKIP | PASS | 同上 |
| L1-A2 f: each ownership condition rejects atomically, including extra/missing clients | SKIP | PASS | 同上 |
| L1 P2 remaining forbidden tables, bad loan index and foreign legacy loans reject cleanup unchanged | SKIP | PASS | 同上 |
| G1 CLI plan/apply/db-check/cleanup sanitize output and protect private manifests | SKIP | PASS | 同上 |
| G1 gray create without Ops fails the actual tenant scope trigger | SKIP | PASS | 同上 |
| G2 offline self-signed HTTPS: real k6 smoke, hosts mapping, Origin/Cookies and sanitized report | SKIP | PASS | 普通轮未注入 `L1G_K6_BIN`；门控轮修正临时目录后实际执行 |
| gray scanner Compose requires credentials and exposes only the TLS perimeter | SKIP | SKIP | 指定容器内无 Docker Compose CLI |

## 5. 证据位置、局限与结论

原始本机日志位于 `E:\KhmerX\wt-R3` 的忽略文件中，不提交原始输出：

- `.tmp-r3-normal.log`：普通轮。
- `.tmp-r3-gated.log`：首次门控环境错误，保留追溯。
- `.tmp-r3-gated-final.log`：最终门控完整重跑。
- `.tmp-r3-checks.log`：typecheck / lint / client-boundary 及各自退出码。

复核结论仅覆盖本机合并基线，不代表灰度、600 客户压测、真实 Telegram、生产、浏览器/设备或 Flutter 验证；未运行 Next build。
现有 577 个 warnings 未在本卡清理。R1-F5 审计与状态更新仍非原子，属于已披露的 R1-B 后续事项，本轮未启动。
除已修正的容器执行参数问题，未发现新的 R3 阻断检查错误。

```text
REPAIR VERIFIED: YES
L2/Q12: HOLD
GRAY/VPS: HOLD
```
