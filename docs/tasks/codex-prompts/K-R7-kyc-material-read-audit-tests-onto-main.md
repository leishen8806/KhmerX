# K-R7:把 K-R6(#125)的材料读取审计测试并入最新 main(解决冲突,只改测试)

来源:Claude 对 #125(K-R6,头部 `59b8af6`)、#126、#127 的独立评审。#125 与 main 已冲突:#127(main `9984dcd`)改了 `tests/kyc-material-read-audit.test.mjs` 里同一个用例。#125 的测试经我评审通过(12 个变异里 11 个被杀死,另 1 个为等价),但没能合入。本卡把它**重新落在最新 main 上**。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录。
**本卡只改测试,不改任何生产代码。**

## 1. 背景

`lib/kyc/material-read-audit.ts` 的去重键含 tenant、actor、case、revision、slot、file、action 和 30 秒桶。键里丢掉 actor 会让第二个审核员在 30 秒内读取同一份材料不被审计,这是审计漏洞。对该文件的变异测试结论(在 main `9984dcd` 上):

| 变异 | main 现状 | 目标 |
|---|---|---|
| D1 键缺 actor | 已被杀死(#127 并入了 actor 维度) | 保持 |
| D2 键缺 revision | 已被杀死(#127) | 保持 |
| D3 键缺 case | **存活** | 杀死 |
| D4 键缺 slot | **存活** | 杀死 |
| I1 `inserted` 永远为真 | **存活** | 杀死 |
| C1 `ON CONFLICT(id)` 放宽成 `ON CONFLICT` | **存活** | 杀死 |
| N1 `nowMs` 不检查是否有限 | 存活,**等价**(`new Date(NaN).toISOString()` 本身会抛) | 不要求 |

#125 里的 7 个新用例正好覆盖 D1–D4、I1、C1,并多了 tenant 独立。

## 2. 先读
`tests/kyc-material-read-audit.test.mjs`(main 当前版本,4 个用例)、#125 的提交 `59b8af6`(`git show 59b8af6 -- tests/kyc-material-read-audit.test.mjs`,远端分支 `feat/server/K-R6-kyc-material-read-audit-dedup-tests`)、`lib/kyc/material-read-audit.ts`(只读)。

## 3. 允许 / 禁止
- **允许**:`tests/kyc-material-read-audit.test.mjs`。
- **禁止**:`lib/**`、`app/**`、`components/**`、`drizzle/**`、其它测试文件(包括 `kyc-audit-manifest-eval.test.mjs`)、服务端、`package.json`/lock、CI 工作流。
- **不要**对 #125 的分支 `feat/server/K-R6-…` 强制推送或改写历史;新建分支。

## 4. 做法

新分支基于**最新** `origin/main`(`2c87dfa` 或更新),分支名建议 `feat/server/K-R7-kyc-material-read-audit-tests`。把 #125 的内容**手工并入**(不要直接 `git merge` 解决冲突了事):

1. **夹具**:main 的 `fixture()` 只插入 `tenant-a`。把 `INSERT INTO team_companies VALUES ('tenant-a')` 扩展为 `('tenant-a'),('tenant-b')`。main 里"FK 失败可重试"用例会另插 `tenant-retry`,与此不冲突,该用例末尾的总行数断言(4)不受影响;请确认。
2. **保留** main 现有的 4 个用例**原样**,尤其是 #127 并入的 "two module instances share one key and actor/revision/file/action dimensions create independent rows"。**不得改变它的断言。**
3. **新增** #125 的 7 个用例(名称可按 main 风格微调,逻辑不变):
   - actor 独立:同一时间桶、`actorId` 为 `reviewer-a`/`reviewer-b`,2 行、`actor` 列不同、`id` 不同;同 actor 重读返回 `inserted:false` 且仍为 2 行。
   - revision 独立:`revision` 3 与 4,2 行,`detail` 里的 `revision` 不同;同 revision 重读不新增行。
   - case 独立:`caseId` 为 `case-1`/`case-2`、其它不变,2 行。
   - slot 独立:`slot` 为 `idFront`/`idBack` **且 `fileId` 相同**,2 行。**不要用不同的 `fileId` 凑独立行**,否则 D3、D4 仍会存活。
   - tenant 独立:`tenant-a`/`tenant-b`,2 行,`tenant_id` 列不同。
   - `inserted`:首次 `true`,同桶第二次 `false`;两次的 `id`、`bucket`、`createdAt` 相同。
   - 只吞主键冲突:在该用例里 `CREATE UNIQUE INDEX team_audit_actor_action_time ON team_audit(tenant_id,actor,action,created_at)`;同一 `nowMs`、同 tenant 与 actor、不同 `fileId` 的第二次调用必须**抛出** `/UNIQUE/`,表里只剩第一行;同 `fileId` 重复调用则静默返回 `inserted:false`、不抛错、仍只有一行。
4. actor、revision 的新用例与 main 里已合入的组合用例有部分重复,这是有意的:组合用例验证"多维度同时独立",新用例验证"单维度独立加 `inserted`、列值、重复读取"。不要为了去重而删减任一边。

## 5. 变异要求(PR 描述附结果表)

在 `lib/kyc/material-read-audit.ts` 上逐个应用下面的精确替换,运行 `node --experimental-vm-modules --test tests/kyc-material-read-audit.test.mjs tests/kyc-audit-manifest-eval.test.mjs`,每个都必须至少有一个测试失败,还原后全部通过:

| # | 精确替换(原 → 改) |
|---|---|
| D1 | `tenantId:context.tenantId,actorId:context.actorId,caseId` → `tenantId:context.tenantId,caseId` |
| D2 | `revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `slot:context.slot,fileId:context.fileId,action:context.action,bucket` |
| D3 | `caseId:context.caseId,revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` |
| D4 | `slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `fileId:context.fileId,action:context.action,bucket` |
| I1 | `inserted:Number(result.meta?.changes\|\|0)===1` → `inserted:true` |
| I1b | 同上,改成 `inserted:false` |
| C1 | `ON CONFLICT(id) DO NOTHING` → `ON CONFLICT DO NOTHING` |
| T1 | `{tenantId:context.tenantId,actorId` → `{actorId` |
| B1 | `action:context.action,bucket})` → `action:context.action})` |
| CA | `new Date(nowMs).toISOString()` → `new Date(Math.floor(nowMs/30_000)*30_000).toISOString()` |

- N1(`\|\|!Number.isFinite(nowMs)` 删除)预期存活,属于等价变异:请报告,不要强行杀死。
- 每个变异写明替换和失败的测试名。变异后务必还原;`git diff` 里不得出现 `lib/`、`app/`、`components/`、`drizzle/` 下的改动。
- 如果某个变异仍存活,必须说明并证明等价。

## 6. 验收
1. 评审基线:main `2c87dfa` 上 `kyc-material-read-audit`(4 项)加 `kyc-audit-manifest-eval`(2 项)共 6 项通过;`team-integration`、`http-contract`、`kyc-reveal` 共 76 项通过。完成后预期前一组为 13 项(6 + 7 个新用例)、后一组仍为 76 项,不降低、不删除原有用例。
2. 变更文件只有 `tests/kyc-material-read-audit.test.mjs`;`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动,没有生产代码改动。
4. 测试里全部是合成值。说明未覆盖的部分,不要把"未验证"写成"已验证"。

## 7. 不在本卡范围(另议)
- manifest 校验的排序风险(与 manifest 末记录同一 `created_at` 但 id 排序在前、或补写实际时间更早的记录,会让有界前缀变化并报告"被篡改"):已由 #127 的特征测试记录,**不在这里改测试或算法**;是否修复由技术负责人决定。
- 10 万行量级的 manifest 创建与校验耗时没有测。
- 计划 Task 1b(把审计接入 `/api/kyc/files?review=1`)和 Task 2:更高风险,**必须合并前评审**。
- Task 0(audit 角色文件读取拒绝)需要技术负责人本人批准。

## 8. 交付
- 推送新分支。**如果无法创建 PR(例如 GitHub 返回 404 或没有仓库 API 权限),不要反复尝试或用别的账号绕过**:在回报里写明分支名和提交号,由技术负责人或有权限的会话创建 Draft PR。不标 Ready,不合并,不关闭任何 PR(包括 #125;合并本卡后由技术负责人关闭 #125)。
- PR 描述或回报写明:并入的用例、变异结果表、`git diff --stat`、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
