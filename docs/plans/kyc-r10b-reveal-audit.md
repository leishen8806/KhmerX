# KYC R10b Reveal Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task after high-risk plan review. Track steps with checkboxes.

**Goal:** documentNumber/bankAccount 在员工端默认只有接口层脱敏值；只有 reveal 的访问审计成功后才下发明文。浏览器开发者工具、详情 GET、代修改响应均不能提前取得这两个字段的完整值。
**Architecture:** 统一 staff KYC 投影（不改变客户 /api/kyc），POST /api/kyc/review/reveal 复用既有读取权限及 team_audit；代修改合并敏感字段时必须有服务器验证的 reveal 凭证，不能用遮罩覆盖原值。无迁移。
**Tech Stack:** Next TypeScript、现有 route/readJsonBody、D1/SQLite、React、Node VM 实际 handler/UI 测试。
**Spec:** claude-bridge/done/20261024-1346-02-kyc-r10-reveal-audit.md、20261024-1510-05-kyc-r10b-resume.md、20261026-0915-03-r10b-unblocked.md、20261026-1005-03-r10b-plan-revise.md；设计及负责人开发授权已确认，不含合并/部署。

## Global Constraints
- 工作分支 feat/server/kyc-r10-reveal-audit 已同步 origin/main 33ac949；#88 已合并，旧依赖阻塞不再成立，不依赖 #87 未合并分支。
- README 规定审计/鉴权高风险实施计划需 Claude 复核；旧任务已确认设计，本逐步计划提交复核后再新增运行代码。
- 白名单精确为 documentNumber、bankAccount；不借接口扩大值读取权限，audit 403。
- 复用 team_audit/audit()；若任何路径确需表/字段/迁移，停止，不创建假租户或关闭外键。
- 本轮仅修订实施计划，等待 Claude 再复核，尚未新增运行代码。必须修改 staff GET 和 amend 契约；不得保留“GET 完整值 + 只审计按钮”的旧设计。
- 产品 PR 约400行，超出拆服务端a/前端b；写“高风险：审计，需技术负责人批准合并”。不合并、不部署、不线上显示/审计请求。

## 已核实基础与权限细节
- GET /api/kyc/review?id= 使用 reviewer → getCase(u.userId,id) → team 存在时 guardKyc(owner,customer,write=false) → staffView(row,role)。本接口采用同一链，不要求审核写权限。
- staffView 对 role=audit 清空 values/files；无 team 的测试工作区 GET 默认 role=audit。故 reveal 以同样的有效角色计算，audit（包括该默认摘要路径）返回403，不能从 masked/empty GET 推导可读取明文。
- team_audit.tenant_id 外键引用 team_companies；正常 team 路径已有合法租户，可复用 audit(tenant,actor,action,detail).run()，无需迁移。无 team 默认摘要路径不写审计且不返回值，避免无合法租户旁路。
- 审计 actor 使用 reviewer.actorId，不用 owner/tenant 代替。existing audit() 存 actor/tenant/created_at，detail 仅 caseId、revision、field、requestId。

## Review Focus
1. 去重不能缓存权限、明文或失败；每次请求先重新授权/校验 revision，成功才记去重。
2. 同步重复点击与并发请求共享同一审计 promise；失败必须移除，重试必须重新尝试写。
3. 无 team 摘要权限和 audit 不能经接口获取值；跨租户 getCase 拒绝，未分配 guardKyc 拒绝。
4. 延迟成功响应不能重新显示已隐藏或已切换案件/版本的值。
5. UI 失败只显示通用三语提示，不暴露后端原始错误、完整值或末4位到日志/审计。
6. 所有 staff 读/写返回统一投影；客户自己的 /api/kyc 保持原值。amend 未 reveal 的字段（即使短值、空值、缺省、对象标记）不得被遮罩或假标记覆盖。
7. 客户端自报 revealed/dirty 不足以授权修改；凭证必须由成功审计后的服务器签发，并绑定 actor/tenant/case/revision/field。修改时仍重查全部写权限。

