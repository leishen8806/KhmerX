# 后台权限与运行配置审计（2026-11-05）

## 结论

本次审计基于 `origin/main` `74a7597`（已包含 #180、#182），只读检查了员工身份、入口、公司/组织、成员权限、客户端语言、机器人、产品/费率、风控、审计完整性、应急授权、工单、报表导出、通知模板、贷后配置和 KYC 跟进等后台接口及页面。未执行数据库迁移、资金/放款/还款逻辑修改、部署或线上写操作。

未发现可在本卡范围内确认的 P0 权限绕过。发现一个 P1 可观测性缺口：后台工作台只展示数据库中的公司/语言/分单状态，不展示当前 H5/Telegram 认证方式、独立 demo OTP 开关和浏览器当前公司绑定是否有效；运营人员无法在不读取环境变量的情况下确认“当前渠道认证方式”和“公司绑定状态”。该缺口不直接扩大权限，但会导致错误环境或错误公司上下文被误判为可用。修复拆为单独的只读界面 PR，不修改环境变量。

其余发现均为 P2（操作体验或后续治理）：审计完整性、应急权限、风控规则、通知模板等页面依赖后端权限，但当前菜单仍按岗位展示较宽的导航项；部分 GET 会触发过期应急授权清理或返回完整业务列表，建议后续按“只读查询不产生写副作用”和最小数据集继续收敛。资金/放款/还款相关项只报告，不在本任务实现。

## 权限模型与入口

| 范围 | 读取/写入规则 | 证据 |
| --- | --- | --- |
| 员工身份、SSO、密码、MFA | `staffIdentity()` 建立用户与员工关系；`staff()` 要求所选公司存在启用成员，并校验员工入口 cookie 与 `portalAllows`。员工登录、MFA enrollment/disable、会话撤销均在 auth 路由处理；MFA step-up 由 `requireMfaStepUp` 保护高风险写操作。 | `lib/team/auth.ts:9,43`；`lib/team/server.ts:19-20,58-63`；`app/api/team/auth/route.ts:1-56` |
| 服务机构/持牌机构入口 | lender 入口只允许 `checker`、`finance_checker`；business 入口拒绝 lender/checker/finance/finance_checker。该矩阵与角色 unit 约束一致。 | `lib/team/auth.ts:9`；`lib/team/policy.ts:3-14`；`lib/team/server.ts:19` |
| 公司上下文 | `/api/team` GET 经过 `teamData`/`staff`，返回脱敏公司、成员、组织、角色目录、价格和审计轨迹；`safeCompany` 不返回数据库内部定价以外的密钥。进入公司时再次检查成员关系并设置 HttpOnly、SameSite cookie。 | `lib/team/server.ts:26,35`；`app/api/team/route.ts:6-7` |
| 角色/数据范围 | `canSee` 按岗位和 assignment/unit 限制数据；admin/audit 可查看公司审计轨迹，其他岗位按部门/机构或分配范围读取。写操作使用 `actionRoles`、岗位检查和版本条件。 | `lib/team/policy.ts:34-47`；`lib/team/server.ts:65-190` |
| 高风险与双人控制 | admin/lender/checker/finance/finance_checker/audit 标记为 high-risk；角色变更通过另一 Admin 批准的 emergency grant；资金操作、产品审核、费率和通知模板写操作要求 MFA/版本校验。 | `lib/team/policy.ts:3-14`；`lib/team/server.ts:51-63,134-140,166-190`；`app/api/team/products/route.ts:23-59` |

## 配置页与接口审计

