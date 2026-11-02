# Plan R 上线手册（R-7）

本文是上线前审批和执行清单。本文只描述步骤；本卡不执行线上迁移、备份、部署或任何线上 D1 操作。凡标记“负责人批准”之处，必须由技术负责人明确批准后执行。

## 1. 本次变更范围

Plan R 包含以下相互依赖的变更：

- `drizzle/0062` 为 `team_audit` 增加 `seq`，为历史行按 `(created_at, id)` 回填序号，建立 `seq IS NOT NULL` 的部分唯一索引，并重建完全禁止 UPDATE 的 append-only 触发器；同时为 manifest 增加 v3 所需的版本、边界序号和索引字段。
- 所有 `team_audit` writer 写入 `seq`，新行从当前最大序号继续递增。
- v3 manifest 按 seq 生成和校验；若存在 NULL seq，校验返回 `needsManualReview`，不把结果当作匹配。
- `scripts/audit-seq-verify.mjs` 是只读校验工具，只能打开本地 SQLite/D1 副本；`--backfill-max-seq N` 只校验迁移回填的那批行。

## 2. 上线前准备

### 2.1 备份线上 D1（负责人批准）

先确认 Cloudflare 账户、项目配置和数据库名称。由负责人执行，或在负责人明确批准后执行以下示例命令；不要把占位符原样执行：

```sh
mkdir -p backups/plan-r
npx wrangler d1 export <DB_NAME> --remote \
  --output "backups/plan-r/team-audit-before-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

备份文件应由负责人按现有密钥和存储策略保管，并记录数据库名称、导出时间、命令版本和文件校验值。`--remote` 仅是本手册供负责人审批的线上备份示例；本 PR、验证过程和本卡均不执行它。

### 2.2 在副本上演练 0062（负责人批准副本操作）

在备份副本或本地 D1 副本上，按仓库迁移顺序执行 0062；不要连接线上数据库。演练应确认：

1. 迁移前存在的审计行全部获得非 NULL、唯一的 seq。
2. seq 顺序与 `(created_at, id)` 一致，包括同毫秒记录和“created_at 较早但较晚写入”的样本。
3. UPDATE、DELETE 被 append-only 触发器拒绝。
4. 迁移后通过新 writer 写入的行继续使用更大的 seq。

迁移完成后，在副本上执行：

```sql
SELECT MAX(seq) FROM team_audit;
```

把结果记录为 `N`（迁移完成时的最大 seq），不要在后续运行中凭估计填写。然后只对副本运行：

```sh
node scripts/audit-seq-verify.mjs \
  --db <LOCAL_D1_OR_BACKUP_SQLITE> \
  --backfill-max-seq <N>
```

必须看到 `seqNull.count = 0`、`seqUnique = true`、`orderCheck = "passed"`，且进程退出码为 0。工具不写数据库；不传 N 时顺序检查会明确显示 `skipped`，不能作为迁移验收证据。

## 3. 推荐上线顺序

推荐顺序是：

1. 先准备并验证新代码和迁移，安排短维护窗口；
2. 暂停会写入 `team_audit` 的应用流量或将其置为维护状态；
3. 在目标数据库执行 0062；
4. 立即部署包含全部 seq writer 和 v3 manifest 的新代码；
5. 完成上线后只读验证，再恢复业务流量。

理由：0062 回填后新 schema 允许旧 INSERT 省略 seq，但旧代码会写出 NULL seq；v3 manifest 发现这类行会进入 `needsManualReview`。因此必须把“迁移→新代码上线”的窗口缩到最小，并在窗口内阻止旧 writer 继续产生日志。

不推荐先部署代码再迁移：旧 schema 没有 seq 列，依赖 seq 的新 writer/manifest 可能在迁移完成前失败或无法提供完整 v3 语义。若由于发布平台限制只能先部署，必须先确认新代码对旧 schema 的兼容策略并由负责人批准；在 0062 完成前不得开启 v3 验收。

窗口风险与缩短措施：

- 迁移后旧实例仍在运行会产生 NULL seq，导致 v3 校验进入人工复核；用短维护窗口、单一发布批次、先排空旧实例和上线后立即查询 NULL 数缩短风险。
- 多实例同时写入可能让旧/新 writer 混用；在迁移期间暂停写入，确认旧实例退出，再运行迁移和新代码部署。
- 迁移失败时不能继续部署新代码；保留备份、记录迁移输出和按第 5 节恢复。

上述暂停流量、执行线上迁移、恢复流量和部署均需要负责人批准。

## 4. 上线后只读验证

负责人批准后，在目标环境使用只读查询或受控的只读运维通道检查：

```sql
SELECT COUNT(*) AS seq_null_count
FROM team_audit
WHERE seq IS NULL;

SELECT COUNT(*) AS total_rows,
       COUNT(seq) AS non_null_seq,
       COUNT(DISTINCT seq) AS distinct_seq,
       MAX(seq) AS max_seq
FROM team_audit;

SELECT seq, id, created_at
FROM team_audit
ORDER BY seq DESC
LIMIT 20;
```

验收条件是 NULL 数为 0、`non_null_seq = distinct_seq = total_rows`，并记录 `MAX(seq)`。随后在本地备份副本保存该 N，用 `audit-seq-verify.mjs --backfill-max-seq N` 复核回填顺序；线上工具运行仍须使用负责人批准的只读方式，不能把线上 D1 当作本地 SQLite 路径直接传给脚本。

最后通过已部署的新代码，在受控测试租户创建一份 v3 manifest 并执行校验：应为 `version=3`、`match=true`、`needsManualReview=false`。创建测试清单和业务写入需要负责人批准；校验结果、manifest ID、时间和版本写入发布记录，避免在报告中记录敏感详情。

## 5. 回滚与恢复

0062 没有 down migration，不能用“回滚迁移”撤销列、索引或触发器。推荐恢复路径是：

1. 若新代码有问题，先按负责人批准回滚应用代码并停止新写入；保留 `seq` 列和索引，不尝试删除它们。
2. 代码回滚后，旧代码通常仍可读取已有表；旧 INSERT 若省略 seq，在当前 schema 下会写入 NULL（该列可 NULL），而 `team_audit_no_update` 只拦截 UPDATE，不拦截 INSERT。因此触发器不会阻止旧代码写入，但这些新行会使 v3 manifest 进入 `needsManualReview`，这是回滚期间必须接受并监控的风险。
3. 不要对已有审计行执行 UPDATE/DELETE 修复；当前触发器会拒绝，审计表应保持 append-only。保存回滚期间产生的 NULL 行 ID，待新代码恢复后按审批流程处理。
4. 若数据库状态需要恢复到备份，先停止相关写入，确认备份时间点、数据丢失范围和负责人批准，再执行受控恢复；恢复不是本 PR 或本手册自动执行的动作。
5. 恢复新代码后，先在副本运行 verifier 并重新记录迁移完成时的 N，再进行只读验收。任何 NULL、重复或顺序错误都应阻止 v3 验收并转人工复核。

回滚代码、停止/恢复流量、数据库恢复和任何线上写操作均需要负责人批准。

## 6. 审批记录

上线申请至少应附：备份文件校验值、演练命令及结果、迁移完成时的 N、维护窗口、部署版本、上线后只读查询结果、v3 manifest 校验结果，以及回滚负责人。没有这些证据，不应把上线标记为完成。
