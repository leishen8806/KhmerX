# C2R：灰度制品构建与校验的返修（PR #60，评审 P2）

来源：对 PR #60（C2，`71fdd0d`）的独立评审。代码评审 PASS（P0/P1 为 0），**验收仍为 EVIDENCE PENDING**：下面三条 P2 必须在 C2 验收前修复，并补一条真实构建证据（§5，受阻塞）。
分支：**继续使用 `feat/server/gray-artifact`（PR #60 本身）**，只追加提交，不新开分支、不新开 PR；提交末尾 `Line: server`。PR < 400 行（含原有 201 行则总 diff 可超过，**本次追加部分 < 300 行**）。
冻结：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名；不改应用/业务代码、`server.mjs`、Dockerfile、compose、`check-config.mjs`、依赖与 lock、迁移；只用虚构数据。

## 1. 评审发现（已在合成构建桩上复现）

| # | 位置 | 复现 | 影响 |
|---|---|---|---|
| F1（P2） | `scripts/build-gray-artifact.sh:11-15` | `GRAY_ARTIFACT_REUSE_DEPS=1` 时，**空的 `node_modules` 目录也被接受**（退出码 0）；不校验与 `package-lock.json` 一致，也不记录依赖来源 | `BUILD_INFO.lockfileSha256` 看起来可信，实际依赖可能来自别的版本或别的平台；原卡要求"记录与锁文件匹配的来源" |
| F2（P2） | `build-gray-artifact.sh:16` | 构建前不清理 `dist`：往已有的 `dist/server/` 放一个 `stale.js` 再构建，`stale.js` 被写入 `dist.sha256`（1=是） | 旧文件当作"已校验的真实产物"。vinext 是否自己清空 `dist` 未验证 |
| F3（P2） | `deploy/standalone/gray/README.md`、`verify-artifact.sh` | `verify-artifact.sh` 依赖 `node`、`sha256sum`、`xargs`、`find`，README 没写源站上如何运行；`--running` 访问宿主机 `127.0.0.1:4300`，在 `--network none` 容器里够不到 | 操作员无法按文档完成"校验再 `up --build`"，或被迫在源站安装工具（README 同时禁止） |
| F4（P3） | 仓库根 | 没有 `.gitattributes`；Windows 检出的 `.sh` 变 CRLF，shellcheck 报 SC1017、脚本无法执行 | 在本机复核时会产生假失败 |
| F5（P3） | `verify-artifact.sh` | 文件权限位、空目录、修改时间不在清单内；清单是完整性哈希，不是签名 | 属已知边界，需写明 |
| F6（P3） | 测试 | 5 项测试需要：Linux 容器 + Node 22.22.1 + Git + **允许执行的 `/tmp`**（`docker --tmpfs /tmp` 默认 noexec，会让桩 `npm` 无法执行，4 项假失败）；不满足时静默跳过 | 常规测试里这些项静默跳过，容易被误当作"通过" |

## 2. 允许 / 禁止修改
- **允许**：`scripts/build-gray-artifact.sh`、`deploy/standalone/gray/verify-artifact.sh`、`deploy/standalone/gray/README.md`（仅 C2 章节）、`tests/gray-artifact.test.mjs`、新增仓库根 `.gitattributes`（见 R4）。
- **禁止**：§冻结所列；不新增依赖；不改 `BUILD_INFO.json` 的六个字段集合（`gitSha`、`builtAt`、`nodeVersion`、`lockfileSha256`、`buildId`、`fileCount`）。

## 3. 实施要求

**R1 依赖来源（修 F1）**
- 默认仍是 `npm ci`；`GRAY_ARTIFACT_REUSE_DEPS=1` 时必须**校验** `node_modules` 与 `package-lock.json` 匹配后才继续，否则失败：
  - 要求存在 `node_modules/.package-lock.json`（npm 的隐藏锁文件）；
  - 对其中每个已安装包，`version`（以及 `resolved`/`integrity`，若两边都有）必须与 `package-lock.json` 里同一路径的条目一致；
  - `package-lock.json` 中**非可选**（`!optional`）的包必须全部已安装；可选的平台专属包（如各平台的 rolldown/workerd 绑定）允许缺失，但**当前平台（linux-x64）需要的绑定缺失时要失败并指出包名**，不得静默通过；
  - 失败信息只写包名与原因，不打印路径之外的环境信息。
- 来源记录：新增 `dist/BUILD_DEPS.json`（**不改 `BUILD_INFO.json` 字段**）：`{mode:'npm-ci'|'reused', lockfileSha256, installedLockSha256, installedPackages, checkedPackages}`；它在清单计算**之前**写入，因此被 `dist.sha256` 覆盖。
- `verify-artifact.sh` 增加：`BUILD_DEPS.json` 必须存在，`lockfileSha256` 与 `BUILD_INFO.lockfileSha256` 一致，`mode` 为两个允许值之一。

**R2 构建前的 `dist`（修 F2）**
- 构建前若 `dist` 已存在：**失败**（提示"在一次性构建目录中构建"），不要自动删除用户目录；或在显式环境变量 `GRAY_ARTIFACT_CLEAN_DIST=1` 下 `rm -rf dist`。二选一，写进 README；默认行为必须保证"清单里只会有本次构建产生的文件"。
- 增加断言：构建后 `dist` 中不得出现构建开始前就存在的文件（失败即退出）。

