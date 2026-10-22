# PR #63（`feat/client/D1`）只读清单

核对：Claude，2026-10-22 周四。**只读**：没有修改该分支、没有合并、没有部署；`git merge-tree` 干跑只在对象库里产生未引用对象。
基线：`origin/main` = `9355f3a`；`feat/client/D1` = `79dbd5a`（2026-10-22 10:58）；分叉点 `9494a43`（2026-10-15 16:41）。
结论先行：**不得整体合并，也不得作为灰度或生产部署来源。** 建议按 §6 切成小 PR，逐个评审。

## 1. 它是什么

- **一条与 main 平行的长期分支**，不是任务卡产物：398 个提交只在这条线上（main 另有 86 个提交不在它上面）。
- 提交分布：10-15 约 38 个、10-16 95、10-17 85、10-19 68、10-20 97（署名"苏晨"，合计约 382）；10-21 10、10-22 5（署名"大旺"，合计 15）；另有 1 个"Codex"。
- **没有任何 `Line:` 提交尾注**（违反 D-12/D-18）；3 个合并提交、14 个自动的 `Update Site source`、3 个 `Merge remote-tracking branch 'sites/main'`——说明本机除 `origin` 外还有一个 `sites` 远端（托管站点的发布仓库），这条分支是**托管测试站的源码线**。
- 提交类型：`fix` 266、`feat` 32、`docs` 19、`test` 11、`chore` 4。按主题粗分：组织/菜单/导航 UI 约 87、审计/权限相关 83（多为审计页面样式）、认证/MFA 34、KYC/客户/标签 32、贷款/资金 23、UAT 19、工单/通知/报表 13；**绝大多数是前端排版与文案微调**。
- 与 main 补丁等价的只有 3 个（392 个是独有内容）。
- 净差异：**127 个文件，+2263/-322**（含 959 行测试、379 行文档）。体量可控，但分布在认证、网关、数据库迁移、幂等和合同校验等高风险位置。

## 2. 文件清单（相对 main 的三点差异）

| 区域 | 文件数 | 行 | 性质 |
|---|---|---|---|
| `app/api/**` | 35 | +230/-89 | 绝大多数是为旧式路由补 `sameOrigin(request)` 与 `failure(e, request)`；另有实质改动见 §3 |
| `components/**` | 20 | +140/-60 | 前端样式、文案、标签 |
| `app/*.tsx` / `app/globals.css` | 8 | +233/-57 | 含 `globals.css` +142 |
| `lib/team/**` | 14 | +159/-53 | 认证、公司选择、策略、管理员放款、遗留贷款回填 |
| 测试 | 16 | +959/-19 | 其中 `tests/team-menu-ui.test.mjs` 一个文件 692 行 |
| 文档 | 8 | +379/-2 | UAT 验收记录、Telegram 设备验收记录 |
| `drizzle/**` | 2 | +22 | **新增 0062、0063 两个迁移，main 没有** |
| `deploy/standalone/server.mjs` | 1 | +10/-4 | 启动时遗留贷款回填改为带版本冲突检测 |
| 其他 `lib/*` | 约 10 个 | 小 | `lib/customer-shards.ts`、`lib/domain.ts`、`lib/h5-auth-core.ts`、`lib/loan-signing.ts`、`lib/kyc/*`、`lib/notifications/server.ts`、`lib/postloan/core.ts`、`lib/institution-callback-queue.ts`、`db/schema` |
| `scripts/**`、`package.json` | 7 | 小 | `b0-main-flow.js` 加 `SCENARIO=baseline|rows`；`package-separated.mjs` 生成可部署的 `dist/`；新增 `audit:i18n` 脚本；lint 忽略 `dist-separated` |

## 3. 高风险项（逐条，均为事实核对结果，尚未评审结论）