| 配置/页面 | 读取 | 写入 | 审计/校验结论 |
| --- | --- | --- | --- |
| 公司、客户端语言、默认部门、自动分单 | `/api/team` 的 `teamData`；页面工作范围区展示公司 slug、自动分单和语言。 | `/api/team` 的 `manage`：`client_language_config`、`assignment_mode`；admin + MFA，默认部门必须是当前启用 department。平台公司管理另有 platform admin 保护。 | 写入均带公司条件和 `audit`；原因/字段/语言有校验。`lib/team/server.ts:65-111,134-140`。 |
| 员工、角色、单位、KYC 字段权限 | `/api/team` 返回按 admin/dept_admin 范围的成员/单位；页面提供员工、组织与字段权限。 | `create_member`/`update_member`/`add_unit`/`update_unit`/`kyc_field_permission`。角色和单位类型校验，版本条件，角色变更需批准，不能修改自己。 | 成员和权限变化写 `team_audit`；机构代码、牌照日期、支持币种、重复名称有校验。`lib/team/server.ts:114-190`。 |
| 机器人/频道 | `/api/team/bots` 只允许 admin 配置，token 由 `configureBot` 校验、加密保存并写审计；页面的 BusinessBots/TelegramNotifications 依岗位显示。 | admin + MFA/来源校验。 | 未发现 token 回显；建议后续补充“已配置/未配置”而非 secret。`app/api/team/bots/route.ts:1-5`。 |
| 通知模板 | admin GET；POST 委托 `manage`，要求 MFA、locale/event key/title/body/reason 和版本；禁止金额模板字段。 | admin + MFA。 | 写入前后快照和审计；并发版本保护。`app/api/team/notification-templates/route.ts:5`；`lib/team/server.ts:123-132`。 |
| 产品与费率 | 产品 GET 允许 admin/audit/ops 读，创建/提交为 admin/ops，审核/退休为 admin/audit 并要求 MFA；公司 `/api/team` 返回 `pricing`，页面 PricingPanel 可保存。 | 产品和费率写入均做结构校验、版本校验、MFA，并写审计。 | 这是金融相邻配置；本任务只审计，不修改。`app/api/team/products/route.ts:8-59`；`lib/team/server.ts:134-138`。 |
| 风控规则、贷后/承接路由 | `risk-rules`、`servicing` 的库函数按 admin/audit/ops 细分读写；servicing 写仅 admin；risk rule review/pause 需要 MFA。 | 依岗位、MFA、版本/字段校验。 | 写入有审计；后续应补充页面对“可读但不可写”的明确提示。`app/api/team/risk-rules/route.ts:1-6`；`app/api/team/servicing/route.ts:1-5`。 |
| 审计完整性 | admin/audit 可列出、创建、验证当前公司的 manifest；HMAC 使用 `PAYEASE_AUTH_SECRET`，manifest 查询带 tenant 条件。 | POST 要求来源校验；库函数再次做 admin/audit 检查。 | `team_audit`/`auditInsertSql` 为统一写入路径；发现 GET 会产生 `expireEmergencyAccess` 的清理副作用（P2，建议拆分）。`lib/team/audit-integrity.ts:4-13`；`lib/team/server.ts:32-35`。 |
| 应急权限 | admin 可查看、申请、批准、撤销；批准要求 MFA，申请人不能批准自己，授权绑定范围/贷款/金额和 30 分钟期限。 | admin + MFA + 双人批准。 | 关键状态变化均审计；GET 列表会先清理过期授权，建议后续改为显式后台 job/事务（P2）。`lib/team/emergency.ts:4-11`。 |
| 工单、标签、KYC 跟进、报表导出 | 各库函数/路由按 admin/audit/ops/dept_admin/collection_admin/collector 或 KYC assignment 限制；audit 工单只读。报表导出要求 requestId，导出列对 ID/手机号脱敏并写审计。 | 来源校验、租户条件、输入长度/枚举/归属校验；报表为 POST。 | 未确认 P0/P1 绕过；建议后续将所有只读页面的返回字段再按岗位缩减。`app/api/team/tickets/route.ts:18-19`；`lib/team/reports.ts:6-27`。 |

## 环境变量与公司绑定

认证运行时实际读取：

- H5 首选 `PAYEASE_H5_AUTH_MODE`，回退 `PAYEASE_AUTH_MODE`，默认 `disabled`；`demo` 仅在 `PAYEASE_DEMO_OTP_ALLOWED=true`、`PAYEASE_ENV` 为 `local/gray` 且非 production 时允许。
- Telegram 使用 `PAYEASE_TELEGRAM_AUTH_MODE`（默认 `telegram`），机器人 token 使用 `TELEGRAM_GATEWAY_TOKEN`/`TELEGRAM_BOT_TOKEN[_N]`。
- `KHMERX_TEST_MODE` 会同时影响 MFA、双人审批、文件扫描等 guard，不应被当作单独的 H5 demo 开关；生产启动由 `assertProductionSafe` 拒绝危险组合。
- 当前前台没有只读显示上述 channel mode、demo OTP 是否允许、gateway/token 是否已配置，也没有显示浏览器 `CUSTOMER_COMPANY_COOKIE` 是否指向当前公司。员工只能看到数据库公司字段，无法判断环境配置与客户入口绑定是否一致。

证据：`lib/h5-auth.ts:16-18`；`lib/runtime-guards.ts:14-55`；`lib/team/server.ts:26,35`；`app/team/client.tsx:96`。

## 缺陷分级与处理边界

### P1：认证方式/公司绑定状态不可观测（修复 PR）

后台操作员无法在页面确认当前 H5/Telegram 认证方式、demo OTP 是否被独立允许、或浏览器当前公司绑定是否有效。误配时可能把“disabled/错误公司”误判成渠道故障或错误地指导用户，影响灰度与运营排障。修复只返回不含 secret 的状态快照并在公司工作范围区展示；不允许通过后台修改环境变量。

### P2：只读页面仍带有隐式清理副作用（不在本卡修复）

`emergencyList()` 调用 `expireEmergencyAccess()`，审计完整性页面列举/验证也会写入审计记录。建议后续把过期清理放到明确的维护任务或事务边界，保持 GET 语义可预测；这不构成已确认的权限绕过。

### P2：菜单与后端权限的可见性不完全一致（不在本卡修复）

`CrmMenu` 对岗位展示统一的业务/审计分组，后端仍正确拒绝无权操作。建议后续按 `roleCatalog` 和 route capability 做菜单裁剪，以降低误操作和客服解释成本。

### 资金/迁移事项（仅报告）

`funding-settings`、`funding-risk`、`products` 的资金/产品变更，以及任何 drizzle migration、线上资金写入均不在本卡执行；需要技术负责人本人单独批准后再安排。

## 修复验收

修复 PR 应满足：

1. `teamData` 只返回 mode/boolean/绑定状态等非秘密字段，不返回任何 token、secret、cookie 原值或环境变量原文。
2. 面板明确标记“只读”，所有岗位只读，不新增任何写接口。
3. H5 的 `PAYEASE_H5_AUTH_MODE`/`PAYEASE_AUTH_MODE`、Telegram mode、demo OTP guard 与客户公司 cookie 的状态有测试覆盖。
4. 运行 `TMPDIR=/private/tmp npm test`、typecheck、`TMPDIR=/private/tmp npm run build:separated`、lint；CI 通过后提交 PR，但本任务不合并修复 PR。
