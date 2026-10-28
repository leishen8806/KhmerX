# 2026-10-28 决定汇总(批次 D)

归档方式:按批次(一个分支、一个提交)。前序:批次 C(`status/2026-10-27-decisions-batch-c.md`)。
来源:技术负责人在对话中的回复,由 Claude 记录。本汇总不批准任何窗口,灰度、VPS、L2/Q12 保持 HOLD。

## 决定 1:审计清单排序采用方案 R,v3 随新清单启用(D-36)
- **负责人原话:** "采用 R,v3 随新清单启用"。
- **含义(Claude 的理解):** 采用 `docs/reviews/audit-manifest-ordering-options-20261028.md` 的方案 R:按 `rowid` 排序,不改写入点,不要求迁移;新创建的清单使用 `v3:` 摘要版本;已有 `v2:` 清单保持原算法,并在报告中标明旧排序有已知局限。
- **这条决定没有说的:**
  - **实现何时开始。** D-33 写明本 15 天内不改 `audit-integrity.ts` 或清单算法。本决定只采用设计,**不解除 D-33 的实施限制**;何时实现由负责人另行说明。
  - 是否做两项可选的可加性迁移(清单表加 `last_rowid` 列;`team_audit(tenant_id)` 索引)。默认不做,负责人另行批准才做。
  - `INSERT OR REPLACE` 绕过 append-only 触发器是否单独立项(见方案文档 §5)。未决定,保持开放。
- **对终局报告的影响:** `approvals/2026-10-27-manifest-ordering-carryover.md` 里"需要 schema 迁移和约 20 个写入点"的说法已被取代。按 R,不需要迁移、不需要改写入点。终局报告应写为:"设计已定(R/v3),实现未做或未验收";在实现并验收前,清单校验的处置口径不变:报"被篡改"且行数增加时按"需要人工复核"。
- **后续:** 实现 PR 按 H8 先评审后合并,涉及 `lib/team/audit-integrity.ts` 与测试。任务提示词只在聊天里给,不进仓库。

## 记录:任务提示词清理
- 负责人要求:所有任务提示词不上 GitHub,并清理 GitHub 上已有的。
- 已推送分支 `docs/tasks/remove-codex-prompts-20261028`(`32a6c0e`),删除 `docs/tasks/codex-prompts/` 下 18 个文件。**截至本批次起草时尚未合入 main。**
- 仍有文档指向这些卡(`queue/su-chen.md`、`l2-gate-a-window-checklist.md`、H2/H3 批准、`decision-log.md` D-26、`codex-workflow.md`、`briefing-dawang.md`);指针未改,卡内容可由历史取回。
- 未纳入清理、等负责人决定:`orchestration-prompts.md`、`week1-2-task-cards.md`、`queue/*.md`、`orchestration/zhixu-*.md`,以及远端旧分支上的卡文件。
