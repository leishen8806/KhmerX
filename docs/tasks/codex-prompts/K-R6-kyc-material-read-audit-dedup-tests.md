# K-R6:材料读取审计(#121)去重维度的测试补强(只补测试)

来源:Claude 对 #121(`feat/server/kyc-r3a-read-audit-helper`,头部 `58721de`,已于 main `02f2435` 合入)的独立评审。对 `lib/kyc/material-read-audit.ts` 做了 28 个变异,其中去重键维度有 4 个存活,另有 2 个测试缺口。依据:`docs/plans/2026-10-26-kyc-r3-view-audit.md` 的 Task 1a 与 Review Focus("不同岗位用户、版本、材料、意图不能相互去重")。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录。
**本卡只补测试,不改任何生产代码。** 不接路由(那是计划的 Task 1b,另行评审)。

## 1. 为什么重要

这个函数的去重键包含 tenant、actor、case、revision、slot、file、action 和 30 秒桶。**如果以后有人把 actor 从键里弄丢,第二个审核员在 30 秒内读取同一份材料就不会被审计**;revision 同理。这是审计漏洞,不是普通的去重 bug。现有测试只验证了 fileId 与 action 两个维度,所以这类回归不会被发现。

## 2. 存活的变异与判断

对象是 `lib/kyc/material-read-audit.ts`,精确替换如下(`keyJson` 函数内)。

