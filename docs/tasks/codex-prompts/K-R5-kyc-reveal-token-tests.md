# K-R5:KYC 敏感资料揭示令牌与代修改的 3 处测试缺口(只补测试)

来源:Claude 对 #113/#114(main `b277771`)的独立评审。对 `lib/kyc/reveal-token.ts`、`lib/kyc/sensitive-amend.ts` 等做了 19 个变异,14 个被抓住,5 个存活;其中 3 个是真实的测试缺口(T3、T4、A1),本卡补齐。另外 2 个存活变异(R1、P4)判定为等价,不要求处理。
冻结:L2/Q12 = HOLD;灰度/VPS = HOLD;不操作 159.223.77.134、165.22.108.5;不访问任何 khmerx.org 域名;**不改服务端**;不改认证、限流、迁移、贷款规则、部署配置、CI 工作流;不联网安装依赖、不新增依赖;只用虚构数据,不发送真实 Telegram 消息;令牌、密钥、密码哈希、Cookie 不进 Git、日志、聊天或记录(测试里的密钥只能是合成值)。
**本卡只补测试,不改任何生产代码。**

## 1. 三个存活变异

精确替换对象是 `main` 上的文件内容。

| # | 文件 | 精确替换(原 → 改) | 为什么存活 | 风险 |
|---|---|---|---|---|
| T3 | `lib/kyc/reveal-token.ts` | `function sameMac(a:string,b:string){` → `function sameMac(a:string,b:string){return true;` | 没有任何测试用**"结构完整、字段合法、但签名错误"**的令牌去验证会被拒绝。现有的拒绝用例都先死在别的检查上(解析失败、过期、范围不符) | **高**:这是敏感资料揭示的核心防线。我读源码,`sameMac` 实现是正确的(未执行验证),但没有测试保护 |
| T4 | `lib/kyc/reveal-token.ts` | `\|\|value.expiresAt-value.issuedAt>300000` → 删除这一段 | 令牌由服务端按固定 5 分钟生成,现有测试没有构造"签名有效但有效期更长"的令牌 | 低:攻击者没有密钥就无法签名,这是防御性检查 |
| A1 | `lib/kyc/sensitive-amend.ts` | 删除整行 `if(typeof value!=='string'\|\|mark?.dirty!==true\|\|mark.masked!==false)throw new KycError('请重新显示敏感字段后再修改',403);` | 现有测试里"没有标记/没有令牌"的情形会在后面的 `verifyRevealToken` 处同样抛 403,所以删掉这一行仍然全绿。需要**令牌有效但标记不对**才能区分 | 低:令牌校验仍会拦截;但这一行表达的是"必须是已揭示且已修改的字段"这条规则 |

## 2. 先读
`lib/kyc/reveal-token.ts`、`lib/kyc/sensitive-amend.ts`、`lib/kyc/reveal.ts`、`tests/kyc-reveal.test.mjs`、`tests/kyc-amend-sensitive.test.mjs`(尤其"sensitive edits require valid revealed proof bound to actor/tenant/case/revision/field and expiry"这条用例及其中的 `tokenApi`、`scope`、`meta(token)` 夹具)、`tests/helpers/kyc-sensitive-fixture.mjs`。`lib/h5-auth-core.ts` 的 `keyed` 只读(测试里用它按相同域名前缀计算 MAC)。

## 3. 允许 / 禁止
- **允许**:`tests/kyc-amend-sensitive.test.mjs`、`tests/kyc-reveal.test.mjs`、`tests/helpers/kyc-sensitive-fixture.mjs`(新增用例或小幅扩展夹具,但不得改变现有用例的断言)。
- **禁止**:`lib/**`、`app/**`、`components/**` 的任何生产代码、服务端、`package.json`/lock、CI 工作流。
- **如果某条测试暴露了真实缺陷**(测试写对了却失败):**不要在本 PR 里修**,保留该用例并在 PR 描述里单独列出现象、复现输入与失败断言,等技术负责人决定。

## 4. 测试要求(必须能区分有无缺陷)

令牌格式(来自源码):`<body>.<mac>`,`body` 是对 JSON 的 URL 安全 base64,JSON 为 `{tenant,actor,caseId,revision,field,issuedAt,expiresAt}`;`mac` 是 64 位十六进制,由 `keyed(PAYEASE_AUTH_SECRET, 'kyc-reveal-amend-v1:'+body)` 产生。测试里的密钥使用夹具里的合成值。

### T3 伪造签名的令牌必须被拒绝
用 `tokenApi.verifyRevealToken(token, scope)` 或经 `amend` 路径,对下列令牌断言**抛出 403 且错误文案为"请重新显示敏感字段后再修改"**(用夹具里能区分状态码的方式,不要只断言抛错):
1. **正确的 `body`,签名换成 64 个 `0`**(结构合法的十六进制)。
2. **正确的 `body`,签名取自另一个合法令牌的 `mac`**(换了 `body` 的 `field` 或 `revision` 后沿用旧签名)。
3. **正确的 `body`,签名长度为 63 位或 65 位**。
4. **正确的 `body`,签名大小写被改成大写**(应被拒绝;这是输入加固用例,与 T3 的变异区分无关)。
5. **正确的 `body`,`mac` 为空**。
再加一条正向对照:同一 `scope` 下由 `mintRevealToken` 生成的令牌**能**通过,证明上面的拒绝来自签名而不是别的原因。
这些令牌的 `body` 必须保持**未过期、范围匹配**,否则会死在别的检查上,测不到 MAC。

