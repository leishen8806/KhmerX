# C2：灰度部署制品的构建、校验与版本核对（新卡，补文档缺口）

基线：`origin/main` = `34d09d2`。分支：`feat/server/gray-artifact`，提交末尾 `Line: server`。独立 worktree，一个任务一个分支一个 PR，PR < 400 行。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；不改应用/业务代码、认证、限流、迁移、部署配置里已有的行为；只用虚构数据。

## 1. 已核实事实

| # | 事实 | 证据 |
|---|---|---|
| C2-F1 | 灰度应用镜像由 `deploy/standalone/Dockerfile` 构建，其中 `COPY dist ./dist`；`dist` 被 `.gitignore` 忽略，**仓库里没有任何文档或脚本说明 `dist` 如何在源站上产生**（Q4 README 只写 `up -d --build`） | `deploy/standalone/Dockerfile`、`.gitignore:39`、`deploy/standalone/gray/README.md` |
| C2-F2 | `dist` 由 `npm run build`（`scripts/run-framework.mjs build`）生成；`build:separated` 另生成 `dist-separated`；构建前跑 `check:client-boundary` | `package.json:11,16` |
| C2-F3 | 运行中的网关在 `GET /version` 与 `/readyz` 返回 `buildId`，值来自 `dist/server/BUILD_ID`（框架构建产物，**不是 git SHA**）；没有记录"这个 buildId 对应哪次提交" | `deploy/standalone/server.mjs:14,177-184` |
| C2-F4 | 容器基础镜像 `node:22.22.1-bookworm-slim`；Windows 宿主机上 `check:client-boundary` 因路径问题报错，需在 Linux 容器里构建 | R3 报告、`scripts/check-client-boundary.mjs` |

**风险**：源站上无法证明正在运行的 `dist` 来自已评审的提交；闸门 A 的压测结论因此无法绑定到确定的代码版本。

## 2. 目标
在不改应用代码的前提下，提供：(1) 在 Linux 容器里从**指定提交**构建 `dist` 并生成可核对的清单；(2) 源站上的离线校验；(3) 运行后用 `/version` 核对。

## 3. 允许 / 禁止修改
- **允许新增**：`scripts/build-gray-artifact.sh`、`deploy/standalone/gray/verify-artifact.sh`、`tests/gray-artifact.test.mjs`（或 `.sh` 测试）、`deploy/standalone/gray/README.md`（追加"制品构建与核对"章节）。
- **禁止修改**：`lib/**`、`app/**`、`components/**`、`drizzle/**`、`deploy/standalone/server.mjs`、`Dockerfile`、`compose.gray.yaml`、`check-config.mjs`、`package.json`/lock（**不新增依赖**）。

## 4. 实施要求
1. `scripts/build-gray-artifact.sh <git-sha>`（在 Linux Bash 或容器中运行，`set -euo pipefail`）：
   - 拒绝：工作区不干净、`HEAD` 与参数不一致、`<git-sha>` 不是 `origin/main` 的祖先（用 `git merge-base --is-ancestor`）、不在 `node:22.22.1-bookworm-slim` 内运行（检查 `node -v` 为 `v22.22.1`）。
   - 依赖安装使用锁文件（`npm ci`），构建走 `npm run build`（含边界检查）；构建失败即失败，不吞错。
   - 产出（不进 Git）：`dist/`，以及 `dist/BUILD_INFO.json`：`{gitSha, builtAt, nodeVersion, lockfileSha256, buildId(来自 dist/server/BUILD_ID), fileCount}`；以及 `dist.sha256`（对 `dist/` 下全部文件逐个 `sha256sum`，排序后稳定输出，**不含** `BUILD_INFO.json` 自身与清单文件自身）。
   - 不写入任何凭据、环境变量、主机信息。
2. `deploy/standalone/gray/verify-artifact.sh <预期 git-sha>`（在源站只读运行，不改文件、不重启服务）：
   - 校验 `dist/BUILD_INFO.json` 的 `gitSha` 与预期一致；重新计算清单并与 `dist.sha256` 比对，**任一不符退出码非 0**；校验 `BUILD_ID` 文件与 `BUILD_INFO.buildId` 一致；
   - 可选参数 `--running`：对 `http://127.0.0.1:4300/version` 发 GET，比对返回的 `buildId`（只读，不打印 Cookie）。
3. README 章节写明：谁在哪里构建、如何把 `dist` 传到 `/opt/payease/app/dist`（`tar` + `sha256sum` 对照，或 `rsync --checksum`）、**源站上不得 `npm install` 或自行构建**、`up -d --build` 之前必须先通过 `verify-artifact.sh`、之后用 `--running` 核对；以及回退（保留上一版 `dist` 与 `BUILD_INFO`）。
4. 不得更改 `/version` 的实现；`buildId` 与 git SHA 的对应关系只靠 `BUILD_INFO.json` 记录。

## 5. 验收（缺一不通过）
- 在 `node:22.22.1-bookworm-slim` 本地容器里对一个提交构建成功，产出 `BUILD_INFO.json` 与 `dist.sha256`；`verify-artifact.sh` 通过。
- 负例各一个且退出码非 0：工作区不干净、SHA 不一致、不是 `origin/main` 祖先、Node 版本不符、`dist` 内被改动一个文件、`BUILD_INFO` 的 SHA 被改、`BUILD_ID` 与清单不符。
- `--running` 路径：用本机最小 HTTP 桩（返回 `{service,buildId}`）验证匹配与不匹配两种结果；**不访问任何 khmerx.org 域名**。
- 同一提交连续构建两次，报告两次 `buildId` 与清单是否一致（不要求一致，但必须如实记录；不一致则在 README 说明"以 `BUILD_INFO` 为准，不依赖可复现构建"）。
- `shellcheck` 无错误；`npm test`、`npm run typecheck -- --incremental false`、`npm run lint`（errors = 0）、`npm run check:client-boundary`（容器内）、`git diff --check` 无新增失败；无应用代码改动。

## 6. 验证环境与回退
本机 Docker，仅构建与校验，`--network none` 不适用于 `npm ci`——**只有 `npm ci` 一步允许联网拉取锁文件内的依赖**，其余步骤无网络；若不便联网，改为只读挂载已有 `node_modules` 并在 PR 中写明。回退：删除新增脚本与 README 章节，不涉及应用与数据。

## 7. 给 Codex 的提示词
```
【任务】C2：灰度部署制品的构建、校验与版本核对。严格按 docs/tasks/codex-prompts/C2-gray-artifact-build.md 执行；先读 §1 提到的文件。
在独立 worktree 里基于最新 origin/main 建分支 feat/server/gray-artifact。只新增脚本、测试和 README 章节，不改应用代码、server.mjs、Dockerfile、compose；不新增依赖。
负例与 --running 的 HTTP 桩只在本机验证；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名。
PR 小于 400 行；提交末尾 `Line: server`；按固定格式汇报，假设写进 PR 描述；同一提交连续构建两次的 buildId 一致性如实记录。
```
