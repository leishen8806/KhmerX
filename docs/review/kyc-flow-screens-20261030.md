# KYC Worker 本地流程截图（2026-10-30，round2）

本轮在 `/private/tmp/khmerx-kyc-shots` 使用无扩展的 Playwright headless Chromium，未连接个人 Chrome。前端使用 `PAYEASE_AUTH_MODE=demo`、`KHMERX_TEST_MODE=true`，仅本地环境变量；未提交密钥或本地 D1/R2 状态。

## 已覆盖截图

| 文件 | 视口/语言 | 页面与状态 |
|---|---|---|
| `01-home-390.png` | 390×812 / English | 登录后的 Home，显示 Complete identity information |
| `02-kyc-front-390.png` | 390×812 / English | KYC 首个 Personal identity 分步表单，显示必填字段与 Next |
| `03-kyc-front-375-zh.png` | 375×812 / 中文 | KYC 概览，6/6 完成，最近审核意见为“待补件” |
| `04-kyc-front-375-km.png` | 375×812 / ខ្មែរ | KYC 概览，6/6 完成，状态为 KYC approved |

## 流程证据

本地 worker smoke 流程以虚构手机号完成：发送验证码、验证、读取草稿、通过 `setInputFiles` 对应的 PNG buffer 上传 `idFront`、`idBack`、`selfie`、`incomeProof`、保存草稿、确认 stale revision 返回 409、提交审核并确认提交后锁定返回 409。随后本地 reviewer harness 将同一 case 依次置为 `needs_info`（原因：请补充清晰材料后重新提交）和 `approved`；浏览器重新登录同一虚构账号后分别捕获了中文“待补件”和高棉语“已批准”页面。补件状态页面显示最近审核意见与 6/6 完成度；批准页面显示 `KYC approved` 和“可以开始贷款申请”。

客户补件/重新提交由同一 worker 的 draft/submit API 及 revision 保护验证；reviewer harness 的状态变更只写本地 D1，不触碰线上环境。UI 的首个分步表单已通过 Playwright 的 `setInputFiles` 机制执行上传尝试；材料上传的完整成功证据由 worker smoke 的四个 slot 结果提供。

## 未覆盖与边界

未在截图中展示后台 `/kyc/review` 审核工作台本身的逐项勾选界面；本轮要求的四张固定交付图用于客户 Home/KYC 与补件/批准状态，后台逐项审核动作由本地 reviewer harness 记录。没有伪造线上审核结果，也没有修改产品代码。

## 对照差异

与 `docs/kyc-ux-review-20261023.md` 对照，进度条当前实际显示绿色 + 灰色，而不是设计稿要求的 `#1677FF` 单色蓝；本轮仅记录该可见差异，未改产品样式。窄屏截图完整保留了 375px 可见视口，中文与高棉语文本均与文件名一致。

## 门禁

- `git diff --check`：通过。
- 截图全部为本地 demo worker，未执行部署、迁移、服务器、DNS 或线上写操作。