### T4 有效期上限
在测试里用与服务端相同的方式计算 MAC,构造**签名有效**的令牌,`body` 里:
- `expiresAt-issuedAt = 300000`:通过(与服务端一致的边界)。
- `expiresAt-issuedAt = 300001`:被拒绝(403)。
- `expiresAt<=issuedAt`:被拒绝。
- `issuedAt` 在未来:被拒绝。
- `issuedAt` 与 `expiresAt` 为非安全整数(例如 `1.5` 或字符串):被拒绝。
说明:正常服务端不会生成这些令牌;本条是为了让"有效期上限"这一条规则单独被测试保护。

### A1 代修改必须是"已揭示且已修改"的字段
夹具与现有"sensitive edits require valid revealed proof…"用例相同,令牌是**合法有效**的(`mintRevealToken` 生成,范围匹配),字段值是**与原值不同的新字符串**,仅标记不同:
- `meta = {masked:false, dirty:false, revealToken:token}` → 被拒绝(403),存储的原值不变。
- `meta = {masked:false, revealToken:token}`(缺少 `dirty`)→ 被拒绝(403)。
- `meta = {dirty:true, revealToken:token}`(缺少 `masked`,即 `masked!==false`)→ 被拒绝(403)。
- 令牌合法、`meta` 正确,但字段值是**非字符串**(数字 `123`、对象 `{x:1}`)→ 被拒绝(403)。
- 正向对照:`meta = {masked:false, dirty:true, revealToken:token}` 且新值为字符串 → 通过,存储的值被更新。
每条拒绝用例都断言:没有写入 `kyc_history`、存储的原敏感值未变化(夹具里已有计数方式可复用)。

## 5. 变异要求(PR 描述附结果表)

把 §1 的精确替换逐个应用,运行 `node --experimental-vm-modules --test tests/kyc-reveal.test.mjs tests/kyc-staff-redaction.test.mjs tests/kyc-amend-sensitive.test.mjs`:
- **T3、T4、A1 每一个都必须至少有一个测试失败**;还原后全部通过。
- **额外变异(原样报告)**:
  - T3b:把 `sameMac` 末尾的 `return difference===0;` 改成 `return true;`(保留 `^[a-f0-9]{64}$` 格式检查,只跳过逐字符比较)。应被 T3 的第 1、2 条杀死(签名格式合法但内容错误)。
  - T3c(预期**等价**,请报告而不是强行杀死):把 `/^[a-f0-9]{64}$/` 放宽成 `/^[a-fA-F0-9]{64}$/`。大写签名即使通过格式检查,也会在逐字符比较处因字符码不同而被拒绝,所以这个变异预期存活,属于等价变异;T3 的第 4 条是输入加固用例,不用来区分它。
  - A1b:把 `mark.masked!==false` 改成 `false`,应被"缺少 `masked`"一条杀死。
- 每个变异写明:应用的替换、失败的测试名。若某个变异仍存活,必须说明并证明等价。
- 变异后务必还原,`git diff` 里不得出现 `lib/`、`app/`、`components/` 下的改动。

## 6. 验收
1. 评审基线:main `b277771` 上 `s1a-origin`、`s1b-origin`、`kyc-reveal`、`kyc-staff-redaction`、`kyc-amend-sensitive` 共 44 项通过(其中后三个文件 15 项);`team-integration` 加 `http-contract` 共 70 项通过。本卡完成后这些全部保持通过,新增用例另算;不降低、不删除原有用例。
2. 变更文件只限 §3 的文件;`git diff --stat` 附在 PR 描述里。
3. 没有服务端、依赖、CI、迁移、认证相关改动,没有生产代码改动。
4. 测试里不得出现真实密钥、令牌或个人信息;所有值是合成的。说明未覆盖的部分(例如没有真实浏览器验证)。不要把"未验证"写成"已验证"。

## 7. 不在本卡范围(另议)
- 揭示接口没有速率限制;同一操作人 30 秒内对同一字段的重复揭示只写一条审计(进程内缓存),审计行数不等于揭示次数。是否要限流或逐次审计由技术负责人决定。
- 非团队审核员(仅 `isTestMode()` 下存在)在 `decide`/`amend` 之后的返回值被按 `audit` 角色脱敏,资料显示为空。生产不受影响。
- 同源校验的灰度风险:`PAYEASE_ALLOWED_ORIGINS` 没设置时,允许列表只含请求自身来源和生产域名;L1-G 契约 G6 与 `master-plan-20261015.md` §12.3a 第 2 条对灰度是否需要配置说法不一致,需要在灰度 O1–O6 只读检查里核实。
- 两个等价变异 R1(揭示接口内重复的来源校验)和 P4(审计角色可见文件)不要求处理。

## 8. 交付
- 新分支基于**最新** `origin/main`,开 **Draft PR**,不标 Ready,不合并,不关闭任何 PR。
- PR 描述写明:新增用例、变异结果表、`git diff --stat`、未覆盖项;不放令牌或任何敏感值。
- 分支名交技术负责人转 Claude 做独立评审。
