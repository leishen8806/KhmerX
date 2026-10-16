# R3：全量复核（R1、R2 都合并后执行，不改代码）

基线：R1、R2 都已合并后的最新 `origin/main`。分支：无（只出报告）；报告提交到 `docs/tasks/status/<日期>-R3-full-recheck.md`（`Line: server`，文档 PR，< 400 行）。
冻结同 R1/R2：L2/Q12 = HOLD；灰度/VPS = HOLD；不操作 159.223.77.134、165.22.108.5；不访问任何 khmerx.org 域名。

## 1. 复核命令（`node:22.22.1-bookworm-slim`、`--network none`、只读挂载、复用已有依赖；方式见 R1 §4）
1. `npm test`（容器内，含 L1-G 门控测试时另跑一遍：`--user 1000:1000`、`-e L1G_CONTAINER=1`、`--tmpfs /data:uid=1000,gid=1000,mode=755`、`--tmpfs /out:uid=1000,gid=1000,mode=700`）
2. `npm run typecheck -- --incremental false`
3. `npm run lint`（记录 errors 与 warnings 总数）
4. `npm run check:client-boundary`
5. `git diff --check`（宿主机）

## 2. 达到的状态（缺一则不算完成）
- 原失败测试 `Telegram signed subscription, tenant isolation, one-time delivery and unsubscribe` 通过；`audit` 相关运行时错误消失。
- typecheck 通过（0 错误）。
- lint **errors = 0**（warnings 不要求清零，但**不得高于 577**，且不得靠降低规则级别、`eslint-disable` 或删除测试实现）。
- client-boundary 通过（容器内）。
- 没有新增测试失败；**跳过项逐项列出名称与原因**（例如依赖 Docker、依赖 `L1G_CONTAINER=1`、依赖 k6），**跳过不计入通过**；在门控环境里应通过的测试必须真的跑过一次。
- `git diff --check` 无输出。

## 3. 报告格式
基线 SHA；每条命令的结果摘要；与 `461d070` 基线对比表（测试 268/255 通过/1 失败/12 跳过 → 现状；typecheck 1 错误 → 现状；lint 2 errors/577 warnings → 现状）；跳过清单；如出现**其他阻断错误**，只报告根因与最小拆卡建议，**不擅自扩范围**。
结论行：`REPAIR VERIFIED: YES / NO`、`L2/Q12: HOLD`、`GRAY/VPS: HOLD`。
