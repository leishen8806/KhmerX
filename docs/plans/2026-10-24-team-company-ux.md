# Team Company UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after plan review.

**Goal:** 仅改善现有公司选择与新增员工提示，不变更权限和会话。
**Architecture:** app/team/client.tsx 用现有 data.companies/memberships/members 做本地提示；name+slug 标记所有切换入口。服务端保持最终唯一性裁决，不新增查询或权限。
**Tech Stack:** React/TypeScript，现有真实组件 Node 回归与本地浏览器。
**Spec:** claude-bridge/done/20261024-1650-04-team-company-ux.md。

## Global Constraints
- 基于最新 main，feat/client/team-company-ux，约400行，只 PR 等评审。
- 不改认证、会话、Cookie、服务端权限或唯一约束；不从 #63 移植代码。
- 全量四门禁与 CI 通过，真实组件合成数据截图，不触碰线上。

## 已核对 main 682bbcb
- CompanySwitcher 和未选公司按钮只显示 m.name/岗位，缺 slug；同名不能区分。
- 创建公司与 PlatformCompanyRow 没有同名提醒；只能基于已授权返回的 companies 提示，不暴露其他公司。
- 两处账户菜单写“所属公司”，没有明确“当前公司”。当前文件未发现平台级“默认公司”设置，不能擅自新增或修改自动进入行为。
- 创建员工按钮无大小写归一化重复检查；lib/team/server.ts:173 已按 tenant_id+lower(email) 拒绝重复。前端不能以部分成员列表断言邮箱不存在，仍保留服务端错误。

## Review Focus
- 同名公司不同 slug 仍可辨认，不把警告变成禁止重名约束。
- 编辑公司排除自身 id；trim/case 规则须一致。
- 邮箱 trim+lowercase 提示，跨公司同邮箱不误拦。
- 授权列表可能不完整，本地未发现不代表服务端不存在。
- 无历史选择语义只改现有显示，不变 localStorage/自动进入/Cookie。

### Task 1：前端提示与标识
Files: app/team/client.tsx；必要小型纯前端 helper；tests/team-company-ux.test.mjs；现有后台三语映射。
- [ ] 先读完整控制器与测试 harness；枚举所有公司切换入口。若发现需认证/服务端改动，停止报告。
- [ ] RED：同名创建/编辑提示（排除自身），同名不同代码可辨认，两处菜单当前公司，大小写/空白邮箱重复，以及未命中仍交服务端裁决。
- [ ] 最小新增 UI 警告与 name+slug；不改 post 的 action/载荷或业务规则；仅对已返回的本公司 members 做重复提醒。
- [ ] GREEN；npm test、npm run typecheck、npm run build:separated、npm run lint；等待新 CI。
- [ ] 合成数据桌面与375px截图；普通推送并开 PR，等待评审不合并。

## 待复核
writing-plans 要求先复核计划；本轮已完成静态核对，尚未运行页面，不把静态发现说成真实设备复现。“默认公司”不在最新主线 UI，计划只对确实存在的问题修改，请复核。

