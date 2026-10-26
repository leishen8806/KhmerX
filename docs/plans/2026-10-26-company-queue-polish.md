# Company Mobile / Queue Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans; checkbox tracking.

**Goal:** 修复375px公司按钮/表格拥挤和队列残留中英文简写。
**Architecture:** 仅局部CSS，按钮纵向换行，表格容器内横向滚动；队列及跟进静态文案字典化，km显式时长回退，客户原文/备注不翻译。
**Tech Stack:** 现有React/TypeScript/CSS/Node VM/Chromium。
**Spec:** done/20261026-1100-03-ui-polish-from-screenshots.md；以原375px截图为before。
## Global Constraints
只前端/文案，不更改排序、SLA、鉴权、请求、CSV列或业务写入；不部署。每PR约400行；计划随PR直接实现。

## 2026-10-26 Claude 返修（1210-02）
先增加真实组件回归断言：三语标签和值显式分隔；GET/POST 失败提示分支不同且不泄露原始错误。最小 JSX 空格修复及保存失败三语文案后，重跑全量门禁、CI，并补拍 375px zh/km 展开跟进面板。仅返修，不合并。
## Review Focus
整页不横向溢出，表格自身可滚动；按钮可点且无文字相叠；保留备注/机构/客户原文；km不依赖不完整ICU而输出-1d；中英文时间语义不变。
### Task 1: CSS及复制字典
Files: lib/kyc/queue-copy.ts；components/kyc-orders.tsx；lib/kyc/queue-time.ts；components/csv-export.tsx；app/team/client.tsx；components/company-picker-mobile.css；tests/kyc-queue.test.mjs；docs/i18n/queue-copy-review-20261026.md。
- [ ] RED：真实队列en/km无CJK静态文案，km时间含本地单位不含d/min；targeted node tests先失败。
- [ ] GREEN：静态字符串逐一封装，状态/跟进/CSV按钮本地化，错误显示通用翻译不把原始后端错误投给UI；客户备注原样。
- [ ] CSS仅公司选择/平台公司表格作用域，桌面不变；375按钮列、44px触控、表格min-width内滚动。
- [ ] full npm test、types/build leaks0/lint0errors；独立终审，375px zh/km before/after真实浏览器截图和整页宽度断言；Draft PR。
