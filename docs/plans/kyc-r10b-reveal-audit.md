# KYC R10b Reveal Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task after high-risk plan review. Track steps with checkboxes.

**Goal:** 审核员显式查看 documentNumber/bankAccount 时先完成不含敏感值的审计，再显示本次接口返回的明文。
**Architecture:** POST /api/kyc/review/reveal 复用既有读取权限及 team_audit，无迁移。SensitiveValue 不再直接显示 prop 中的完整值；成功响应才可显示，失败/隐藏/案件版本切换都保持或恢复遮罩。
**Tech Stack:** Next TypeScript、现有 route/readJsonBody、D1/SQLite、React、Node VM 实际 handler/UI 测试。
**Spec:** claude-bridge/done/20261024-1346-02-kyc-r10-reveal-audit.md、20261024-1510-05-kyc-r10b-resume.md、20261026-0915-03-r10b-unblocked.md；设计及负责人开发授权已确认，不含合并/部署。

## Global Constraints
- 从 origin/main 416e99c 新建 feat/server/kyc-r10-reveal-audit；#88 已合并，旧依赖阻塞不再成立，不依赖 #87 未合并分支。
- README 规定审计/鉴权高风险实施计划需 Claude 复核；旧任务已确认设计，本逐步计划提交复核后再新增运行代码。
- 白名单精确为 documentNumber、bankAccount；不借接口扩大值读取权限，audit 403。
- 复用 team_audit/audit()；若任何路径确需表/字段/迁移，停止，不创建假租户或关闭外键。
- GET 仍下发完整值，不是 API 层脱敏；R5 与本任务分开，不在此改变代修改契约。
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

### Task 1: 授权、审计成功后返回与短窗口去重
Files: Create lib/kyc/reveal.ts, app/api/kyc/review/reveal/route.ts; Create tests/kyc-reveal.test.mjs。
Interfaces: `revealKycValue(request:Request):Promise<{field:'documentNumber'|'bankAccount';value:string}>`；路由使用 route({origin:'required',handler}) 和受限 JSON reader；失败具 requestId。
- [ ] RED：字段白名单外/畸形 id/非整数 revision 400；缺失/外国 Origin 403且不触发业务；audit/无team摘要角色403；跨租户404和未分配403；旧revision409。
- [ ] RED：审计失败响应不含 value；成功记录不含明文、末4位或 prop value；同actor+tenant+case+field+revision短窗口重复/并发只记一次，不同actor/field/revision各记一次；失败后可重新写。
- [ ] 运行 `TMPDIR=/private/tmp node --experimental-vm-modules --test tests/kyc-reveal.test.mjs`，确认因功能缺失的真实断言 RED。
- [ ] 最小实现：来源/JSON验证 → reviewer → getCase → guardKyc → 有效角色拒绝摘要 → revision核对 → payload解密；提取白名单值，不返回完整profile。
- [ ] 复用 audit(tenant,actor,'kyc_sensitive_reveal',{caseId,revision,field,requestId}).run()；await成功之后才响应。审计时间由既有列记录，无值/末4位。
- [ ] 30秒进程内去重，键为 JSON.stringify([tenant,actor,caseId,revision,field])，仅保存审计promise/到期时间，不存明文；每次先鉴权和revision检查。失败删除；过期清理，最大1000条，满时移除最早条目。明确跨实例不保证全局去重，沿用已确认设计的局限，不冒充数据库唯一性。
- [ ] targeted GREEN，检查既有 SQLite 外键开启，提交服务端最小功能。

### Task 2: SensitiveValue 请求驱动显示与三语失败提示
Files: Modify components/kyc-review-controls.tsx, app/kyc/client.tsx; Extend lib/kyc/ui-copy.ts（如采用既有三语表）；Extend tests/kyc-review-controls.test.mjs、tests/kyc-customer-copy.test.mjs。
Interface: SensitiveValue 接收 caseId、revision、field、scope及原value（仅用于初始遮罩）；点击显示 POST `{id:caseId,revision,field}`，成功只使用 API 返回的同 field/string value。
- [ ] RED：成功前/失败后原始 prop 明文不可见；成功后显示返回值而非 prop；隐藏后再显示再次请求；迟到响应在隐藏/卸载/案件或revision变化后不可见；失败提示 zh/en/km 正确；忙时不重复发送。
- [ ] 运行组件及真实客户/reviewer harness，确认断言 RED；不以源码 grep 代替交互测试。
- [ ] 加 loading/error 状态及请求生命周期 token；scope/隐藏/卸载使迟到结果失效。失败统一“无法显示，请重试”及已确认的三语译文，不把错误文本或值输出到日志。
- [ ] 更新唯一实际审核调用点传正确 caseId/revision/field；保留 K6c 代修改确认和遮罩重置行为，客户流程不变。
- [ ] targeted GREEN；运行全量 `TMPDIR=/private/tmp npm test`、typecheck、build:separated leaks0、lint0 errors，记录既有 warnings；独立全分支复核、普通推送、等待新 CI。
- [ ] 仅用本地合成资料取审核桌面成功/失败截图；浏览器依赖不可用则明确缺口、保持Draft，不碰线上值。附计划、证据和 GET非脱敏限制，等评审及负责人批准合并。

## Self-review / Handoff
全部原需求已覆盖：白名单、audit403、原可见范围、同源/revision、先审计后返回、无敏感审计、去重及多实例局限、三语失败/重新请求/切换遮罩、无迁移、截图与全量门禁。无需扩展已确认设计；请 Claude 复核此实施计划后执行。当前只有本计划文件，未新增接口或审计写入。
