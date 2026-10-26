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
- 冻结记录 `docs/tasks/approvals/2026-10-22-freeze-pr63-and-w1-off-20261023.md` §一.3 排除“业务权限收紧”。audit 文件读取拒绝拆为独立 **Task 0**，必须负责人本人批准/解冻后才可实现；Task 1a/1b 不得夹带该拒绝。当前仅修订本计划，待 Claude 再复核，未启动任何实现。
- 优先复用现有 schema。任何新增索引/列/表或执行数据库迁移均另标“需技术负责人本人批准”，不得夹带在实现或部署中。
- 不改变贷款合同/签名文件访问规则；不把 KYC signature slot 重新引入查看器；不调整上传/扫描/配额、加密、资金规则。

## 现状证据与必须明确的边界

1. `app/api/kyc/files/route.ts` GET：review=1 调 `reviewer()`，`fileRow(owner,id)` 校验 owner+ready，再以存储行 customer_id 调 `guardKyc`（tenant owner）；之后 bucket.get/decrypt 并返回文件。目前没有材料读取审计。
2. `lib/kyc/server.ts`：`reviewer()` 接受 admin/kyc/dept_admin/**audit**；`lib/team/policy.ts` 的 `canSee(...,'kyc')` 对 audit 也返回 true。因此现有代码**不能声称 audit 直接读文件已被服务端拒绝**。未用生产文件或真实数据验证，结论限源码控制流。
3. `staffView(...,'audit')` 清空 values/files，R5 changes 对 audit 只返回字段名/slot；这是 UI/投影边界，不代替文件接口拒绝。显式拒绝 audit（403、不取bucket、不解密）仅属于独立 Task 0，在负责人本人批准前不实施。Task 1a/1b 保留现有 audit 文件读取权限，但同样必须先审计、失败无字节；UI仍只显示字段名、不主动生成材料链接。actor与角色由现有team上下文得到，不在detail新增role键，也不伪造actor。
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
- 每个请求**先重新鉴权/分配/归属**再查或写去重事件；去重不能缓存授权。reviewer()无team allowlist仅在isTestMode可达，生产代码先403、无此路径。测试模式因team_audit.tenant_id NOT NULL/FK无法合规落审计，review读取fail closed 403，不能写假tenant；客户本人路径不受此team要求影响。测试必须分别钉住测试模式no-team拒绝与生产无fallback。
- 事件名提议 `kyc_material_read`，外层 `tenant_id`、`actor`、`created_at` 用现有列。detail严格且仅含 `{caseId, revision, slot, fileId, action, requestId}`；无图片、文件字节/名称/URL、客户姓名/手机号、明文字段、Cookie、token、密钥、完整环境变量、审核意见。
- requestId **只从合法请求头X-Request-Id或服务端生成**，查询参数永不作为来源；仅注入query requestId而无请求头时必须新生成。使用现有request-id helper，不把requestId放入新文件URL或审计secret字段。去重不含requestId；detail保存该桶首次成功写入请求id，后续请求各自响应X-Request-Id但不声称每次HTTP都有独立事件。
- **选择 fail closed**：审计落库/去重存在性无法确认 → 通用503、no-store、requestId，bucket.get与解密/Response字节构造均不得执行。不得返回文件、Base64、缩略图或带内容的降级响应；不能“放行并告警”。代价：审计数据库故障会阻断员工看材料，这是隐私/可追溯优先的明确取舍。日志仅请求id和固定错误类别，不打印SQL参数、文件内容或原始异常片段。
- 顺序：认证/现有岗位许可→fileRow→guardKyc→解析case/slot/revision→审计提交→bucket.get/decrypt→响应。Task 0若日后获本人批准，才在现有岗位许可后增加audit拒绝；在此之前audit与其他现有允许岗位同闸门。对象404/解密失败时可能已有事件，事件为“授权读取尝试”，不伪称送达；先审计后字节不能后置异步。
- 保留 private/no-store、nosniff、sandbox、no-referrer 与既有安全Content-Type/Disposition；不得加入公共缓存、可复用明文URL或关闭bucket认证。网络中断前已写的审计不删除。

## 接口与上下文提议（待复核，不实现）

`GET /api/kyc/files?review=1&id=FILE&caseId=CASE&revision=N&view=thumbnail|preview|download`：新增参数仅提供核对与意图，不能授予访问权。缺省view为read，未知view400；重复关键参数/无效revision400，避免客户端解释与服务端审计歧义。

- `owner`/actor永不取查询参数。保留 fileRow ready/owner 与 guardKyc(file.customer_id)；admin/kyc/dept_admin/**audit**仍按既有scope读取，不提高岗位或分配权限。Task 0未获批前不得在Task1或helper里暗加audit拒绝；其获批后拒绝位于取对象之前。
- 客户路径也不接受把review上下文当作客户授权；reviewer与客户上下文不能失败后互相fallback。`review`非1的输入行为在实现前用兼容测试钉住，不额外制造路径绕过。
- 服务端由fileRow.customer_id调用 `findCase(owner, customer_id)`；只接受此case，不以任意client caseId归因。caseId提供但不匹配则404；无case则404且不返回文件。revision提供但不等当前case.revision则409；无revision的老链接使用当前视图revision。metadata解密的文件名不进审计。
- revision记录**当前审核视图**，不声称是旧文件上传版本。R5旧图仍可取同customer的ready文件，fileRow.slot为可信slot；不把显示基线revision误传成当前视图revision。若未来一个customer存在多case歧义，拒绝并另行设计，不随意取一案。
- 查看器、R5 old/new thumbnail与下载链接统一构建意图URL；action仅为审计意图，不是假设用户一定点了按钮。客户端伪造action不能绕过审计，也不能改变可返回的字节范围。
- 通用错误三语，失败缩略图不伪装“未上传”，允许显式重试。禁止自动无限重试审计故障导致写放大；PDF viewer自发多GET由时间桶去重。
- **409专门处理**：显示中文“资料已更新，请刷新后查看”、English“Profile updated. Refresh to view.”、Khmer“ព័ត៌មានត្រូវបានធ្វើបច្ចុប្បន្នភាព។ សូមផ្ទុកទំព័រឡើងវិញដើម្បីមើល។”（实施时登记新增待母语复核）。不自动重试、不偷偷改revision、不退回免审计URL；用户明确刷新资料后才以新case/revision重建读取。
- 原生img/object的onerror不能区分409。Task2须用能检查HTTP状态的受保护GET加载层，先分类status再消费内容；图像可用可撤销objectURL，切案/卸载清理，测试迟到响应不能覆盖新案。PDF/download必须保留既有attachment/下载回退语义，不借Blob强行绕成内联预览；内存与额外请求计入性能测量。不得仅显示一个无法识别409的图片裂图。

## 审计清单、列表与导出副作用评估（只评估，不改实现）

- `drizzle/0029_audit_manifests.sql` 建追加式manifest表；`lib/team/audit-integrity.ts` snapshot读取当前tenant全部team_audit，按created_at,id排序，规范化[id,actor,action,detail,created_at]后生成v2:HMAC摘要。createManifest先写audit_manifest_created再全量快照，保存digest/row_count/首尾时间/末id；verify还做边界前缀与全量快照/COUNT。它是清单哈希，不是原始审计CSV导出，代码未过滤材料读取action。
- 新kyc_material_read会进入清单，体积随tenant历史N线性增长；当前一次性all()、map/join/HMAC与verify重复快照的耗时、峰值内存都需实测，不能把30秒去重视为无增长。1/10/20文件并发只是在线请求指标；另测混合审计1千/1万/10万行的create/verify耗时、内存、canonical字节数、row_count，并验证已有manifest追加后仍可核对，不伪报篡改。
- created_at用真正写入时刻，**不能用30秒桶起点回填/回溯**，时间桶只参与确定性id。高并发同毫秒与跨manifest快照插入的排序风险要有测试和报告；若现有manifest算法不足，立即交Claude另报，不在Task1改哈希算法、游标、manifest格式、排序或校验逻辑。
- `lib/team/server.ts` teamData给admin/audit取最新100条trail，无action过滤；`app/team/client.tsx`原样列表，读取事件会挤掉审核/权限动作。建议后续独立、服务端action过滤/分页的展示计划，默认业务审计视图不被读取事件淹没，并保留可切换材料读取事件；不能仅前端过滤这100条，不能删除事件或从manifest哈希排除它们。当前只记录影响，不修改列表/权限。
- `lib/team/reports.ts`及`/api/team/reports/export`只导出四类业务报表并另记report_export，不是team_audit导出；`components/audit-integrity.tsx`显示manifest摘要和create/verify操作，也无原始审计导出。若后续需要审计CSV，须单独明确action筛选与保留全部事件的权限/分页方案，本批不新增或改已有业务导出。
- 若上述量级不能维持现有完整性检查或业务审计可用性，提交实测与独立优化计划后再决定放量；不得跳过读取审计、删历史、篡改旧manifest或自行建索引。任何迁移仍需负责人本人批准。

## Review Focus

- 跨tenant/未分配员工持有真fileId时必须无字节；Task0未获批前audit现有scope读取必须审计后才有字节，不能误测为已拒绝；Task0独立验收才要求audit无bucket/decrypt。
- 旧材料仍可比对，但不能用别人的case/revision伪造归因；权限撤销在30秒桶内立即生效。
- 缩略图批量请求、PDF重复读取、并排/下载不同意图并发时审计去重正确，任何写失败均无内容返回。
- 无team测试allowlist、客户本人读、直接旧URL、HEAD/Range/重复参数都不能形成审计旁路。
- 字节请求成功仅能证明已审计读取尝试；对象缺失、解密失败、网络取消不得伪称用户已看/已下载。

## 分步实现任务（全部待 Claude 复核批准后执行）

### Task 0: audit岗位文件读取拒绝（独立PR，仅负责人本人批准后）
Files：独立修改 `app/api/kyc/files/route.ts` 的review分支与 `tests/kyc-material-read-role.test.mjs`；不改客户读、其他岗位scope或全局canSee。
Interfaces：在现有reviewer岗位结果上增加audit拒绝，后续读取/审计闸门不可绕过；不依赖Task1实现顺序，也不将其混入Task1a/1b。
- [ ] 先确认负责人本人在本对话明确授权/解冻本项；未有则保持HOLD，Claude文件不能代替。写RED：audit持有有效同tenant文件也403且bucket/get/decrypt为0，admin/kyc/dept_admin原分配行为不变、客户本人不受影响。
- [ ] 最小实现→GREEN→全量门禁、当前head CI→独立评审/明确合并批准；禁止借本计划批准部署。未执行。

### Task 1a: 元数据写入helper与单测（独立PR，≤约400行）
Files：Create `lib/kyc/material-read-audit.ts`、`tests/kyc-material-read-audit.test.mjs`；不接route、不改岗位许可、不动manifest。依赖修订计划再次获Claude复核。
Interfaces：`auditMaterialRead(context:{tenantId:string;actorId:string;caseId:string;revision:number;slot:Slot;fileId:string;action:MaterialReadAction;requestId:string}, nowMs:number): Promise<void>`；`MaterialReadAction='thumbnail'|'preview'|'download'|'read'`。role可在上层可信team上下文判断，但detail仍严格六键，不新增role。
- [ ] RED：真实SQLite中首个context插入六键detail、同桶20请求一行、两个module实例共享主键仍一行；跨桶/actor/revision/file/action分别新行；只吞id冲突，FK/DB异常失败且无成功缓存；写失败后重试重新写。created_at不取桶起点。
- [ ] 跑 `node --experimental-vm-modules --test tests/kyc-material-read-audit.test.mjs` 观察预期FAIL→最小helper实现→GREEN；不实现audit岗位拒绝或其它权限变更。
- [ ] 加manifest副作用的只读/本地合成数据评估用例，确认新增事件进入摘要、后续追加不改旧行，不改清单算法；记录量级指标。全量tests/types/lint/build leaks0后开Draft PR等待评审/批准，预算若超400先再拆，不挤入route。

### Task 1b: 文件GET接入与HTTP集成（独立PR，≤约400行）
Files：Modify `app/api/kyc/files/route.ts`（仅GET），Create `tests/kyc-material-read-http.test.mjs`，必要只读context helper放 `lib/kyc/material-read-context.ts`；复用Task1a已审helper，POST上传不改。
Interfaces：`authorizeMaterialRead(request:Request): Promise<{file:FileRow;caseId:string;revision:number;slot:Slot;actorId:string;tenantId:string;action:MaterialReadAction;requestId:string}>`，只重核现有岗位/owner/分配与可信归因；调用1a成功后才bucket.get/decrypt。FileRow只提取现有行类型，不改schema。
- [ ] RED真实HTTP+SQLite：未获Task0授权的audit读取成功也恰写同一审计闸门，审计失败同样503/无字节；跨tenant/其他reviewer/停用岗位拒绝；测试模式no-team 403，生产no-team在reviewer内就拒绝且无allowlist fallback；客户自读不变。
- [ ] RED：首个允许读取六键detail；审计失败503且响应无合成文件字节，bucket/get/decrypt spy为0；旧/新同customer兼容、伪case404、stale revision409、slot取存储行；30秒桶内撤销分配仍403。
- [ ] RED：HEAD无体/Range不旁路、旧URL走read、坏/重复参数400；合法requestId仅请求头复用，坏头重生，仅query注入必须忽略并生成，去重命中响应id可与首条detail id不同；对象404/解密失败/取消不宣称送达、不泄露名称或原文。
- [ ] 跑 `node --experimental-vm-modules --test tests/kyc-material-read-http.test.mjs` FAIL→最小接入→GREEN；全量tests/types/lint/build leaks0及精确CI、独立PR评审。Task0仍未获批则不能将audit拒绝当作通过测试的方法。

### Task 2: 查看器/差异图意图接入与性能证据
Files：Create `lib/kyc/material-read-url.ts`、`lib/kyc/material-read-client.ts`、`tests/kyc-material-read-ui.test.mjs`；Modify `components/kyc-material-viewer.tsx`、`components/kyc-review-changes.tsx`、`components/kyc-review.tsx`，必要三语错误copy。每PR约400行；依赖Task1a/1b实际合并/已审实现，不私自合并功能分支。
Interfaces：`materialReadUrl({fileId,caseId,revision,view}):string`，只编码不缓存token/身份；父组件传当前case/revision；旧图同样传当前视图上下文。未传敏感内容到埋点。
- [ ] 写RED真实组件/HTTP测试：缩略图→大图→下载发不同view且相同可信case上下文；audit的UI投影仍无文件URL/图片/PDF/下载链接（不把它当服务端已拒绝）；仅缩放旋转不触发新内容请求；失败通用提示/显式重试，不退回免审计URL。
- [ ] RED专测每种意图409：zh/en/km均显示本节准确“资料已更新，请刷新后查看”文案；保持旧revision直到用户刷新，不自动重试；统计后续网络调用为0且无免审计URL。受保护GET加载层迟到200不能替换新案、卸载释放objectURL，PDF不改变attachment语义；requestId只在头、不在URL。
- [ ] 实现最小URL/加载状态接入，以上测试GREEN；真实浏览器375/1440中文/Khmer合成图、PDF、旧新材料对比；逐个核对HTTP状态、审计行及无敏感日志。记录PDF的实际attachment行为，不伪称浏览器都内联。
- [ ] 批量性能：记录同案1/10/20个图片请求的审计INSERT/读取数、响应p50/p95、总字节、内存；并发读取不超过现有浏览器/加载调度能力，不预先写“性能通过”。同桶重复重载仍需鉴权+主键冲突写，不扫描JSON历史全表；无新索引。
- [ ] 比较无审计基线与启用闸门：预期每首次内容读取增加一次串行D1提交及case查询；缩略图实际仍取原图，不把它称为新缩略图服务。若20张加载使p95相对基线增加>200ms或>25%（任一），先报告实测及取舍，交Claude决定调度优化，不通过放行未审计内容提速。阈值为拟定验收目标，非已测结果。
- [ ] 全量tests/types/build leaks0/lint0errors；警告不增，精确head GitHub CI通过（账单未恢复则阻塞，不绕过）；Claude代码复核/明确批准后才merge commit。部署另等负责人本人许可。

## 迁移、发布与验收结论

本提议复用 team_audit TEXT主键及现有六列，无需迁移；跨实例固定桶去重不是严格滑动窗口/送达证明。若后续要求独立幂等表、索引或更严格事件完成状态，必须重新审计划，数据库迁移需技术负责人本人批准。无配置开关可让审计失败时放行。

当前交付只到修订计划：等待Claude再次复核Task1a/1b、清单/列表量级影响、409加载分类和旧材料归因兼容。Task0另须负责人本人批准/解冻；在此前保留audit现有文件读取权限并同样审计，不能夹带拒绝。未开始Task0/1a/1b/2，不以本计划当实现/安全修复/上线完成证据。
