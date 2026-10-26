# KYC Lint Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans after plan review.

**Goal:** 首批只移除已确认未使用绑定，不改变运行行为。
**Architecture:** app/kyc/client.tsx 清理 Link、LoanBill、LOAN_TERMS_URL、loanTerms、isPersonName、normalizePersonName 导入与无用 map index；lib/kyc/server.ts 清理 assignments/canSee 导入。保留仍有副作用的模块导入，不进行大规模类型/Hook/图片重构。
**Tech Stack:** TypeScript、ESLint、Node regression tests。
**Spec:** claude-bridge/done/20261024-1650-05-kyc-lint-cleanup.md。

## Global Constraints
- 最低优先级；基于最新 main，只允许 app/kyc/**、components/kyc-*.tsx、lib/kyc/** 与对应测试。
- 每 PR 约300行，不改 lint 规则、不加 eslint-disable、不改行为，只 PR 等评审。
- 当前实际基线 head23a0db3（源码与 main682bbcb一致）：npm run lint exit0，0errors/585warnings；日志 /private/tmp/kyc-lint-plan-baseline.log。

## Review Focus
- 删除整个 import 可能删除模块副作用，须保留必要 bare import。
- 不把 Hook 依赖警告机械加依赖导致请求循环。
- 不把原生图片改 Image 导致鉴权/对象URL变化。
- 不用 any->unknown 断言掩盖错误。
- 前后数量必须相同命令、相同产物排除范围实测，不用全仓变化冒充本 PR 减少。

### Task 1：未使用绑定清理
Files: app/kyc/client.tsx；lib/kyc/server.ts；必要既有回归。
- [ ] 阅读 import 模块顶层副作用及使用点；发现不确定则保留并记录。
- [ ] 先运行相同基线 lint 并记录目标 warning 位置；此纯删除不引入功能，无需编造 mock 行为测试。
- [ ] 最小移除未使用绑定/index，先 diff review，再 npm test、npm run typecheck、npm run build:separated、npm run lint。
- [ ] 目标告警实际消失、0错误，其他功能回归不退化；记录前后数量和剩余警告。
- [ ] 普通推送独立分支 feat/client/kyc-lint-unused，PR≤300行，等待新 CI 与评审，不合并。

## 待复核
writing-plans 要求先复核；当前未实施。更复杂 Hook/类型警告拆后续批次，不为了清零改变业务。
