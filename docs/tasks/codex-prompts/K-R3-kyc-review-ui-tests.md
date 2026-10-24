# K-R3:KYC 审核工作台(#85/#86)的 UI 测试补强(只补测试)

来源:Claude 对 #85/#86(main `618a2da`)的独立评审。6 个 KYC 测试文件共 39 项通过,但对 `components/kyc-review.tsx` 做的 13 个变异里有 7 个存活;其中 5 个是真实的 UI 测试缺口。这些限制现在只靠服务端兜底(服务端 `decide()` 校验角色、状态、原因、修订号),UI 行为本身没有测试保护。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录。
**本卡只补测试,不改任何生产代码。**

## 1. 存活的变异与判断

变异都应用在 `components/kyc-review.tsx`(下表"精确替换"一列是评审时使用的字符串,可直接复用)。

| # | 变异 | 精确替换(原 → 改) | 判断 | 本卡 |
|---|---|---|---|---|
| R1 | 非"待审核"状态也显示决定区 | `mayDecide=mayReview&&record.status==='submitted'` → `mayDecide=mayReview` | UI 缺口;服务端有状态校验 | **必须杀死** |
| R5 | 审核意见可为空仍可提交 | `disabled={busy\|\|!reason.trim()\|\|` → `disabled={busy\|\|` | UI 缺口;服务端校验原因 | **必须杀死** |
| R6 | `approvalOnly`(admin)也能选"未通过" | `{!record.approvalOnly&&<option value="rejected">` → `{true&&<option value="rejected">` | UI 缺口;服务端对 admin 返回 403 | **必须杀死** |
| R8 | `approvalOnly` 也显示"代客户修改资料" | `{mayReview&&!record.approvalOnly&&['submitted','needs_info']` → `{mayReview&&['submitted','needs_info']` | UI 缺口;服务端对 admin 的代修改返回 403 | **必须杀死** |
| R9 | 只读用户的核对复选框仍可点 | `disabled={busy\|\|!mayDecide} onChange` → `disabled={busy} onChange` | UI 缺口 | **必须杀死** |
| R3 | 审计角色仍渲染查看器 | 把 `{auditSummary?<p className="notice">无权查看</p>:<KycMaterialViewer` 的条件改为 `false` | **等价**:服务端对 audit 已清空 `profile.files`,查看器只会显示"暂无材料" | 不要求杀死 |
| V3 | 缩放不限上限 | `setZoom(v=>Math.min(3,v+.25))` → `setZoom(v=>v+.25)` | **等价**:按钮在 `zoom>=3` 时已禁用,`Math.min` 冗余 | 不要求杀死 |

## 2. 先读
`components/kyc-review.tsx`(全文)、`tests/kyc-review-workspace.test.mjs`(`view(overrides)` 夹具:传入 `record`、`checks`、`reason`、`decision`、`busy`,返回 `nodes` 与 `changes`)、`lib/kyc/server.ts` 的 `decide()` 与 `staffView()`(只读,用来理解服务端到底拦了什么,**不得改**)。

## 3. 允许 / 禁止
- **允许**:`tests/kyc-review-workspace.test.mjs`(新增用例;可小幅扩展 `view()` 夹具,但不得改变现有 3 个用例的断言)。
- **禁止**:`components/**`、`app/**`、`lib/**` 的任何生产代码、服务端、`package.json`/lock、CI 工作流。
- **如果某条测试暴露了真实缺陷**(测试写对了却失败):**不要在本 PR 里修**,保留该用例并在 PR 描述里单独列出现象、复现输入与失败断言,等技术负责人决定。

## 4. 测试要求(必须能区分有无缺陷)

沿用 `view()` 夹具。所有断言用夹具返回的 `nodes`,按 `data-action="decide"` / `data-action="amend"` / `type` 找节点,不要依赖文案(夹具里 `kycText` 是恒等函数,断言文案会随语言变化)。

