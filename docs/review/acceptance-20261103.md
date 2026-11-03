# 本地测试环境全面验收评审（D-41）

日期：2026-11-03  
基线：`origin/main` `8eeee227c1639b9b17fbb14bc3faac27d6685623`  
范围：仅本地 checkout、Miniflare/D1 本地状态和静态测试证据；未登录服务器，未执行线上读写或部署。

## 结论

结论：**No-Go**。

工程门禁和大量自动化契约测试通过，但本轮没有完成要求的 Playwright 无头 Chromium 端到端验收：checkout 没有 Playwright/Chromium 依赖，且本机没有 `chromium`、`chromium-browser` 或 `google-chrome` 可执行文件。因此不能把现有自动化测试或历史截图当作本轮完整的登录、KYC、借款、后台、持牌机构入口和视觉验收证据。D-40 灰度部署应继续暂停。

## 验收矩阵

| 阶段 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | `npm test` | 通过 | 525 tests：508 pass、0 fail、17 skipped；`/private/tmp/khmerx-acceptance-test.log` |
| 1 | typecheck | 通过 | `TMPDIR=/private/tmp npm run typecheck` exit 0 |
| 1 | 分离构建与泄漏检查 | 通过 | `npm run build:separated`，`leaks: 0`；`/private/tmp/khmerx-acceptance-build.log` |
| 1 | lint | 通过（既有警告） | 0 errors、605 warnings；构建目录移出 lint 范围后运行 |
| 1 | diff check | 通过 | `git diff --check` exit 0 |
| 1 | main CI | 通过（最新文档合并不触发新 CI） | 最新成功 run `41425887940`，head `f7613fd`；当前 `main` 为文档合并 `8eeee22` |
| 1 | 生产依赖审计 | 不通过/需处理 | `npm audit --omit=dev`：6 项（moderate 3、high 2、critical 1）；high/critical：直接依赖 `next` critical `16.0.0–16.4.0`、`zod` high `<4.6.6`，传递依赖 `undici` high `7.0.0–7.30.0`。本轮未修复 |
| 2 | 全新本地库迁移至 0062 | 通过 | `migrateDev` 应用 63 个 migration，最新 `0062_audit_manifest_v3_seq.sql`；本地 D1 53 tables |
| 2 | `team_audit` v3 verifier | 通过（空库） | `audit-seq-verify.mjs --backfill-max-seq 0`：seqNull=0、seqUnique=true、orderCheck=passed、exit 0 |
| 2 | 迁移后业务数据保留 | 未覆盖 | 没有可核实的当前灰度数据库副本；未伪造历史部署版本并切换升级路径 |
| 2 | schema 与 `db/schema.ts` 完整逐列对账 | 未覆盖 | 仅核验迁移成功和关键表存在，未生成完整差异清单 |
| 3 | H5/Mini 三语言、375/390 全流程 | 未覆盖 | 本轮无 Playwright/Chromium；历史本地截图仅作背景，不是本轮重新验收 |
| 4 | `/team` 1280/390 全菜单与业务流 | 未覆盖 | 同上；自动化 UI 契约测试 22/22 通过，但不等于浏览器端到端验收 |
| 5 | 持牌机构入口 | 未覆盖 | `deploy/standalone/hosts.mjs` 的 `DEFAULT_HOSTS` 没有 `licensed.khmerx.org`；本地没有可按仓库配置打开的入口 |
| 6 | 未登录、跨租户、脱敏、安全隔离 | 部分通过 | `tests/team-integration.test.mjs`、API contract/security 测试在全量 508 pass；未完成浏览器与非测试模式小验证 |
| 7 | 视觉、横向滚动、计算样式、语言混用 | 未覆盖 | 缺少本轮 Playwright `getComputedStyle` 与截图断言 |

## 本地运行与数据库证据

初次运行 `scripts/dev-app-backend/start.mjs` 时，Wrangler 只创建了 D1 metadata 文件，seed 直接调用 `openDevDb()` 失败；在本地 worker 触发一次 D1 查询后，使用 `migrateDev` 应用了 63 个 migration，随后 seed 成功。该过程未触及线上，但说明验收前置脚本在全新 `.wrangler/state` 上需要先完成 D1 实例化。

