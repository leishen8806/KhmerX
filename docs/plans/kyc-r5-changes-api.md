# KYC R5 Changes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after Claude plan review. Steps use checkbox tracking.

**Goal:** 返回最近一次人工审核决定到当前版本的受控差异，解除 K5b 的基线缺失问题。
**Architecture:** 新增 GET /api/kyc/review/changes?id=；复用 reviewer/getCase/guardKyc/payload，不扩展读取范围。只读取现有 kyc_history 快照，访问审计复用 team_audit；成功写审计后才响应，不建立表或迁移。
**Tech Stack:** Next TypeScript、现有 D1/SQLite、Node VM 真实 handler 集成测试。
**Spec:** claude-bridge/done/20261026-0915-02-r5-history-diff-api.md；负责人已在本对话批准 Scheme A 开发，合并仍需负责人批准。

## Global Constraints
- 基线 origin/main 416e99c；不依赖尚未合并的 S1/R10 PR，不 cherry-pick #63。
- 高风险接口/敏感数据：本文件先提交复核；未获计划复核前不新增运行接口。
- 不合并、不部署、不线上请求、不迁移、不新表。开发 PR 写“高风险：接口与敏感数据，需技术负责人批准合并”。
- 差异接口不返回 snapshot、存储地址、合同或完整 profile；旧材料继续走现有受控文件接口。

## 已核实的契约与待复核决定
- app/api/kyc/review/route.ts 的单案 GET：reviewer() → getCase(u.userId,id) → team 存在时 guardKyc(u.userId,row.customer_id) → staffView。guardKyc 默认 write=false；不得误用写权限而排除只读 audit。
- lib/kyc/server.ts transition 写入的是该 revision 的**新快照**；基线选择 action 精确属于 review:approved/review:needs_info/review:rejected 的最高 revision，不把 review:amend 当作人工审核决定。
- team_audit.tenant_id 外键引用 team_companies.id（drizzle/0003_sticky_blonde_phantom.sql:13）；reviewer() 在 KHMERX_TEST_MODE 下另允许无 team 的工作区用户。该 owner 未必是合法公司，不能假定 audit() 在该回退路径可写。
- **须复核的实际问题：**常规 team 路径使用 team_audit。无 team 的 legacy/test 工作区若不能写公司审计，应 fail closed，不返回差异；这会比旧 GET 的“可访问但只有 audit 摘要”更窄。请确认是否接受此限制，或指定既有合规审计落点；不创建假公司、不关闭外键、不把敏感 snapshot 写进审计。该问题未解决前不实现。

## Response
`{caseId,currentRevision,baselineRevision:number|null,fields,materials}`。
- KYC/admin/dept_admin：fields 为 `{id,oldValue,newValue}`；documentNumber、bankAccount 两端都为掩码加最多末4位。其他字段按现有资料读取权限返回。
- materials 为 `{slot,oldFileId:string|null,newFileId:string|null}`，只比较 id，不返回 URL/metadata；新增/删除用 null 表示。
- audit（含旧 GET 默认的无 team 摘要权限）：fields 只有 `{id}`，materials 只有 `{slot}`，无值、无文件编号。
- 无历史人工决定：baselineRevision=null，fields=[]，materials=[]；不得拿 updatedAt、首个历史条目或当前 profile 冒充基线。
- 已授权案件的损坏/不可解密快照：失败，不返回部分差异或原始密文。

## Review Focus
1. 无 team 审计外键问题：须确认上面的 fail-closed 策略。
2. actor 使用 reviewer().actorId，而非把 tenant id 当操作人；requestId 与失败响应关联。
3. 数字短值、空值和一侧缺失都不能绕过 documentNumber/bankAccount 的 API 层掩码。
4. 审计角色不通过材料 id、字段值或错误日志获得旁路信息。
5. 同 revision 多历史条目稳定选择；只选真实决定，不选代修改/保存/访问审计。

### Task 1: 纯差异计算（带类型和测试）
Files: Create lib/kyc/review-changes.ts; Test tests/kyc-review-changes.test.mjs。
Interface: `reviewChanges(before:Profile|null,after:Profile,role:string):{fields:FieldChange[];materials:MaterialChange[]}`；调用方负责授权和解密。
- [ ] RED：普通字段新旧值、替换/新增/删除材料；短证件/账号、空值两侧；audit 无值/文件id；before=null 返回空数组。
- [ ] 运行 `node --test tests/kyc-review-changes.test.mjs`，确认断言因功能缺失失败。
- [ ] 最小实现：仅白名单 schema fields/slots（排除 signature），按值/id 比较，再按角色投影；不记录值。
- [ ] GREEN 后提交；不添加 profile 全量返回或存储路径。

### Task 2: 路由、基线与访问审计
Files: Create app/api/kyc/review/changes/route.ts; Extend tests/kyc-review-changes.test.mjs 的真实 SQLite/handler fixture。
Interface: GET with required id; successful payload follows Response above；失败用 failed(e,request)。
- [ ] RED：未授权403、未分配403、跨公司/未知案件不可读、audit仅字段名；最近人工决定优先于较新 amend/save；无历史空差异；恶意id不拼SQL；解密失败不泄漏。
- [ ] RED：审计写失败则不返回；成功审计 detail 仅 `{caseId,currentRevision,baselineRevision,requestId}`，外部 actor/tenant/created_at 用现有列，不含原值、末4位、文件id或 note。覆盖无 team 的已确认策略。
- [ ] 复用精确单案 GET 授权链；绑定参数查询 kyc_history，限定 owner/case_id 和三个决定 action；解密基线与当前快照，调用 Task1。
- [ ] 复用 audit(tenant,actor,'kyc_changes_view',detail).run()；写入成功后 json 输出，Cache-Control no-store；不增加审计快照，不写 kyc_history，不改变 revision。
- [ ] targeted GREEN、`TMPDIR=/private/tmp npm test`、typecheck、build:separated leaks0、lint0 errors；独立全分支复核，普通推送并等待 CI。
- [ ] 开高风险 Draft PR，不合并；outbox 记录证据与待负责人批准项。R5 未合并前不恢复 K5b。

## Self-review
全部六项需求已对应 Task1/2。未解决的唯一实施前决定是无 team 工作区的访问审计落点/失败策略；其余不需要新增表。没有以旧 GET 的浏览器值遮罩冒充本接口层脱敏。

## 2026-10-26 实施记录（复核通过后）
- Claude 在 1005-02 明确批准无 team 的测试回退 fail closed；该决定已落实，不创建虚假公司，不关闭外键。
- 已同步 main 33ac949。完成纯差异计算和真实 SQLite/handler 集成测试，先 RED 后 GREEN；未修改既有认证/分配逻辑。
- staffView 的 audit 投影会先清空 values/files，无法计算变更名称；本接口改为先授权、解密，最后按同一 role 边界仅输出字段名和 slot，不调用会加载贷款数据的 staffView。不存在 profile/贷款/合同返回。
- 基线固定三个决定 action，revision 不超过读取到的当前版本，同版本按 created_at、id 降序稳定选择。损坏基线或当前快照均失败；错误不包含密文或解析片段。
- GET 在返回前 await team_audit 写入；只记录 caseId/currentRevision/baselineRevision/requestId，actor 为真实 reviewer.actorId。
- 不恢复依赖 R5 合并的 K5b；高风险：接口与敏感数据，需技术负责人批准合并。无部署。
- 1100-00 复核修正掩码：空值为空，长度≤4 仅 `****`，5–8 位仅末2位，>8位仅末4位；证件/银行账号新旧两端及边界均回归。该更严格规则覆盖上文原“最多末4位”实现细节。