- **T1 决定区只在"待审核"出现(杀 R1)**:`status` 取 `submitted` 时存在 `data-action="decide"` 的按钮、`select`、`textarea`;取 `approved`、`rejected`、`needs_info`、`draft` 时这三者都不存在。
- **T2 审核意见必填、核对只对"通过"必填(杀 R5)**:`decision:'approved'`、所有分区已勾选:`reason` 为空串和仅空白(例如 `'   '`)时按钮 `disabled===true`;`reason` 为 `'x'` 时 `disabled===false`。再测 `decision:'needs_info'`、没有任何勾选、`reason:'x'`:按钮可用(只有"通过"才要求所有分区已核对)。
- **T3 `approvalOnly` 的选项与按钮(杀 R6、R8)**:
  - `record.approvalOnly:true`:`select` 里只有 `approved` 一个选项;**不存在** `data-action="amend"`。
  - `record.approvalOnly` 为假、`canReview` 非 `false`、`status:'submitted'`:选项为 `needs_info`、`approved`、`rejected`;存在 `data-action="amend"`。
  - 代修改按钮:`status` 为 `submitted`、`needs_info` 时存在,为 `approved`、`rejected` 时不存在。
- **T4 只读与忙碌时的禁用(杀 R9)**:`canReview:false`(状态取 `submitted`)时,所有 `checkbox` 的 `disabled===true`;`canReview` 非 `false`、`busy:true` 时,所有 `checkbox`、`select`、`textarea` 与决定按钮都 `disabled===true`。
- **T5(可选)**:`approvalOnly` 时,审核端加载资料后的默认决定是 `approved`(这条逻辑在 `app/kyc/client.tsx` 的 `accept`,若在 `tests/kyc-review-navigation.test.mjs` 现有的 `reviewer()` 夹具里能低成本断言,就加;不能,就在 PR 描述里说明为什么没加)。

## 5. 变异要求(PR 描述附结果表)

用 §1 表中的精确替换逐个应用到 `components/kyc-review.tsx`,运行 `node --test tests/kyc-review-workspace.test.mjs tests/kyc-review-navigation.test.mjs tests/kyc-material-viewer.test.mjs`:
- R1、R5、R6、R8、R9 **每一个都必须有至少一个测试失败**;还原后全部通过。
- 每个变异写明:应用的替换、失败的测试名。若某个变异仍存活,必须说明并证明等价,不能默认放过。
- 变异后务必还原文件,`git diff` 中不得出现 `components/` 下的改动。

## 6. 验收
1. 评审环境基线:在 main `618a2da` 上,`kyc-customer-copy`、`kyc-review-navigation`、`kyc-queue`、`kyc-upload`、`kyc-review-workspace`、`kyc-material-viewer` 共 39 项通过;本卡完成后这些全部保持通过,新增的用例另算。不降低、不删除原有用例。
2. 变更文件只有 `tests/kyc-review-workspace.test.mjs`(T5 如做,可加 `tests/kyc-review-navigation.test.mjs`);`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动,没有生产代码改动。
4. 说明未覆盖的部分(例如没有真实浏览器验证)。不要把"未验证"写成"已验证"。

## 7. 不在本卡范围(另议,不要顺手做)
- PDF 预览:查看器用 `<object type="application/pdf">` 内嵌,而服务端对 PDF 强制 `Content-Disposition: attachment`,多数浏览器不会渲染;需要在真实浏览器确认,确认前不要改组件。
- `components/kyc-review.tsx` 里写死的中文("审计只读:敏感资料仅由 KYC 审核岗位查看"、"无权查看")没有本地化。
- 审计角色经 `?review=1` 直接请求文件接口的授权问题(#85 之前就存在,未改变)。

## 8. 交付
- 新分支基于**最新** `origin/main`,开 **Draft PR**,不标 Ready,不合并,不关闭任何 PR。
- PR 描述写明:新增用例、变异结果表、`git diff --stat`、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
