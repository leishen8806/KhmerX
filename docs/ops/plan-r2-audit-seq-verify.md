# Plan R-2：审计 seq 只读校验

`audit-seq-verify.mjs` 只打开本地 SQLite 文件并输出校验报告，不执行回填、迁移或其他写操作。它不能连接 Wrangler、远程 D1、生产数据库或服务器。

## 使用

```sh
TMPDIR=/private/tmp node scripts/audit-seq-verify.mjs --db /path/to/local.sqlite
```

默认不判断回填顺序，报告中的 `orderCheck` 为 `skipped`。迁移完成后先执行一次
`SELECT MAX(seq) FROM team_audit`，把结果记录为迁移完成时的最大 seq，再把它传给工具：

```sh
TMPDIR=/private/tmp node scripts/audit-seq-verify.mjs \
  --db /path/to/local.sqlite --backfill-max-seq 1234
```

此时工具只对 `seq <= 1234` 的迁移回填行检查 `(created_at,id)` 顺序；迁移后新增的、可能带有较早 `created_at` 的行不会被误判。

报告包含：

- `seqNull`：`team_audit.seq` 为 NULL 的总数和最多前 50 个 ID；
- `seqUnique`：非 NULL seq 是否唯一；
- `orderCheck`：传入 `--backfill-max-seq` 时，回填行按 seq 的顺序是否与 `(created_at,id)` 顺序一致；
- `v2Verify`：迁移前 v2 清单的可用性、检查数量和摘要对比结果。若没有 `PAYEASE_AUTH_SECRET`（至少 32 字节），摘要对比会报告 `secretAvailable:false`，不会猜测结果。

发现 NULL seq、重复 seq 或顺序检查失败时退出码为 `1`；全部检查通过或顺序检查被明确跳过时退出码为 `0`。

只读工具会拒绝 `--remote` 和 `--production` 参数。请先复制数据库，再把报告交给评审者；任何回填或迁移必须由单独获批的操作流程完成。
