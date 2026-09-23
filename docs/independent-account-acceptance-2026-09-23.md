# 测试邮箱岗位验收 — 2026-09-23

范围：本地隔离 SQLite 数据库，运行未改动的应用业务服务，以测试邮箱模拟平台认证身份。未创建线上密码登录、未绕过生产认证、未使用真实客户资料。

已通过：
- 公司 A/B 数据隔离；公司外员工拒绝访问。
- 审核员仅访问分配给自己的 KYC；管理员无 KYC 原件权限。
- 部门管理员仅在本部门人工改派。
- 员工停用、启用、角色变更与旧权限失效。
- 机构审批、独立复核、放款、放款复核由不同账号执行；拒绝本人复核。
- 客户申请、签名合同、审核、资金账本与结清协作。
- 贷后客服只处理本人任务，主管只管理本部门；改派后旧客服不可见。
- Telegram 通知管理仅管理员和审计员可见；订阅绑定需客户会话与有效 Telegram 签名。

测试邮箱：owner@example.test、reviewer1@example.test、reviewer2@example.test、manager@example.test、lender@example.test、checker@example.test、finance@example.test、cashcheck@example.test、collector-a@example.test、collector-b@example.test、collection-manager@example.test。

限制：上述邮箱是合成测试身份，不是可实际收信、登录 ChatGPT/Sites 的账户。这是服务端角色和业务协作验收，尚不构成真实员工在线独立登录的浏览器验收。