| # | 位置 | 内容 | 风险 |
|---|---|---|---|
| R1 | `app/api/admin/uat-closure/route.ts`（新增 103 行）+ `drizzle/0063_uat_closure_batches.sql` | **新增一个管理端写数据的入口**：向 `uat-*` 租户直接写入合成账号、KYC 通过记录并把一笔贷款推到"已还清"，经 `applyAction` 做 `disburse`/`repay`，并带清理动作。保护：`UAT_CLOSURE_ENABLED='true'` + 请求头 `x-uat-closure-token` + 平台管理员 + 同源。令牌用 `!==` 比较（非恒定时间）。文档明确打算在**生产域名**开启后复放 | 新的数据写入口，未评审；与"不新增认证绕过/不破坏生产"的冻结原则冲突，**不得进入灰度或生产** |
| R2 | `lib/loan-signing.ts` | `matchesImmutable` 新增条件 `immutable.termsLocale==='zh'`，`contractFields` 增加 `termsLocale` | 改变合同不可变校验；**可能使此前已签合同（没有该字段）校验失败**；涉及法务口径 |
| R3 | `lib/team/server.ts`、`app/api/team/auth/route.ts`、`lib/team/auth.ts` | `platformAdmin()` 判定条件改写；新增 1 年期 Cookie `payease_last_team_company`；邀请接受改为"状态变更 + 审计"同批；员工公司 Cookie 不再回落到客户 Cookie；MFA 挑战表清理；机构到期在**读路径**上自动停用 | 认证与会话核心；读路径有写副作用；新增长期 Cookie |
| R4 | `lib/customer-shards.ts`、`lib/domain.ts`、`scripts/customer-rows/reverse-merge.mjs`、`lib/team/admin-funds.ts` | 改写幂等摘要的保留与淘汰（`pruneRequestDigests`、分片摘要过滤）、首次分片插入并入批事务、反向合并加 150 万字节上限、管理员一次性授权先占位再改工作区 | **与 main 已验证的 #42 幂等修复同一区域**，会冲突；改动正确性需要用 L1 的真实 HTTP 验收重新证明 |
| R5 | `drizzle/0062_staff_dual_control_scope.sql`、`db/schema` | `team_emergency_access` 增加 `target_role`、`target_unit_id`、`target_member_id` 三列与一个索引 | 迁移未评审；需确认向前兼容与回退脚本、与 main 将来迁移的编号顺序 |
| R6 | `app/api/institution/callback/route.ts`、`lib/institution-callback-queue.ts`、`app/api/team/institution-callbacks/route.ts` | 回调 nonce 在事件去重**之前**检查重放；人工重试开启新的重试周期 | 机构接口安全相关，方向看似正确，需评审 |
| R7 | `app/api/team/products/route.ts`、`app/api/kyc/review/route.ts`、`app/api/kyc/files/route.ts`、`app/api/team/customer-tags/route.ts`、`app/api/h5/locale/route.ts` | 权限与可见范围改动：`audit` 角色失去产品管理与审核权限、产品下线必须填写原因、审核员文件访问加团队角色校验、标签链接按 `canSee` 过滤、客户语言需公司已启用 | 属业务权限变更，需要业务确认，不是纯技术修复 |
| R8 | `lib/h5-auth-core.ts` | 替换旧验证码时按 `purpose` 区分 | 认证路径 1 行，方向合理，需核对对 OTP 流程的影响 |
| R9 | `deploy/standalone/server.mjs` | 遗留贷款回填改为 `revision+1` 的乐观锁并统计 `conflicts` | 网关启动路径；需测试覆盖 |
| R10 | 文档 `docs/uat-*.md`、`docs/telegram-ui-acceptance-2026-10-19.md` | 记录了在托管测试站 `khmerx-payease-demo.zhangdaowang3.chatgpt.site`（Sites 版本 323）和 **生产域名 `https://payease.khmerx.org/h5` 的 Telegram 设备端**做验收，并写明"生产专用租户浏览器操作""生产域名尚未接收本次修复"；另有"发布门禁"一条：测试站绑定远端 `main`，线上来源 `b1ab8f5…`（**不在 GitHub main**，只在本分支） | 说明存在与本计划并行的另一条发布与验收线，并有针对生产域名的操作；与本项目"不碰生产域名"的边界不一致，需要负责人说明归属与授权 |

## 4. 与 main 的冲突（`git merge-tree` 干跑，18 个文件）

`app/api/kyc/files/route.ts`、`app/api/telegram/route.ts`、`app/team/client.tsx`、`app/workspace.tsx`、`components/auth-locale.tsx`、`components/crm-subpages.tsx`、`components/customer-center.tsx`、`components/funding-panel.tsx`、`components/mini-shell.tsx`、`components/report-center.tsx`、`components/telegram-notifications.tsx`、`lib/customer-shards.ts`、`lib/notifications/server.ts`、`lib/team/admin-funds.ts`、`lib/team/workflow.ts`、`scripts/loadtest/README.md`、`tests/customer-shards.test.mjs`、`tests/team-integration.test.mjs`。