## 出口清单（2026-10-26，main 33ac949；非线上抓包）
| 出口 | 已核实当前状态 | 本批计划 |
| --- | --- | --- |
| GET /api/kyc/review?id= → staffView | 非 audit 的 profile.values 仍完整下发 documentNumber/bankAccount；audit 清空 values/files | 必须处理：统一 staff 投影，两个字段值为 `****` + 最多末4位（空值为空）；顶层 sensitiveFields 每字段 `{masked:true}`，不携带原值/哈希 |
| POST /api/kyc/review 的 amend 和决定返回 → decide → view | 两个分支均直接返回 view，包含完整 profile；不能只修 GET | 必须处理：只把员工返回改成 staffView 投影，内部 payload/transition 不脱敏存储 |
| 审核 history | GET 去掉 snapshot，只保留 review 元数据（reason/checklist/requests），没有结构化 profile.values | 保持不返回 snapshot；增加回归检测结构化敏感字段。用户自由填写的 reason 可能含个人资料，不声称已解决任意自由文本泄漏 |
| GET /api/kyc（客户本人） | 使用 customer context；客户自己的资料完整值 | 明确保留原契约，不套 staff 投影；回归身份隔离，员工 Cookie 不可冒充客户 |
| GET /api/kyc/review（无 id）、team workflow 的 kycOrders/customers、CRM 队列 CSV | 仅编号/脱敏手机号/状态/revision/时间等；队列 CSV 列 id/customerId/phoneMasked/status/revision，不导出这两个字段 | 当前不含目标字段，增加出口回归，不扩大导出列 |
| /api/team/reports/export → lib/team/reports.ts | 四种报表固定列，customer_summary 和 kyc_funnel 仅 KYC 状态/版本；loan_cashflow/collections 不含这两个字段 | 当前不含目标字段，保持白名单；测试导出不得出现 synthetic documentNumber/bankAccount |
| 员工 state/reportState → lib/team/workflow.filtered | KYC 只摘要，loan.kyc 替换为收入0/空联系人/固定说明，contract 清除 | 当前无目标字段结构化出口；回归不因本批改动扩大 |
| R5 GET /api/kyc/review/changes（PR #112，尚未合并） | 已在独立分支 API 层对 documentNumber/bankAccount 新旧两端掩码；audit 仅字段名/slot | 不复制或依赖未合并代码。R5 合并后补集成回归；未合并前记录“接口尚不可用”，不声称已上线 |
| teamData.trail / audit 查询中的既有 kyc_field_amend detail | 旧 before/after 对任意字段使用通用 mask，长度≤4 会原样存；现有历史审计不能自动改写 | 本批新 amend 事件对目标字段仅记录字段名，不存值/末4位。既有历史审计/自由文本残留为已知缺口，另需负责人决定数据治理；本批不删除/迁移/改写历史 |
| /api/kyc/files?review=1（图片/PDF） | 受原 reviewer/guardKyc 保护但材料本身可能肉眼包含证件/账号；不是这两个结构化字段的 JSON 出口 | 已知缺口：本批不重做文件/OCR/材料浏览审计，不能宣称所有敏感内容查看已审计；需要独立方案及批准 |
| /api/kyc/contract、/api/loan/sign | 客户 context；合同由现有借款人/签名摘要构成，不是员工 profile 输出；workflow 清除员工 contract | 保持客户路径，不改签约或资金逻辑 |

仅对已列源码路径做静态检查，不把“没有全文匹配”当作生产全出口安全证明；实施前新增/未知出口仍需复核。

### Task 0: staff 接口级默认脱敏（先于 reveal UI）
Files: lib/kyc/staff-projection.ts（可选纯模块）、lib/kyc/server.ts 的 staffView/decide 返回、app/api/kyc/review/route.ts；tests/kyc-staff-redaction.test.mjs。
Contract: staff profile.values 中两个字段只为掩码字符串；顶层 `sensitiveFields:{documentNumber:{masked:true},bankAccount:{masked:true}}`。audit 仍无值/材料、不得因标记恢复末4位；原始 payload 保持数据库内部完整值。所有 staff 响应 no-store。
- [ ] Define `projectStaffProfile(profile:Profile,role:string):{profile:Profile;sensitiveFields:Record<'documentNumber'|'bankAccount',{masked:true}>}`，只复制白名单目标字段；role=audit 保留当前清空策略。该返回结构由 Task 2 的 UI 消费。
- [ ] RED：详情 GET（admin/kyc/dept_admin）及 amend/审核决定响应都不含两个完整 synthetic secret；短/数字/空值同样处理；audit 无值；customer /api/kyc 不变。
- [ ] Run `TMPDIR=/private/tmp node --experimental-vm-modules --test tests/kyc-staff-redaction.test.mjs`；Expected: RED 原详情/POST 明文泄漏断言失败，再按下一步实现。
- [ ] GREEN：staffView 仅复制对象并投影，不原地修改解密对象或保存掩码到库。decide 所有员工返回统一 staffView；客户 save/view/签约路径不改。
- [ ] 查 history/CSV/报表/workflow/R5 集成边界，按上表做可执行回归；R5 未合并时显式跳过集成依赖而不是引入分支代码。禁止只做前端 DOM 遮罩。
- [ ] Run 同一命令；Expected: 目标测试 0 fail。Commit 仅 staff 投影/出口测试，不单独发布（Task 1/2 一起评审）。

