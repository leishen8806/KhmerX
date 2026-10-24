# K-R2:KYC 通过后分组全部可点(重写 #76 中唯一未进 main 的行为)

来源:Claude 对 #75/#76 的独立评审(`docs/reviews/kyc-ux-pr75-76-78-84-95-20261024.md` §2)。技术负责人 2026-10-24 决定:**关闭 #75;#76 重写**。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录。
本卡只重写下面这一个行为。不要把 #76 的其它内容带进来。

## 1. 背景与证据

| # | 事实 | 证据 |
|---|---|---|
| K2-F1 | #76(`6e11b8b`,单提交,基于 #74 之前的 main `a483612`)的本地化与"隐藏内部元数据"在 main 里已有等价实现(#78/#79 及其后的 #80–#84) | 评审记录 §2 |
| K2-F2 | **#76 独有且 main 没有的行为**:客户 KYC 状态为 `approved` 后,分组按钮全部显示为"已完成"、全部可点、没有"当前"分组 | #76 的 `app/kyc/client.tsx`:`const approved=record?.status==='approved'`,分组渲染处 `current=!approved&&…`、`complete=approved\|\|(…)`、`locked=!approved&&first>activeIndex` |
| K2-F3 | main 当前的分组按钮:`complete` 只看 `activeIndex`,`locked=first>activeIndex`,没有 `approved` 分支;通过后的资料是只读(`editable` 只对 `draft`/`needs_info` 为真) | main `app/kyc/client.tsx` 分组渲染处与 `const editable=…` |
| K2-F4 | **不要照搬 #76 的代码**:其审核端步骤按钮是 `disabled={i>activeIndex}`,会重新引入 #75/#78 已修掉的锁定;且 #76 基于已回退的 #74 前的 main,与当前 main 冲突 | 评审记录 §2;合并模拟冲突 |
| K2-F5 | #76 给通过横幅加了类 `kyc-approved-banner`,但全仓没有任何 CSS 定义这个类,等于死类 | `git grep kyc-approved-banner 6e11b8b -- app` 只命中 TSX |

## 2. 先读
`app/kyc/client.tsx`(分组按钮渲染 `clientStepGroups.map`、`activeIndex`、`editable`、`leave` 拦截、通过横幅)、`tests/kyc-customer-copy.test.mjs` 的 `customer()` 夹具(已支持 `status`、`mini` 参数)、`tests/kyc-review-navigation.test.mjs`(审核端行为的现有保护)。

## 3. 允许 / 禁止
- **允许**:`app/kyc/client.tsx`(仅限分组按钮的 `current`/`complete`/`locked` 计算与点击处理,以及通过横幅的最小改动)、`tests/kyc-customer-copy.test.mjs`(新增用例;如需要独立文件,新增 `tests/kyc-approved-groups.test.mjs`,沿用同样的 vm 夹具写法)。
- **禁止**:服务端、`lib/kyc/**`、`components/**`、`app/globals.css`、`app/kyc-overrides.css`(除非你要给横幅加样式,见 §4 第 5 条,且必须在 PR 里说明)、审核端分区导航与审核"下一步"逻辑、`package.json`/lock、CI 工作流。

## 4. 行为定义(必须满足)

1. **仅当** `!review` 且 `record.status==='approved'` 时:所有分组按钮 `data-state` 为 `complete`、不禁用、没有 `aria-current`(没有"当前"分组)。
2. 点击行为:Mini App 里点击分组仍走 `navigate('/h5/kyc?group=<id>')`;非 Mini 里点击切到该分组的第一个步骤(`g.steps[0]`,不要再用 `activeIndex` 算目标)。点击后显示的是**只读**资料:`editable` 保持为假,不得出现可编辑输入、保存、提交按钮。
3. 其它状态**一律不变**:`draft`、`needs_info`、`submitted`、审核端(`review`)的分组/步骤锁定与"当前/完成/待完善"逻辑与当前 main 逐字等价。
4. 不改保存、校验、离开页面自动保存(`leave` 拦截)等任何数据路径。`approved` 时 `dirty` 本就不应为真;如发现可达路径,在 PR 里说明,不要自己加分支。
5. 通过横幅:保持现有 `success`/`role="status"`。是否保留 `kyc-approved-banner` 这个类由你决定,但**不能加一个没有任何样式的类**:要么不加,要么在 `app/kyc-overrides.css` 里给出明确且最小的样式并在 PR 说明理由。

## 5. 测试(必须能区分有无修复,**变异测试要被杀死**)
夹具用 `customer({status:'approved', mini:true|false, locale})`。

- **T1 通过后全部完成且可点**:`approved` + Mini:每个分组按钮 `disabled` 为假、`data-state==='complete'`、无 `aria-current`。非 Mini 同样。
- **T2 点击目标**:Mini:点击任一分组调用 `navigate('/h5/kyc?group=<id>')`;非 Mini:点击后进入该分组的 `steps[0]`。
- **T3 通过后只读**:`approved` 时渲染结果中没有保存、提交、下一步按钮,输入框不可编辑(沿用现有断言方式;若现有页面对只读的表达是 `disabled`,就断言它)。
- **T4 其它状态不变**:`draft`(`activeIndex` 为 0)时第二个及之后的分组仍为 `disabled` 且 `data-state==='upcoming'`;`submitted` 同样不受影响。
- **T5 审核端不变**:`review` 时审核分区按钮仍不因 `activeIndex` 锁定,"下一步"仍不发 POST(现有 `kyc-review-navigation.test.mjs` 必须原样通过)。
- **变异要求(PR 描述附结果表)**:
  ① 去掉 `approved` 对 `complete` 的覆盖 → T1 必须失败;
  ② 去掉 `approved` 对 `locked` 的覆盖 → T1 必须失败;
  ③ 把 `approved` 条件放宽成 `submitted` 也适用 → T4 必须失败;
  ④ 让非 Mini 点击仍用 `activeIndex` 算目标 → T2 必须失败。
  存活的变异必须说明并证明等价,不能默认放过。
- 原有 KYC 4 个测试文件(`kyc-customer-copy`、`kyc-review-navigation`、`kyc-queue`、`kyc-upload`)全部保持通过;不降低、不删除用例。评审环境基线:main `e1edddd` 之后为 4 个文件共 30 项。

## 6. 验收
1. 基线与本卡测试全部通过;变异表齐全。
2. 变更文件只有 §3 允许的文件;`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动;审核端行为未变。
4. 说明未覆盖的部分(例如未做真实浏览器验证)。不要把"未验证"写成"已验证"。

## 7. 不在本卡范围
- #76 里的本地化与隐藏内部元数据(main 已有等价实现)。
- 上传错误码文案与网络重试孤儿文件、译文人工校对(另议)。

## 8. 交付
- 新分支基于**最新** `origin/main`,开 **Draft PR**,不标 Ready,不合并,不关闭任何 PR(包括 #75、#76:是否关闭由技术负责人操作)。
- PR 描述写明:改动、测试、变异结果表、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
