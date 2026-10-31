# 方案 R-0：v3 审计清单契约与 v2 固定夹具

## 决策

- v3 采用方案 A：显式 `seq INTEGER` 作为 manifest 边界。`seq` 由数据库在写入事务中分配并单调递增；`created_at` 仅作展示元数据，不参与边界判断。
- v2 保持现有 `v2:HMAC(canonical rows)`、`created_at/id` 有界验证及字段格式不变。旧 manifest 不重写、不静默回标 v3；兼容路径继续走现有 v2 verifier。
- v3 新字段为 `version=3`、`last_seq` 与按序列边界计算的 digest；后续迁移与所有写入路径另行评审，不在 R-0 实现。
- canonical bytes 仍为每行 `JSON.stringify([id, actor, action, detail, created_at])`，按既有排序规则逐行以 `\n` 连接，UTF-8 编码后 HMAC。v3 仅替换边界来源，不改变既有行规范化。
- `unsupported_version` 与 `needs_manual_review` 都是失败/人工处置状态，绝不能映射为 `match=true` 或“通过”。

R-0 只冻结契约与测试样本；不修改 `lib/**`，不碰 `drizzle/**`、`deploy/**`，不做迁移或历史数据回填。