**R3 文档（修 F3、F5、F6）**
- README 写明源站只读校验的运行方式：`docker run --rm --network none -v <repo>:/app:ro -w /app node:22.22.1-bookworm-slim bash deploy/standalone/gray/verify-artifact.sh <SHA>`；`--running` 需要访问宿主机，写明 `--network host` 版本或宿主机自带 Node 的版本，二者择一并说明风险；不得要求在源站安装工具。
- 写明：清单是**完整性**而非签名；权限位、空目录、修改时间不在检测范围。
- 测试文件头与 README 写明前置：Linux 容器、Node 22.22.1、Git、`/tmp` 须可执行（`--tmpfs /tmp:exec`）；不满足时测试**跳过**，跳过**不计入通过**。

**R4 `.gitattributes`（修 F4）**
- 新增 `.gitattributes`：`*.sh text eol=lf`（仅此一行；不全仓库归一化其他类型）。PR 描述说明这只影响之后的检出，不改历史。

**R5 测试（对应 R1–R3）**——全部在合成构建桩下：
- R1：复用依赖时 ① 空 `node_modules` → 失败；② 缺 `.package-lock.json` → 失败；③ 版本与锁文件不一致 → 失败；④ 非可选包缺失 → 失败；⑤ 与锁匹配（含缺少非本平台的可选包）→ 成功并生成 `BUILD_DEPS.json`；⑥ `verify` 在 `BUILD_DEPS.json` 缺失或不一致时失败。
- R2：已有 `dist`（含 `stale.js`）→ 按所选方案失败或清理，且清单里**不含** `stale.js`。
- 原有 5 项测试**全部保持通过**，不削弱不删除。

## 4. 验收（缺一不通过）
- 在 `node:22.22.1-bookworm-slim`、`--network none`、`--tmpfs /tmp:exec`、Git 由既有离线工具提供的环境里：C2 测试（原 5 项 + 新增）全部通过，**无跳过**；shellcheck 无错误；`git diff --check` 无输出。
- `npm test`、`npm run typecheck -- --incremental false`、`npm run lint`（errors = 0，warnings 不高于 577）、`npm run check:client-boundary`（容器内）无新增失败。
- 无应用/网关/Dockerfile/compose/依赖/迁移改动。

## 5. 真实构建证据（受阻塞，**本卡不得自行解除**）
评审已确认：现有可复用依赖只有 Windows 的 rolldown/workerd 绑定，没有 Linux 版，在容器里 `npm run build` 失败于 `Cannot find package 'vite'`；你要求不联网安装。因此以下三项是 C2 的**完整验收**条件，**目前缺失**：
1. 在 `node:22.22.1-bookworm-slim` 里对一个提交完成真实 `npm run build`（不是合成桩）；
2. 对真实产物运行 `verify-artifact.sh`（含 `BUILD_DEPS.json`）并通过；
3. 同一提交连续两次真实构建，记录两次 `buildId` 与清单是否一致（不要求一致，如实写）。

**解除条件（任选其一，由技术负责人明确指示后才可执行）**：(a) 提供一份与锁文件匹配的 linux-x64 `node_modules`（离线），经 R1 的校验后只读挂载；(b) 书面批准**一次性**联网执行 `npm ci`（仅此一步联网，其余仍 `--network none`），并在 PR 里记录来源与时间。未获指示前，Codex **不得联网补包、不得编造替代证据**；PR 保持 Draft，验收状态写 `EVIDENCE PENDING`。

## 6. 假设、风险与回退
- 假设：隐藏锁文件 `node_modules/.package-lock.json` 在 `npm ci` 与 `npm install` 之后都会生成；若不存在则视为不可信来源并失败（宁可严格）。
- 风险：可选平台包规则要写得准确，避免误拒；以测试⑤为准。
- 回退：还原这些追加提交；不涉及应用、数据与部署配置。

## 7. 给 Codex 的提示词
```
【任务】C2R：返修 PR #60（灰度制品构建与校验）。严格按 docs/tasks/codex-prompts/C2R-gray-artifact-fixes.md 执行；继续使用分支 feat/server/gray-artifact，追加提交，不新开分支或 PR。
先读该文 §1 的发现与 §3 的要求，再读 scripts/build-gray-artifact.sh、deploy/standalone/gray/verify-artifact.sh、tests/gray-artifact.test.mjs、deploy/standalone/gray/README.md 的 C2 章节。
只改允许范围内的文件，不改 BUILD_INFO 的六个字段，不新增依赖，不改应用/网关/Dockerfile/compose。R1–R5 全部实现并先写失败测试；原有 5 项测试保持通过。
本机验证：node:22.22.1-bookworm-slim，--network none，--tmpfs /tmp:exec，Git 由既有离线工具提供；不要操作 159.223.77.134 / 165.22.108.5，不要访问任何 khmerx.org 域名。
§5 的真实构建证据受阻塞：未获技术负责人明确指示前，不得联网安装、不得制造替代证据；PR 保持 Draft，验收写 EVIDENCE PENDING。
追加部分小于 300 行；提交末尾 `Line: server`；按固定格式汇报，假设写进 PR 描述。
```