### Task 1: 授权、审计成功后返回与短窗口去重
Files: Create lib/kyc/reveal.ts, app/api/kyc/review/reveal/route.ts; Create tests/kyc-reveal.test.mjs。
Interfaces: `revealKycValue(request:Request):Promise<{field:'documentNumber'|'bankAccount';value:string;revealToken:string}>`；路由使用 route({origin:'required',handler}) 和受限 JSON reader；失败具 requestId。revealToken 仅用于下述 amend 证明，不等同访问权限。
- [ ] RED：字段白名单外/畸形 id/非整数 revision 400；缺失/外国 Origin 403且不触发业务；audit/无team摘要角色403；跨租户404和未分配403；旧revision409。
- [ ] RED：审计失败响应不含 value；成功记录不含明文、末4位或 prop value；同actor+tenant+case+field+revision短窗口重复/并发只记一次，不同actor/field/revision各记一次；失败后可重新写。
- [ ] 运行 `TMPDIR=/private/tmp node --experimental-vm-modules --test tests/kyc-reveal.test.mjs`，确认因功能缺失的真实断言 RED。
- [ ] 最小实现：来源/JSON验证 → reviewer → getCase → guardKyc → 有效角色拒绝摘要 → revision核对 → payload解密；提取白名单值，不返回完整profile。
- [ ] 复用 audit(tenant,actor,'kyc_sensitive_reveal',{caseId,revision,field,requestId}).run()；await成功之后才响应。审计时间由既有列记录，无值/末4位。
- [ ] 审计成功后签发 5 分钟有效 revealToken，采用既有 PAYEASE_AUTH_SECRET（至少32字符，未配置则503；绝无开发默认回退）与 keyed/HMAC-SHA256、专用域分隔 `kyc-reveal-amend-v1`；token 载荷仅 actor/tenant/case/revision/field/issuedAt/expiresAt，不含原值、末4位、原值哈希。恒定时间验证，不用客户端布尔值作证。无新表；revision 绑定令已成功修改后的旧 token 失效。
- [ ] 30秒进程内去重，键为 JSON.stringify([tenant,actor,caseId,revision,field])，仅保存审计promise/到期时间，不存明文；每次先鉴权和revision检查。失败删除；过期清理，最大1000条，满时移除最早条目。明确跨实例不保证全局去重，沿用已确认设计的局限，不冒充数据库唯一性。
- [ ] targeted GREEN，检查既有 SQLite 外键开启，提交服务端最小功能。

