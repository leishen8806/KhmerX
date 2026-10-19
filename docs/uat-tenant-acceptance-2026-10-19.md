# 专用 UAT 租户验收记录（2026-10-19）

## 1. 租户与版本

- 生产入口：[KhmerX · PayEase](https://khmerx-payease-demo.zhangdaowang3.chatgpt.site)
- 专用 UAT 租户名称：`KhmerX UAT Closed Loop 20261019`
- 公司入口代码：`uat-closed-loop-20261019`
- 状态：启用
- 默认公司：`KhmerX UAT Closed Loop 20261019`
- 本次发布提交：`3f655fd3b4b1dd7bc88ac40f85f432dd10f12049`
- Sites 发布：版本 `314`，部署状态 `succeeded`

## 2. 本次修复

平台管理员在“创建公司”后不应被自动写入业务公司 Cookie。此前通用管理接口会把 `companyId` 当作当前业务公司写入，造成平台范围被误切换、公司列表短暂为空或页面数据范围错乱。本次仅保留 `enter`/`customer_enter` 的公司 Cookie 写入；已选公司状态下的平台管理员仍返回完整公司列表，头像菜单可继续切换公司。

## 3. 浏览器实操证据

在生产站点的公司管理页完成以下操作：

1. 读取公司管理页，看到专用 UAT 租户、入口代码、启用状态和“默认公司”。
2. 打开右上角账户菜单，看到当前公司为专用 UAT 租户，且列出其他公司切换入口。
3. 切换到 `uat-company-a`，账户菜单回读为“所属公司：联调测试公司 A”，页面未丢失平台公司列表。
4. 切回专用 UAT 租户，进入“公司与部门”，页面回读为“所属公司：KhmerX UAT Closed Loop 20261019”，仅显示该租户的部门目录（2 项）。
5. 生产 Worker 错误日志检查未发现异常；H5 未登录请求的 401 为预期认证结果。

## 4. 合成业务闭环证据

专用隔离 UAT 合成批次由 `tests/team-integration.test.mjs` 执行，覆盖：

- 公司、部门、持牌机构与员工创建、角色/数据范围隔离；
- KYC 建档、补件、审核通过/退回与复核；
- 借款申请、费用确认、独立签约、审批与放款；
- 账单生成、还款、逾期处理、结清；
- 双人复核、停用员工、MFA、登录/退出、公司切换与审计；
- 附件配额、跨公司访问拒绝、报表导出脱敏和审计完整性。

结果：`npm test` 247 passed、0 failed、1 explicit skip；专项团队集成测试 69 passed、0 failed。

## 5. 发布前检查

- `npm run typecheck`：通过
- `npm run lint`：通过，0 errors（既有 warnings）
- `npm run audit:i18n`：通过
- `npm run build`：通过，client boundary 113 files
- `npm run build:separated`：通过，leaks 0

## 6. 数据闭环边界与后续动作

线上专用租户已完成创建、默认公司绑定、头像切换和组织范围回读；生产共享数据未通过隐式 seed 写入合成贷款/账单，避免把测试业务混入共享租户。完整 KYC→审批→放款→账单→还款→审计闭环已在隔离 SQLite UAT 批次验证。若要在生产租户进行可追溯业务演练，应先增加受控的 UAT seed/清理入口（带批次号、幂等键和审计），再执行同一批次的浏览器回放。
