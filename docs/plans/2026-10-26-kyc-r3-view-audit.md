# R3 Material View Audit Implementation Plan（仅计划，待 Claude 复核）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after explicit plan approval. 本 PR 只交计划，不执行下列步骤；计划通过不等于部署、迁移或其他冻结切片授权。

**Goal:** 员工读取 KYC 材料必须先有元数据审计，再返回任何文件内容；保留客户自己的读路径与现有材料归属边界。
**Architecture:** 在现有 `/api/kyc/files?review=1` GET 增加统一服务端审计闸门，不另开可绕过的字节接口。UI 只声明读取意图；岗位、归属、分配、案件/版本/slot 均在服务端重新核实。复用 `team_audit` 及主键做跨实例固定时间桶去重，不建表、不迁移。
**Tech Stack:** TypeScript、现有 D1 / team_audit、私有 bucket、React 材料查看器、node:test 真实 SQLite fixture、Chromium 合成材料。
**Spec:** bridge task `20261026-1410-04-k9-polish-and-r3-plan.md` PR-b；`docs/kyc-ux-review-20261023.md` R3；本计划基于 main `b3b1ad1`，不把未合并 #113/#114 当现状。

## Global Constraints / 权限闸门

- 本 PR 仅修改本计划文件。未实现、未部署、未迁移、未改鉴权/接口/资金/服务器/DNS/Cloudflare、未删除或改写历史数据。
- 实现属于审计/敏感材料/鉴权高风险：先等 Claude 明确复核本计划，再接受具体开发任务。合并另需明确批准及当前门禁；部署仍须负责人本人批准。
- 若实现涉及 #63 尚未解冻的文件接口切片，先由负责人本人明确解冻，不能从本计划或 R3 UI 已合并推导后端范围已解冻。
- 优先复用现有 schema。任何新增索引/列/表或执行数据库迁移均另标“需技术负责人本人批准”，不得夹带在实现或部署中。
- 不改变贷款合同/签名文件访问规则；不把 KYC signature slot 重新引入查看器；不调整上传/扫描/配额、加密、资金规则。

## 现状证据与必须明确的边界

