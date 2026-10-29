# 2026-10-27 决定汇总(批次 C)

归档方式:按批次(一个分支、一个提交)。前序:批次 A(各条分别落在 `docs/tasks/approvals/` 下)、批次 B(`status/2026-10-27-decisions-batch-b.md`)。
来源:技术负责人在对话中的回复,由 Claude 记录。本汇总不批准任何窗口,灰度、VPS、L2/Q12 保持 HOLD。

## 决定 1:O5 的 Cloudflare 配置已由负责人确认(D-35)
- **负责人原话:** "O5 Cloudflare 配置已确认"。
- **含义(Claude 的理解):** 四个测试域名(`testapi`、`testpayease`、`testadmin`、`test`)在 Cloudflare 里的 DNS 指向灰度源站、代理已开启、SSL/TLS 为「完整」。这是 O5 里 OPS 无法独立查看、需要负责人本人确认的那部分。若负责人只确认了其中一部分,以负责人的纠正为准。
- **O5 的验收结论更新:** 由"待核对"改为 **PASS**。依据:四个域名解析到 Cloudflare IP、`testapi` 的 healthz 为 200(非 521)、Caddy 加载 `/etc/caddy/Caddyfile.gray`(Codex/OPS 回填),加上负责人的控制台确认。
- **保留项:** Codex 的 DNS 与 `testapi` 请求的具体时间没有记录;Codex 对 khmerx.org 域名的只读访问是否在授权范围内,负责人尚未说明。这些不改变 PASS 的结论,但留在记录里。
- **与重建的关系:** Cloudflare 与 Caddy 不受 H3 重建影响,O5 不需要因重建而重做;重建之后仍建议复核一次 `testapi` 的返回码。

## O1–O6 的整体状态(截至本批次)
| 项 | 状态 | 说明 |
|---|---|---|
| O1 | 暂记 PASS | 取证早于重启,**重建后重做** |
| O2 | **FAIL** | 等 H3 重建窗口(10-28 13:00–17:30) |
| O3 | 待核对 | 变量是"设置后"才读到的;压测机仓库提交号未知 |
| O4 | 待核对 | 目录是否今天创建未知 |
| O5 | **PASS** | 本批次确认 |
| O6 | 暂记 PASS | 取证早于重启,**重建后重做** |
W1 开窗前仍需:O2 通过、O1 与 O6 重做、O3 与 O4 补事实,并由 Claude 给出"可开窗"结论。**现在不可开窗。**

## 仍然开放的事项
| 事项 | 状态 |
|---|---|
| 构建机备案与构建产物(`BUILD_DEPS.json`、`BUILD_INFO.json`、`dist.sha256`) | Claude 尚未收到;H3 窗口要求制品已构建并经 Claude 核对 |
| 对 #128 的两处补充意见是否转达给大旺 | 待负责人回复 |
| 偏差 D-29 的 7 项事实;O3、O4 的待核对事实 | 待 OPS/Codex 补充 |
| Codex 对 khmerx.org 域名的只读访问是否覆盖;Codex SSH 授权的有效期 | 待负责人说明 |
| H5(W1 窗口批准,10-28 18:00)、H6(W2,10-29 18:00) | 取决于 O1–O6 全部通过 |
