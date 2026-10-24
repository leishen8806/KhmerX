# K-R4:KYC 补件(#87/K4)与审核决定按钮的 3 处测试缺口(只补测试)

来源:Claude 对 #87 和 K-R3 的独立评审。两轮变异测试共留下 3 个存活变异,都是测试缺口,不是生产缺陷。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录。
**本卡只补测试,不改任何生产代码。**

## 1. 三个存活变异

| # | 位置 | 精确替换(原 → 改) | 为什么存活 | 文件 |
|---|---|---|---|---|
| Q5 | `lib/kyc/requests.ts` | `raw.length>32` → `raw.length>320` | 现有"超出上限"用例用的是 `Array(33).fill(item)`:33 个**完全相同**的项目会先被"重复目标"拒绝,上限本身没被单独测到。核心定义里有 36 个字段,所以 33 个**不重复**的目标是可达的 | `tests/kyc-requests.test.mjs` |
| C1 | `app/kyc/client.tsx` 的 `decide()` | `...(decision==='needs_info'&&requests.length?{requests}:{})` → `...(requests.length?{requests}:{})` | 没有任何测试断言"只有退回补件才会发送 `requests`"。如果改成总是发送,审核员先勾了补件再把决定改成通过,服务端会返回 400 | `tests/kyc-review-navigation.test.mjs`(或 `kyc-review-workspace.test.mjs`) |
| X6 | `components/kyc-review.tsx` | `disabled={busy\|\|requestsIncomplete\|\|` → `disabled={requestsIncomplete\|\|` | 现有"忙碌时禁用"用例用默认参数(决定为 `approved`、没有勾选),按钮本来就因"通过需全部勾选"而被禁用,所以断言与 `busy` 无关 | `tests/kyc-review-workspace.test.mjs` |

## 2. 先读
`lib/kyc/requests.ts`(`parseRequests`)、`components/kyc-review.tsx`(决定区、`requestsIncomplete`)、`components/kyc-supplement.tsx`(`RequestEditor`)、`app/kyc/client.tsx` 的 `decide()` 与 `KycReview` 的调用处、三个目标测试文件的夹具。服务端 `lib/kyc/server.ts` 的 `decide()` 只读,**不得改**。

## 3. 允许 / 禁止
- **允许**:`tests/kyc-requests.test.mjs`、`tests/kyc-review-navigation.test.mjs`、`tests/kyc-review-workspace.test.mjs`(新增用例;可小幅扩展夹具,但不得改变现有用例的断言)。
- **禁止**:`components/**`、`app/**`、`lib/**` 的任何生产代码、服务端、`package.json`/lock、CI 工作流。
- **如果某条测试暴露了真实缺陷**(测试写对了却失败):**不要在本 PR 里修**,保留该用例并在 PR 描述里单独列出现象、复现输入与失败断言。

## 4. 测试要求(必须能区分有无缺陷)

### Q5 补件项目数量上限
- 用 `fields.slice(0,33).map(f=>({...item,target:'field:'+f.id}))`(33 个**互不相同**的目标)断言 `parseRequests` 抛错;用同样方式取 32 个断言通过(现有用例已覆盖 32 个,可复用或保留)。
- 目的是让"超出 32 项"这条规则单独成立,不依赖重复目标检查。写一行注释说明为什么要用不同目标。
- 前提:`fields.length>=33`(评审时为 36)。若将来字段少于 33,测试要显式失败并提示原因,不要悄悄通过。

### C1 补件项目只随"退回补件"发送
夹具要让审核端提交决定时返回成功(`kyc-review-navigation.test.mjs` 的 `reviewer()` 夹具目前对 POST 一律抛错,需要在测试里扩展一个可返回记录的版本,只在测试文件内改)。断言发出的 POST 请求体:
- `decision==='needs_info'` 且已选了补件项目(通过 `RequestEditor` 的复选框和原因选择产生):请求体含 `requests`,内容与所选一致。
- 先选了补件项目,再把决定改成 `approved`(所有分区已勾选、已填审核意见):请求体**不含** `requests` 字段。`rejected` 同理。
- `needs_info` 但没有选任何补件项目:请求体**不含** `requests` 字段(不能是空数组,保持旧记录兼容)。

### X6 忙碌时决定按钮禁用,且与"通过需全部勾选"隔离
- 所有分区已勾选、`reason` 已填、`decision:'approved'`、`busy:true`:决定按钮 `disabled===true`;同样条件 `busy:false` 时 `disabled===false`(证明禁用确实来自 `busy`,而不是别的条件)。
- 再补一条补件完整性:`decision:'needs_info'`、有一个补件项目但 `reasonCode` 为空(或 `other` 且说明为空),决定按钮 `disabled===true` 且出现提示;补全后 `disabled===false`。(`requestsIncomplete` 这一条需要单独跑变异确认被杀死,见 §5。)

## 5. 变异要求(PR 描述附结果表)

把 §1 的精确替换逐个应用,各自运行对应文件;每个变异**必须至少有一个测试失败**,还原后全部通过:
- Q5 → `node --test tests/kyc-requests.test.mjs`
- C1 → `node --test tests/kyc-review-navigation.test.mjs tests/kyc-review-workspace.test.mjs`
- X6 → `node --test tests/kyc-review-workspace.test.mjs tests/kyc-review-navigation.test.mjs`
- **额外变异 X7**:`components/kyc-review.tsx` 中 `disabled={busy||requestsIncomplete||!reason.trim()||` → `disabled={busy||!reason.trim()||`(去掉 `requestsIncomplete`)→ 必须有测试失败。评审时没有单独跑过这一条,请跑并报告;若存活,补用例杀死它。
- 每个变异写明:应用的替换、失败的测试名。若某个变异仍存活,必须说明并证明等价。
- 变异后务必还原,`git diff` 里不得出现 `components/`、`app/`、`lib/` 下的改动。

## 6. 验收
1. 评审基线:main `a0437ac` 上 8 个 KYC 测试文件(`kyc-customer-copy`、`kyc-review-navigation`、`kyc-queue`、`kyc-upload`、`kyc-review-workspace`、`kyc-material-viewer`、`kyc-requests`、`kyc-supplement-ui`)共 55 项通过,`team-integration` 61 项通过(评审在 `5a6977f` 上跑过;`a0437ac` 之后只多测试)。本卡完成后这些全部保持通过,新增用例另算;不降低、不删除原有用例。
2. 变更文件只限 §3 的三个测试文件;`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动,没有生产代码改动。
4. 说明未覆盖的部分(例如没有真实浏览器验证)。不要把"未验证"写成"已验证"。

## 7. 不在本卡范围(另议)
- 旧 `needs_info` 记录(没有结构化补件项目)的跳转精度:`supplementStep` 不再根据原因文字推断步骤,旧记录只会按已勾选分区跳转或回到第一步。是否恢复需要技术负责人决定。
- 补件相关新增的高棉语与英文文案人工校对。
- PDF 预览、审核组件里写死的中文本地化(见 K-R3 §7)。

## 8. 交付
- 新分支基于**最新** `origin/main`,开 **Draft PR**,不标 Ready,不合并,不关闭任何 PR。
- PR 描述写明:新增用例、变异结果表、`git diff --stat`、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