### Task 2: amend 安全合并与请求驱动 UI
Files: Modify lib/kyc/server.ts amend、components/kyc-review-controls.tsx、app/kyc/client.tsx；lib/kyc/ui-copy.ts；tests/kyc-reveal.test.mjs、tests/kyc-review-controls.test.mjs、tests/kyc-customer-copy.test.mjs、tests/kyc-amend-sensitive.test.mjs。
Interface: SensitiveValue 接收 caseId/revision/field/scope 和已掩码 value/标记，不接收原始 prop 明文；点击 POST `{id:caseId,revision,field}`，成功只使用同 field/string value。明文和 revealToken 仅存当前组件/当前代修改表单内存，不写 localStorage/sessionStorage/URL/日志。
- [ ] RED：只代修改姓名/住址等其他字段，提交的两敏感字段是掩码/缺省/带标记时，数据库原值逐字保留；before/after 审计也不存这两个值或末4位。
- [ ] RED：伪造 revealed/dirty 标记不生效；无 token 企图更新原值、伪造/过期/其他 actor/company/case/revision/field 的 token 失败；失败无案件/审计副作用。即使有 token，未改值也不计作 changed。
- [ ] Run `TMPDIR=/private/tmp node --experimental-vm-modules --test tests/kyc-amend-sensitive.test.mjs tests/kyc-review-controls.test.mjs tests/kyc-customer-copy.test.mjs`；Expected: 新增防覆盖/揭示交互断言先 RED。
- [ ] 最小实现：先原有 reviewer/getCase/guardKyc(write=true)/revision/岗位和字段组权限，再从数据库 data.profile 开始合并。对每个敏感字段：缺省、`masked:true` 或等于当前 canonical mask 时保留原值；真正新值必须是 reveal 后明确 dirty 的原始字符串并携带有效 field token，验证后才作为候选 changed。缺少/无效证明不静默修改，返回明确错误；服务器不采信客户端单独标记。
- [ ] UI 未 reveal 的敏感输入保持只读遮罩；reveal 成功才可编辑，dirty 只由用户输入产生；请求带每字段 `{masked,dirty,revealToken}` 元数据。隐藏/取消/切换案件或 revision 清空明文、dirty 与 token，重新显示必须再次请求。提交响应统一脱敏，不把完整响应缓存回前端。
- [ ] 对短值/空值/“恰好等于遮罩”的输入，优先保留原值，宁可不接受模糊替换，禁止把 `****1234` 存入数据库；需要这种格式的真实更正另行确认规则。
- [ ] RED：成功前/失败后原始 prop 明文不可见；成功后显示返回值而非 prop；隐藏后再显示再次请求；迟到响应在隐藏/卸载/案件或revision变化后不可见；失败提示 zh/en/km 正确；忙时不重复发送。
- [ ] 运行组件及真实客户/reviewer harness，确认断言 RED；不以源码 grep 代替交互测试。
- [ ] 加 loading/error 状态及请求生命周期 token；scope/隐藏/卸载使迟到结果失效。失败统一“无法显示，请重试”及已确认的三语译文，不把错误文本或值输出到日志。
- [ ] 更新唯一实际审核调用点传正确 caseId/revision/field；保留 K6c 代修改确认和遮罩重置行为，客户流程不变。
- [ ] targeted GREEN；运行全量 `TMPDIR=/private/tmp npm test`、typecheck、build:separated leaks0、lint0 errors，记录既有 warnings；独立全分支复核、普通推送、等待新 CI。
- [ ] 仅用本地合成资料取审核桌面成功/失败截图，并检查网络 GET/POST 实际响应（不只是 DOM）不提前下发明文；不碰线上值。附出口清单、已知文件/历史审计/自由文本缺口，等评审及负责人批准合并。

## Self-review / Handoff
本次修订解决了旧计划承认的 GET 明文缺陷，并把 staff POST 响应与 amend 防掩码覆盖纳入同一闭环。新增 revealToken 为无迁移、可验证“已 reveal”的设计提议，必须由 Claude 再复核，不据此直接实施。若发现既有密钥/响应契约无法支持而确需持久化或迁移，停下说明，不自行建表。当前仅修改计划文档，未新增接口、改动线上状态或写入审计。不合并、不部署。

## 2026-10-26 1100 执行补记
- 1100-01 已批准本修订计划，现已按 RED→GREEN 实施。服务端 a 为 #113，前端 b 堆叠其上；不单独部署或自动合并。
- staff 掩码沿用更严格规则：≤4位仅遮罩，5–8位末2位，>8位末4位；客户 view/payload 不改。服务器先规范化掩码再做 amend 合并，防空白包裹的遮罩写入原值。
- 独立终审发现并复现两个 Important：字段卸载时父表单保留明文/凭证，及空白包裹掩码覆盖原值。均补 RED→GREEN 回归；字段 cleanup 清父状态，并以实时案件 id/revision 防旧 cleanup 改写新案件。
- R5 #112 已按负责人本对话许可合入 main 86f1b55；本分支以普通 merge 同步，不再把 R5 说成未合并；其 7 个实际差异回归随全量门禁执行。
- 使用本地合成 SQLite 全迁移、原 reviewer/getCase/guardKyc/加密/审计与真实 HTTP handler，配合 Chromium 截审核桌面成功/失败状态。无生产请求、真实 Cookie 或个人资料。
- 当前合并规则以负责人 2026-10-26 新委托为准：Claude 在 inbox 明确“Claude 批准合并 #编号”且 CI 通过可代理批准；仅本实施计划批准不等于产品 PR 合并批准。部署/迁移/资金逻辑等仍须负责人本人批准。