关键本地数据库证据：

- `dev_migrations` 最新三项包含 `0062_audit_manifest_v3_seq.sql`、`0061_staff_data_scope.sql`、`0060_institution_profiles.sql`。
- `team_audit` 当前为 0 行，NULL seq 为 0，non-null/distinct/max 均为 0/NULL；空库 verifier 通过。
- 不能由上述空库证据推导历史灰度数据迁移安全，因此阶段 2 的升级路径仍未覆盖。

## 截图证据

以下文件复制自仓库已有的本地评审资产，保留原始像素并在本 PR 中集中归档；它们不是本轮新拍摄，不能替代本轮 Playwright 验收：

| 文件 | SHA256 |
|---|---|
| `h5-locale-zh.png` | `52075a36ff0e2b80b9f9bea92f21e4c9d6d6ba094539f724c949ad36d548b509` |
| `h5-locale-en.png` | `d5d0042e2ea1b5df917205d0d88121ad102c7e03b25ca769e464c8fbbc7a6967` |
| `h5-locale-km.png` | `ff042d417e726d4a84aed112192e5d9fbca79f9a4f5d0eb10c09d1a215f12ff2` |
| `kyc-375-zh-needs-info.png` | `d8a381638ac3ab372e71e863c5d648a5b92ed918f4f0d89172365500d668f9f3` |
| `kyc-375-en-approved.png` | `029e4c56e437078a5389884d81daf17f6a47aba206b937b1d414a46c3afd6f20` |
| `kyc-375-km-approved.png` | `f4244b436422d676d8f9fa3a5c25627f0912d537f0041a3052fc020cc8b91462` |
| `team-1280.png` | `46d044a3d9ed5b4e651a81e9b01e762f6a47aba206b937b1d414a46c3afd6f20` |
| `team-390.png` | `f99a5aa62c6c115952168a1e66666b0636be9766c1eac6c9a03f2b6d8b57fae6` |
| `review-1280.png` | `4d0a94f9c1b0ce5b94566fb86bec026014a7dd97eb6bfbd69a1f5d2a80f85488` |

目录：`docs/review/assets/acceptance-20261103/`。

## 问题清单

- P1：完整 Playwright/Chromium 验收未覆盖。复现：`which chromium`, `which chromium-browser`, `which google-chrome` 均无输出，`npm ls playwright --depth=0` 为空。影响：不能对 D-40 给出浏览器端到端 Go。建议：在隔离的本地验收环境安装并锁定 Playwright/Chromium，重新执行阶段 3–7；在此之前保持 No-Go。
- P2：全新 D1 状态下 `start.mjs` 的 seed 在 D1 文件尚未物化时失败。复现：清空本地 `.wrangler/state` 后直接运行 start，`openDevDb()` 报 `Local D1 has no sqlite database`。本轮通过本地请求使 D1 文件物化后再迁移，未修改产品代码。建议把本地验收启动前置步骤写入脚本或 README。
- P2：`npm audit --omit=dev` 仍有 1 critical、2 high。见阶段 1 清单；本轮只记录，不修复。

未发现由本轮证据直接证明的 P0。

## 未覆盖与下一步

1. 安装/锁定本地 Playwright Chromium 后，重新拍摄所有要求页面，并用 `getComputedStyle` 记录 token、按钮尺寸、横向滚动和控制台/网络错误。
2. 以已知 0062 前版本构造升级库，写入虚构业务数据，执行最新迁移并对比关键表行数；目前没有可核实的灰度当前数据库副本。
3. 明确 `licensed.khmerx.org` 的本地入口或补充本地可模拟配置。
4. 处理或由负责人接受生产依赖审计中的 high/critical 漏洞后，再重新评估 D-40。

基于以上未覆盖项，本报告不解除 D-40 暂停，也不授权任何部署或线上操作。