1. `app/api/kyc/files/route.ts` GET：review=1 调 `reviewer()`，`fileRow(owner,id)` 校验 owner+ready，再以存储行 customer_id 调 `guardKyc`（tenant owner）；之后 bucket.get/decrypt 并返回文件。目前没有材料读取审计。
2. `lib/kyc/server.ts`：`reviewer()` 接受 admin/kyc/dept_admin/**audit**；`lib/team/policy.ts` 的 `canSee(...,'kyc')` 对 audit 也返回 true。因此现有代码**不能声称 audit 直接读文件已被服务端拒绝**。未用生产文件或真实数据验证，结论限源码控制流。
3. `staffView(...,'audit')` 清空 values/files，R5 changes 对 audit 只返回字段名/slot；这是 UI/投影边界，不代替文件接口拒绝。提议实现时在 reviewer 文件分支显式拒绝 audit（403、不取bucket、不解密），这是待审的权限收紧，当前不实施；不改变审计员读取字段名/审计记录的权限。
4. 旧材料访问现状允许同 owner/customer 的 ready 存储行，不要求仍在当前 profile.files。R5 老/新材料对比依赖它。本批不悄悄改成“只许当前文件”；slot 从存储行取、case 从同 owner/customer 查询。若要进一步限制为特定历史快照引用，另做安全计划，不在此顺带改权限。
5. PDF 当前响应 `Content-Disposition: attachment`；不能把 `<object>` 存在写成已保证所有浏览器内联预览。本批不改 disposition。记录的是获准读取的**请求意图**，不是证明人眼已看见或下载已完成。

## 事件定义、去重与失败策略

| 触发 | 是否记录 / detail.action | 说明 |
|---|---|---|
| 缩略图实际请求文件字节 | 是 / `thumbnail` | 敏感图即使只作为缩略图也发生读取；组件mount但未加载不记 |
| 首次打开大图、并排查看新材料或请求PDF查看 | 是 / `preview` | 使用带新意图的受保护URL重新取文件；不能只发前端click审计再复用未审计URL |
| 显式下载链接GET | 是 / `download` | 包括浏览器可能打开而非保存的情况；只证明授权读取尝试 |
| 老URL、直接review GET缺少意图 | 是 / `read` | 兼容老链接但没有免审计路径；不得提供 `audit=0` 或用 Referer 猜角色 |
| 已加载图的缩放/旋转/切换CSS比例 | 不新增 | 没有新文件读取，不把每次手势记成看了新文件 |
| 客户本人非review读取 | 本批不新增员工审计 | 保持 context + owner/customer 绑定，不允许用客户路径读取他人文件 |
| HEAD / Range / 错误请求 | HEAD不返回内容；Range若读取内容必须同闸门 | 不因Range、缓存条件或method变成未审计读取；不在本批新增Range实现 |

- 去重：固定 **30秒时间桶**，键含 tenant、真实actor、caseId、当前视图revision、slot、fileId、action、floor(serverNow/30000)。不是滑动窗口；29.9秒和30.1秒可能各记一条，明确接受。不同岗位用户、版本、材料、意图不能相互去重。
- 用服务端规范化上述键的 SHA-256 生成确定性 `team_audit.id`（TEXT主键）；现有表不需新列/唯一索引。采用只针对主键冲突的 `INSERT ... ON CONFLICT(id) DO NOTHING`，其他SQL/FK错误必须抛出，不能广义吞错。每次等数据库完成；并发请求共享已提交行，插入失败不得标为已审计。全局去重依赖共享D1主键，不依赖进程Map。
- 每个请求**先重新鉴权/分配/归属**再查或写去重事件；去重不能缓存授权。无team（含本地allowlist reviewer）在review审计路径403，不能写假tenant或绕过审计；客户本人路径不受此team要求影响。
- 事件名提议 `kyc_material_read`，外层 `tenant_id`、`actor`、`created_at` 用现有列。detail严格且仅含 `{caseId, revision, slot, fileId, action, requestId}`；无图片、文件字节/名称/URL、客户姓名/手机号、明文字段、Cookie、token、密钥、完整环境变量、审核意见。
- requestId 使用现有 request-id helper：合法 UUIDv4 复用，否则服务端生成；不得放在可持久泄露的查询参数或审计secret字段。去重不含requestId；detail保存该桶首次成功写入请求id，后续请求各自响应X-Request-Id但不声称每次HTTP都有独立事件。
- **选择 fail closed**：审计落库/去重存在性无法确认 → 通用503、no-store、requestId，bucket.get与解密/Response字节构造均不得执行。不得返回文件、Base64、缩略图或带内容的降级响应；不能“放行并告警”。代价：审计数据库故障会阻断员工看材料，这是隐私/可追溯优先的明确取舍。日志仅请求id和固定错误类别，不打印SQL参数、文件内容或原始异常片段。
- 顺序：认证→岗位拒绝→fileRow→guardKyc→解析case/slot/revision→审计提交→bucket.get/decrypt→响应；对象404/解密失败时可能已有事件，事件定义为“授权读取尝试”，绝不伪称送达成功。先审计后字节不能做成后置异步日志。
- 保留 private/no-store、nosniff、sandbox、no-referrer 与既有安全Content-Type/Disposition；不得加入公共缓存、可复用明文URL或关闭bucket认证。网络中断前已写的审计不删除。

## 接口与上下文提议（待复核，不实现）

`GET /api/kyc/files?review=1&id=FILE&caseId=CASE&revision=N&view=thumbnail|preview|download`：新增参数仅提供核对与意图，不能授予访问权。缺省view为read，未知view400；重复关键参数/无效revision400，避免客户端解释与服务端审计歧义。

- `owner`/actor永不取查询参数。保留 fileRow ready/owner 与 guardKyc(file.customer_id)；显式audit拒绝位于取对象之前。admin/kyc/dept_admin仍按既有scope读取，不提高岗位或分配权限。
- 客户路径也不接受把review上下文当作客户授权；reviewer与客户上下文不能失败后互相fallback。`review`非1的输入行为在实现前用兼容测试钉住，不额外制造路径绕过。
- 服务端由fileRow.customer_id调用 `findCase(owner, customer_id)`；只接受此case，不以任意client caseId归因。caseId提供但不匹配则404；无case则404且不返回文件。revision提供但不等当前case.revision则409；无revision的老链接使用当前视图revision。metadata解密的文件名不进审计。
- revision记录**当前审核视图**，不声称是旧文件上传版本。R5旧图仍可取同customer的ready文件，fileRow.slot为可信slot；不把显示基线revision误传成当前视图revision。若未来一个customer存在多case歧义，拒绝并另行设计，不随意取一案。
- 查看器、R5 old/new thumbnail与下载链接统一构建意图URL；action仅为审计意图，不是假设用户一定点了按钮。客户端伪造action不能绕过审计，也不能改变可返回的字节范围。
- 通用错误三语，失败缩略图不伪装“未上传”，允许显式重试。禁止自动无限重试审计故障导致写放大；PDF viewer自发多GET由时间桶去重。

## Review Focus

- audit或跨tenant/未分配员工持有真fileId时必须无字节、无bucket/decrypt调用；投影遮罩不足以证明拒绝。
- 旧材料仍可比对，但不能用别人的case/revision伪造归因；权限撤销在30秒桶内立即生效。
- 缩略图批量请求、PDF重复读取、并排/下载不同意图并发时审计去重正确，任何写失败均无内容返回。
- 无team测试allowlist、客户本人读、直接旧URL、HEAD/Range/重复参数都不能形成审计旁路。
- 字节请求成功仅能证明已审计读取尝试；对象缺失、解密失败、网络取消不得伪称用户已看/已下载。

## 分步实现任务（全部待 Claude 复核批准后执行）

### Task 1: 服务端审计闸门与可验证上下文
Files：Create `lib/kyc/material-read-audit.ts`、`tests/kyc-material-read-audit.test.mjs`；Modify `app/api/kyc/files/route.ts`（仅GET）、必要的file/case只读helper；复用现有fixture，POST上传不改。
Interfaces：`authorizeMaterialRead(request:Request): Promise<{file:FileRow, caseId:string, revision:number, slot:Slot, actorId:string, tenantId:string, action:MaterialReadAction, requestId:string}>`；`auditMaterialRead(context, nowMs): Promise<void>`。FileRow若尚无导出类型，只提取现有返回行类型，不改schema。第一接口完成鉴权/归属，第二接口只等数据库写入；两者均不得取明文字节。
- [ ] 写RED：真实HTTP+SQLite fixture测试audit/跨tenant/其他reviewer/停用岗位/no-team拒绝；首个允许读取恰写六个detail键，审计失败503且响应不含合成字节、bucket/decrypt spy为0；旧/新同customer文件兼容、伪case404、stale revision409、slot取存储行。
- [ ] 跑 `node --experimental-vm-modules --test tests/kyc-material-read-audit.test.mjs`，先观察预期断言失败，再最小实现上述闸门与有边界错误处理。目标：全部通过，客户自读原行为无回归。
- [ ] 加并发/重放测试：同桶20请求1条、跨进程共享SQLite主键1条；跨桶/actor/revision/file/action分别新行；主键冲突之外异常不吞；写失败后重试重新审计；30秒内撤销分配依旧403。HEAD无体、Range不旁路、直接旧URL走read、坏/重复参数400、requestId不合法时重生。
- [ ] 验证无法伪造静态内容泄露：审计500/503/DB断连、对象404、解密失败、客户端取消、JSON detail无原文件名/明文/secret。运行全量npm test、types、lint、build leaks0，再提交服务端PR（不部署）。

### Task 2: 查看器/差异图意图接入与性能证据
Files：Create `lib/kyc/material-read-url.ts`、`tests/kyc-material-read-ui.test.mjs`；Modify `components/kyc-material-viewer.tsx`、`components/kyc-review-changes.tsx`、`components/kyc-review.tsx`，必要三语错误copy。按每PR约400行拆分；依赖Task1实际合并/已审实现，不私自合并功能分支。
Interfaces：`materialReadUrl({fileId,caseId,revision,view}):string`，只编码不缓存token/身份；父组件传当前case/revision；旧图同样传当前视图上下文。未传敏感内容到埋点。
- [ ] 写RED真实组件/HTTP测试：缩略图→大图→下载发不同view且相同可信case上下文；audit无文件URL、图片、PDF或下载链接；仅缩放旋转不触发新内容请求；失败保留通用提示/显式重试，不退回免审计URL。
- [ ] 实现最小URL/加载状态接入，以上测试GREEN；真实浏览器375/1440中文/Khmer合成图、PDF、旧新材料对比；逐个核对HTTP状态、审计行及无敏感日志。记录PDF的实际attachment行为，不伪称浏览器都内联。
- [ ] 批量性能：记录同案1/10/20个图片请求的审计INSERT/读取数、响应p50/p95、总字节、内存；并发读取不超过现有浏览器/加载调度能力，不预先写“性能通过”。同桶重复重载仍需鉴权+主键冲突写，不扫描JSON历史全表；无新索引。
- [ ] 比较无审计基线与启用闸门：预期每首次内容读取增加一次串行D1提交及case查询；缩略图实际仍取原图，不把它称为新缩略图服务。若20张加载使p95相对基线增加>200ms或>25%（任一），先报告实测及取舍，交Claude决定调度优化，不通过放行未审计内容提速。阈值为拟定验收目标，非已测结果。
- [ ] 全量tests/types/build leaks0/lint0errors；警告不增，精确head GitHub CI通过（账单未恢复则阻塞，不绕过）；Claude代码复核/明确批准后才merge commit。部署另等负责人本人许可。

## 迁移、发布与验收结论

本提议复用 team_audit TEXT主键及现有六列，无需迁移；跨实例固定桶去重不是严格滑动窗口/送达证明。若后续要求独立幂等表、索引或更严格事件完成状态，必须重新审计划，数据库迁移需技术负责人本人批准。无配置开关可让审计失败时放行。

当前交付只到计划：等待Claude复核记录时机、固定桶边界、fail-closed可用性取舍、audit直接读取收紧及旧材料归因兼容方案。未开始Task1/2，不以本计划当实现/安全修复/上线完成证据。