| # | 变异 | 精确替换(原 → 改) | 判断 | 本卡 |
|---|---|---|---|---|
| D1 | 键里去掉 actor | `tenantId:context.tenantId,actorId:context.actorId,caseId:context.caseId,revision:context.revision,slot` → `tenantId:context.tenantId,caseId:context.caseId,revision:context.revision,slot` | **真实缺口**:不同审核员相互去重,第二人读取不被审计 | **必须杀死** |
| D2 | 键里去掉 revision | `revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `slot:context.slot,fileId:context.fileId,action:context.action,bucket` | **真实缺口**:同一份材料在不同审核视图版本下相互去重 | **必须杀死** |
| D3 | 键里去掉 case | `caseId:context.caseId,revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket` | 低风险:文件号目前唯一决定案件,但键的设计包含它 | 必须杀死 |
| D4 | 键里去掉 slot | `slot:context.slot,fileId:context.fileId,action:context.action,bucket` → `fileId:context.fileId,action:context.action,bucket` | 低风险:同上 | 必须杀死 |
| I1 | 返回值 `inserted` 永远为真 | `inserted:Number(result.meta?.changes\|\|0)===1` → `inserted:true` | 测试缺口:目前没有调用方使用,但 Task 1b 会用它判断是否新写入 | 必须杀死 |
| C1 | 冲突子句放宽 | `ON CONFLICT(id) DO NOTHING` → `ON CONFLICT DO NOTHING` | 现有夹具只有主键一个唯一约束,放宽检测不到;计划要求"只针对主键冲突" | 必须杀死(见 §3.3) |
| N1 | `nowMs` 不检查是否有限 | `\|\|!Number.isFinite(nowMs)` → 删除 | **等价**:`new Date(NaN).toISOString()` 本身就抛 `RangeError` | 不要求杀死 |

## 3. 先读
`lib/kyc/material-read-audit.ts`(全文)、`tests/kyc-material-read-audit.test.mjs`(尤其 `fixture()`、`base`、"two module instances share one key and dimensions create independent rows")、`docs/plans/2026-10-26-kyc-r3-view-audit.md` 的 Task 1a、`drizzle/0003_sticky_blonde_phantom.sql`、`drizzle/0025_immutable_audit.sql`、`drizzle/0042_public_identifiers.sql`(只读,了解真实的 `team_audit` 约束)。

## 4. 允许 / 禁止
- **允许**:`tests/kyc-material-read-audit.test.mjs`(新增用例;可扩展夹具,但不得改变现有用例的断言)。如必须,可新增 `tests/helpers/` 下的辅助文件。
- **禁止**:`lib/**`、`app/**`、`components/**` 的任何生产代码、`drizzle/**`、服务端、`package.json`/lock、CI 工作流。
- **如果某条测试暴露了真实缺陷**(测试写对了却失败):**不要在本 PR 里修**,保留该用例并在 PR 描述里单独列出现象、复现输入与失败断言。

## 5. 测试要求(必须能区分有无缺陷)

沿用现有 `fixture()` 与 `base`。固定同一个时间桶内的 `nowMs`(例如 `Date.parse('2026-10-26T08:00:12.000Z')`),所有"独立行"断言都用同一个 `nowMs`,避免被桶边界干扰。

### 5.1 actor 独立(杀 D1)
- 同一 tenant、case、revision、slot、file、action、同一时间桶,`actorId` 分别为 `reviewer-a` 与 `reviewer-b`:断言写入 **2 行**,两行的 `actor` 列不同,两次返回 `inserted===true` 且 `id` 不同。
- 对照:同一 `actorId` 再读一次,**仍为 2 行**(同桶内去重),`inserted===false`。

### 5.2 revision 独立(杀 D2)
- 其它维度相同,`revision` 分别为 `3` 与 `4`:断言 **2 行**,两行 `detail` 里的 `revision` 不同。
- 对照:相同 `revision` 再读,不新增行。

### 5.3 case 与 slot 独立(杀 D3、D4)
- 其它维度相同,`caseId` 不同(`case-1`、`case-2`):2 行。
- 其它维度相同,`slot` 不同(`idFront`、`idBack`,且 `fileId` 相同):2 行。(这两个组合在真实数据里不会出现,但键的设计包含它们,测试要钉住键的完整性。)
- 注意:不要用 `fileId` 不同来凑独立行,否则 D3、D4 仍会存活。

### 5.4 tenant 独立(回归保护)
- 其它维度相同,`tenantId` 不同:需要在夹具里再插入一个 `team_companies('tenant-b')`,断言 2 行,`tenant_id` 列不同。

### 5.5 返回值 `inserted`(杀 I1)
- 首次写入返回 `inserted===true`,同桶内第二次返回 `inserted===false`;返回的 `id`、`bucket`、`createdAt` 在两次中的 `id` 与 `bucket` 相同。

### 5.6 只吞主键冲突(杀 C1)
计划要求"只吞 id 冲突,其他 SQL/FK 错误必须抛出"。现有夹具的 `team_audit` 只有主键一个唯一约束,所以把 `ON CONFLICT(id)` 放宽成 `ON CONFLICT` 检测不到。做法:
- 在**这一条测试自己的夹具**里给 `team_audit` 加一个非主键的唯一约束:`UNIQUE(tenant_id,actor,action,created_at)`(用单独建表或在该用例里 `CREATE UNIQUE INDEX`,不要影响其它用例)。
- 用**同一个 `nowMs`、同一 tenant 和 actor、但不同的 `fileId`** 连续调用两次:两次的主键 `id` 不同(键里含 `fileId`),但 `created_at`、`actor`、`action`、`tenant_id` 相同,第二次会触发这个**非主键**唯一冲突。
- 断言:第二次调用 **抛出**唯一约束错误(例如 `assert.rejects(…,/UNIQUE/)`),且表中只有第一行;**不得**静默返回 `inserted:false`。
- 对照:同一用例里再做一次"主键冲突"(同 `fileId` 重复调用),应静默返回 `inserted:false`、不抛错、仍只有一行。
- 如果你判断在不改生产代码的前提下无法稳定构造,请在 PR 描述里写明原因和尝试过的方法,把 C1 标为"存活,无法区分",不要硬凑一个脆弱的测试。

## 6. 变异要求(PR 描述附结果表)

把 §2 的精确替换逐个应用到 `lib/kyc/material-read-audit.ts`,运行 `node --experimental-vm-modules --test tests/kyc-material-read-audit.test.mjs tests/kyc-audit-manifest-eval.test.mjs`:
- D1、D2、D3、D4、I1 **每一个都必须至少有一个测试失败**;C1 按 §5.6 处理(能杀死就杀死,不能就写清楚原因)。还原后全部通过。
- 每个变异写明:应用的替换、失败的测试名。若某个变异仍存活,必须说明并证明等价。
- N1 预期存活(等价),请报告而不是强行杀死。
- 变异后务必还原,`git diff` 里不得出现 `lib/`、`app/`、`components/`、`drizzle/` 下的改动。

## 7. 验收
1. 评审基线:main `02f2435` 上 `kyc-material-read-audit`(4 项)与 `kyc-audit-manifest-eval`(1 项)共 5 项通过;`team-integration`、`http-contract`、`kyc-reveal` 共 74 项通过。本卡完成后这些全部保持通过,新增用例另算;不降低、不删除原有用例。
2. 变更文件只限 §4 的文件;`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动,没有生产代码改动。
4. 测试里不得出现真实租户、操作人、案件或文件号;全部是合成值。说明未覆盖的部分,不要把"未验证"写成"已验证"。

## 8. 不在本卡范围(另议)
- 计划 Task 1b(把审计接入 `/api/kyc/files?review=1`)与 Task 2(查看器接入):更高风险,**必须合并前评审**。
- `tests/kyc-audit-manifest-eval.test.mjs` 是合成评估:它在测试里自己重新实现了摘要函数,没有 import 真实的 `lib/team/audit-integrity.ts`,所以证明的是算法性质而不是现有系统的行为。计划 Task 1a 要求的"manifest 副作用评估"需要用真实代码在 1 千/1 万/10 万行上测量,另行安排。
- `auditMaterialRead` 签名与计划不一致:计划是 `(context, nowMs): Promise<void>`,实现是 `(context, nowMs, db)` 且返回 `{id,createdAt,bucket,inserted}`。Task 1b 接入时要确认传入的是真实的 `team_audit` 连接。
- 计划的 Task 0(audit 角色文件读取拒绝)需要技术负责人本人批准,不在本卡。

## 9. 交付
- 新分支基于**最新** `origin/main`(`02f2435` 或更新),开 **Draft PR**,不标 Ready,不合并,不关闭任何 PR。
- PR 描述写明:新增用例、变异结果表、`git diff --stat`、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
