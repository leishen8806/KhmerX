# L2 / 闸门 A：灰度压测窗口清单（技术负责人与操作员用）

依据：`docs/tasks/codex-prompts/L1-G-gray-fixture.md`（§7 流程、§9 前置条件）、`master-plan-20261015.md` §12.4。
闸门 A（第 2 天，2026-10-17，周六）：**压测证明过渡形态可行**。周六 17:45 灰度自动关闭（D-08），所以窗口必须在 17:45 之前结束；周六不扩量。

## 1. 开窗前必须全部具备（缺一则不开窗）

| # | 条件 | 谁 | 状态 |
|---|---|---|---|
| 1 | 灰度源站 `/opt/payease/data/config.json` 已填真实凭据（Telegram Gateway 令牌、bot-1 令牌、管理员密码哈希、各 32 字节密钥），`check-config.mjs` 输出 `GRAY CONFIG CHECK: PASS` | 操作员 | ☐ |
| 2 | `bootstrap-gray.sh` 已执行（属主/权限：data 1000:1000 700，config 0:1000 640，scanner-secrets 1000:65534 2750） | 操作员 | ☐ |
| 3 | 应用与扫描器已 `up -d --build`，`/healthz`、`/readyz` 正常；`curl -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/api/h5/auth` 返回 200、mode telegram | 操作员 | ☐ |
| 4 | DNS：`testapi/testpayease/testadmin/test.khmerx.org` 指向 159.223.77.134 且 Cloudflare 代理；SSL 模式「完整」；`testapi.khmerx.org` 不再 521 | 技术负责人 | ☐ |
| 5 | 压测机 165.22.108.5：已装 k6 与本仓库脚本；`LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org` | 操作员 | ☐ |
| 6 | `/opt/payease/loadtest`、`/opt/payease/loadtest/manifests` 已按 1000:1000、700 建好 | 操作员 | ☐ |
| 7 | 技术负责人书面批准本窗口（见 §2） | 技术负责人 | ☐ |

## 2. 窗口批准单（复制到 PR/聊天里，由技术负责人填写后回复"批准"）

```
窗口：2026-__-__ __:__ – __:__（须早于周六 17:45）
CUSTOMER_ROWS：off / on（本窗口只测一种；切换另开窗口，需改 config 并重建容器）
规模：main = ___ 客户（建议先 100）
PAYEASE_GATEWAY_RATE_SCALE：___（建议 30，仅灰度；压测结束后恢复 1）
PAYEASE_LIMIT_SCALE：___（默认 1，不改）
停机：fixture 写入与清理各一次停机，每次约 __ 分钟（可接受 / 不可接受）
回退：按 L1-G 契约 §7 的 d1-before 备份还原，由技术负责人批准执行
```

## 3. 闸门 A 的最小运行方案（建议）

1. **先 `off` 再 `on`**（各一个窗口；两种模式各用全新的五个数据集）：`main=100`。目的是回答"现有 Miniflare 单节点 + 按行存储是否可行"，对应本地已有的对照结果（本地 50 客户：`off` 7 个 `create` 在 15 秒超时、p95 约 15 秒；`on` p95 约 2 秒、0 超时）。
2. 每个窗口：A（停机写 fixture）→ B（`smoke` 3 客户 → `main`；同时源站 `sample-resources.sh`）→ C（停机 `db-check` + `cleanup`）。
3. 提交：报告 JSON、资源 CSV、`db-check` 与 `cleanup-report`（均不含 token）到 `scripts/loadtest/reports/`，把分支名发给 Claude。

## 4. 建议的通过判据（**待技术负责人确认；以下是 Claude 的默认建议，不是已冻结的指标**）

- 各结果类别之和 = 计划客户数；**最终状态不一致的客户 = 0**；`duplicate_loans`、`wrong_owner_loan` = 0。
- 首次写请求冲突率 < 1%（L1 契约 §4.2 口径）；无 `WORKSPACE_PAYLOAD_LIMIT` 以外的 5xx 成批出现。
- 观测并发 ≥ 目标并发的 80%，否则结果标"观测并发不足"，不作闸门依据。
- `db-check` 与模式一致（`on`：分片与索引各 N 行、旧 JSON 无 fixture 贷款；`off` 反之）。
- 资源：采样期间应用容器内存未触顶（1.5 GiB 上限）、无 OOM 重启。
- 结论只对"灰度 2 vCPU/4GB 单节点、本规模"成立；**不得写成"600 并发已验证"**（master-plan §12.3a：600 要在临时放大的同构环境里做）。

## 5. 中止条件（任何一条立即停止并汇报）

- 任一拒绝类错误：fixture 报"Fixture rejected"、`/readyz` 起不来、`db-check` 出现 `foreignCustomers=true`。
- 压测期间出现 OOM 重启、磁盘 > 85%、`429` 占请求 > 0.5%（说明限流倍率没生效，结果作废）。
- 窗口临近周六 17:45 而 cleanup 尚未完成：**先完成 cleanup 与启动应用，不要留着停机状态**；灰度自动关闭只关网关，不会替你启动被停掉的容器。
- 发现 manifest 或 token 出现在 Git、日志、聊天或下载目录：立即 `fixture cleanup`（撤销会话），并通知 Claude。

## 6. 窗口结束后的收尾

- [ ] `PAYEASE_GATEWAY_RATE_SCALE` 恢复为 1（改 config 并重建容器，或确认本窗口未改）。
- [ ] 源站与压测机上的 manifest 已 `shred -u`；备份 tgz 已按需删除。
- [ ] 灰度应用 `/readyz` 正常，`gray-hours.cron` 仍在。
- [ ] 报告与资源 CSV 已提交；Claude 评审后给出闸门 A 结论。