对应 main 上已评审的工作：C1-a/C1-b（员工端分页）、R2（语言组件）、R1-A/R1-B（通知重试审计）、#42（分片幂等）、C3-a。也就是说，**这条分支和 main 在同一批文件上有两套互相竞争的实现**。

它缺少 main 上的：L1-G（灰度 fixture 与压测入口）、R1/R2/R3、C1、C3-a、#42 重放修复、`scripts/loadtest/run-rows.sh` 与 `verify-rows.mjs`。

## 5. 扫描结果

- 新增 2263 行里**没有发现**密钥、Bearer、私钥块、手机号；只有测试用的 `uat-closure-test-token` 等合成值。
- 出现的主机：`khmerx-payease-demo.zhangdaowang3.chatgpt.site`（4 次）、`payease.khmerx.org`（1 次，文档）、若干 `*.example.test`。
- 自述验证（UAT 文档）：`npm test` 247 项 246 通过 1 跳过、typecheck 通过、lint 0 errors/647 warnings、`build` 与 `build:separated` 通过。**本次独立复跑结果见评审消息，未并入本清单。**

## 6. 建议的切分与评审顺序（每个 PR < 400 行，一个主题，基于最新 main 重做，不整体合并）

| 序 | 切片 | 内容 | 前置/备注 |
|---|---|---|---|
| S1 | 同源校验 | 给旧式路由补 `sameOrigin(request)` 与 `failure(e, request)`，并与 main 的 `route()` 封装对齐 | 机械、低风险，先做 |
| S2 | 机构回调 | nonce 先于事件去重；人工重试新周期 | 安全，需评审 |
| S3 | 可见范围修复 | 标签链接按 `canSee`；审核员文件访问校验；客户语言按公司启用 | 需业务确认 |
| S4 | 权限变更 | 产品管理与审核的角色收紧、下线原因 | **需业务/负责人确认**，不是技术修复 |
| S5 | 员工认证与会话 | 邀请接受原子审计、MFA 挑战清理、公司 Cookie 独立、`platformAdmin` 判定、`payease_last_team_company` | 高风险，逐条评审，单独验证 |
| S6 | 幂等与分片 | 摘要淘汰、首次插入入批、反向合并上限 | 与 #42 冲突，必须用 L1 的真实 HTTP 验收重证 |
| S7 | 管理员放款与遗留贷款回填 | 一次性授权占位、`legacy-loans.ts`、`server.mjs` 启动回填 | 含网关启动路径 |
| S8 | 迁移 0062 + schema | 紧急访问的目标范围列 | 需向前兼容与回退脚本 |
| S9 | 合同校验 | `termsLocale` 不可变校验 | **暂缓，需法务/产品决定**，并核对已签合同兼容 |
| S10 | UAT 入口（R1） | `admin/uat-closure` + 0063 | **默认排除**；若保留，必须单独评审且不得进入灰度与生产 |
| S11 | 前端微调 | 约 280 个排版/文案/无障碍提交，按页面分组，基于 C1 重做 | 与 C1 冲突最多，逐页回归，带 `team-menu-ui` 测试 |
| S12 | 工具与文档 | `audit:i18n`、lint 忽略项、`package-separated` 可部署目录、`SCENARIO` 参数、UAT 文档（脱敏） | 文档需去掉对生产域名的操作细节 |

## 7. 需要负责人决定的问题

1. 这条线的归属与授权：是并入计划（按 §6 切片），还是冻结？谁是它的负责人（署名苏晨与大旺，机器共享）？
2. 托管测试站（Sites）与 `payease.khmerx.org` 生产站各自的发布权限和流程，是否纳入本项目的闸门管理。
3. UAT 入口（R1）和对生产域名的验收操作是否授权；在没有书面授权前，保持排除。
4. 业务权限变更（S4）和合同校验（S9）是否同意。
5. 今后是否禁止"一条长期分支 + 自动发布"的做法，统一回到"任务卡 → 分支 → PR（< 400 行）→ 评审 → 负责人合并"。
