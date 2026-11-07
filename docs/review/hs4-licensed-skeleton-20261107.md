# HS-4 持牌机构新仓库本地骨架报告

日期：2026-11-07

## 基线与边界

- `git fetch origin` 已执行；基线为 `origin/main` `77779ae49aae7e765acb2a10b60e73708a6643f3`。
- KhmerX 主工作区的既有未跟踪文件未修改。
- 新仓库仅在本机初始化并提交，未设置 remote、未创建 GitHub 仓库、未推送。
- 未访问服务器、域名或生产数据；未联网安装依赖。

## 新仓库

路径：`E:\KhmerX\KhmerX-Licensed`

本地默认分支：`main`

本地提交：`cc8d5e4 chore: initialize licensed institution skeleton`

`node_modules` 是指向 `E:\KhmerX\wt-GL-1\node_modules` 的本地 junction，已由 `.gitignore` 排除，不在 Git 中。

## 依赖核对

新仓库只声明了骨架测试所需的 KhmerX 已有开发包；运行时服务只用 Node 内置模块，因此没有声明 `miniflare` 等未使用依赖。版本与 KhmerX `package-lock.json` 对照如下：

| 包 | 新仓库声明 | KhmerX 锁定版本 | 结果 |
|---|---:|---:|---|
| `typescript` | `5.9.3` | `5.9.3` | 一致 |
| `@types/node` | `22.19.19` | `22.19.19` | 一致 |

因此按卡片规则复用了已安装依赖；没有新增包、升级包或联网安装。

## 目录与复制清单

复制自 KhmerX `77779ae`：

- `lib/http/api-error.ts`
- `lib/http/index.ts`
- `lib/http/request-id.ts`
- `lib/http/route.ts`
- `lib/request-security.ts`
- `lib/runtime-guards.ts`

复制自 HS-3 已批准提交 `cd66a5b`：

- `lib/institution-callback.ts`（签名/验签实现）
- `tests/fixtures/arc04-v0/signing.json`
- `tests/fixtures/arc04-v0/events/*.json`（8 个合法样例、3 个非法样例）
- `scripts/mock-institution/server.mjs` 与 README
- `tests/arc04-vectors.test.mjs`

注意：`origin/main` `77779ae` 中不存在 `lib/team/audit-writer.ts`，因此没有可复制的源文件。新仓库中的 `lib/team/audit-writer.ts` 是为本地骨架新写的最小实现，并在文件头注明该事实；未修改 KhmerX。

## 新写内容

- `drizzle/0001_licensed_core.sql`：`applications`、`inbound_events`、`nonces`、`audit` 四张表。
- `lib/licensed-events.mjs`：本地接收逻辑，支持 `X-Partner-Id`，兼容 `X-Institution-Id`，验签、nonce 防重放、幂等与应用写入。
- `server.mjs`：`POST /v0/events` 与 `GET /healthz`，只绑定 `127.0.0.1`。
- `tests/events-route.test.mjs`：合法/非法事件、幂等、重放及头部冲突测试。
- `tests/repo-boundary.test.mjs`：确认仓库不含 `app/h5`、`app/mini`、`lib/kyc`、`mobile`。

没有复制客户端、KYC、运营、贷后、通知代码，也没有复制数据库文件或真实密钥。

## 实际测试输出

在 `E:\KhmerX\KhmerX-Licensed` 执行：

```text
npm test
✔ ARC-04 signing vectors match the shared implementation
✔ ARC-04 event fixtures contain eight valid and three invalid samples
✔ local mock institution verifies, deduplicates and rejects replayed requests
✔ licensed receiver accepts valid event samples and rejects invalid samples
✔ licensed receiver is idempotent and rejects replay and mismatched headers
✔ licensed repository contains no client, KYC or mobile trees
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

## 待办与限制

- 尚未实现机构审批界面、KYC 文件拉取/哈希校验、回调发送端、重试/死信、员工账号表及正式数据库适配；这些属于后续批次。
- 本卡未创建远程仓库，因此没有推送 `KhmerX-Licensed`。
- 由于 KhmerX 当前 main 缺少 `lib/team/audit-writer.ts`，审计写入器需要在技术负责人确认来源后再替换为正式实现。
