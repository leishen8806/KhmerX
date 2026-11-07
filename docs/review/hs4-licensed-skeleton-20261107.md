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

本地提交：`66978a33863b093b5188c9c6c8a97b2e2f5f491c feat: complete licensed institution skeleton`

`node_modules` 是指向 `E:\KhmerX\wt-GL-1\node_modules` 的本地 junction，已由 `.gitignore` 排除，不在 Git 中。

## 依赖核对

新仓库采用 Vinext + Workers/D1 + Miniflare 本地运行结构，声明的包均取自 KhmerX 锁定版本；依赖通过既有 `wt-GL-1/node_modules` junction 复用，未联网执行安装。

| 包 | 新仓库声明 | KhmerX 锁定版本 | 结果 |
|---|---:|---:|---|
| `typescript` | `5.9.3` | `5.9.3` | 一致 |
| `@types/node` | `22.19.19` | `22.19.19` | 一致 |
| `@cloudflare/vite-plugin` | `1.37.1` | `1.37.1` | 一致 |
| `@cloudflare/workers-types` | `4.20260515.1` | `4.20260515.1` | 一致 |
| `miniflare` | `4.20260730.0` | `4.20260730.0` | 一致 |
| `vinext` | `1.0.0-beta.5` | `1.0.0-beta.5` | 一致 |
| `vite` | `8.0.13` | `8.0.13` | 一致 |

因此按卡片规则复用了已安装依赖；没有新增包、升级包或联网安装。

## 目录与复制清单

复制自 KhmerX `77779ae`：

- `lib/http/api-error.ts`
- `lib/http/index.ts`
- `lib/http/request-id.ts`
- `lib/http/route.ts`
- `lib/request-security.ts`
- `lib/runtime-guards.ts`
- `lib/team/audit-writer.ts`（按该提交内容复制，文件头注明来源）

复制自 HS-3 已批准提交 `cd66a5b`：

- `lib/institution-callback.ts`（签名/验签实现）
- `tests/fixtures/arc04-v0/signing.json`
- `tests/fixtures/arc04-v0/events/*.json`（8 个合法样例、3 个非法样例）
- `tests/arc04-vectors.test.mjs`

## 新写内容

- `drizzle/0001_licensed_core.sql`：`applications`、`inbound_events`、`nonces`、`team_audit` 四张表。
- `lib/licensed-events.ts`：D1 接收逻辑；仅接受 `application.submitted`、`agreement.signed`、`application.withdrawn`，持久化 nonce、幂等记录、申请状态和审计记录。
- `server.mjs`、`scripts/d1-worker.mjs`、`vite.config.ts`：Miniflare/D1 本地服务和 Vinext/Workers 构建配置，监听仅绑定 `127.0.0.1`。
- `tests/events-route.test.mjs`：合法/非法事件、未知申请 409、头部冲突、重启后幂等及 nonce 重放测试。
- `tests/repo-boundary.test.mjs`：禁止客户端、KYC、机构后台、贷后、通知、Mini 组件和 mobile 树。
- 已删除 `scripts/mock-institution/`；保留 `tests/fixtures/arc04-v0/`。

没有复制客户端、KYC、运营、贷后、通知代码，也没有复制数据库文件或真实密钥。

## 实际测试输出

在 `E:\KhmerX\KhmerX-Licensed` 执行：

```text
npm run typecheck
tsc --noEmit --pretty false

npm run lint
eslint . --ignore-pattern dist --ignore-pattern .next

npm run build
vinext build (Vite 8.0.13)
Route (app): /, /api/v0/events, /healthz
Build complete.
```

```text
npm test
✔ ARC-04 signing vectors match the shared implementation
✔ ARC-04 event fixtures contain eight valid and three invalid samples
✔ licensed D1 receiver accepts the three outbound event samples and rejects others
✔ signed and withdrawn unknown applications return 409
✔ D1 idempotency and nonce replay survive a Miniflare restart
✔ licensed repository contains no client, KYC or mobile trees
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

## 结果与限制

- 尚未实现机构审批界面、KYC 文件拉取/哈希校验、回调发送端、重试/死信、员工账号表及正式数据库适配；这些属于后续批次。
- 本卡未创建远程仓库，因此没有推送 `KhmerX-Licensed`。
- 未运行 `npm ci`；没有新增依赖，使用已安装 junction。正式远端仓库创建、部署、真实机构网络验证均未执行。
- 本地 package-lock 已记录声明版本，但本次未做联网锁文件重建；后续若要求独立 `npm ci`，应在隔离环境中单独核对锁文件闭包。

## HS-4 修改 2（2026-11-07）

本地仓库新增提交：`0f1b10295fc8655178539cddda2e3ea6c7e7a89b`。

- 边界扫描改用 `path.relative`；临时 `lib/kyc/x.ts` 违例测试确认会被识别，测试结束后已删除。
- 删除 `lib/h5-auth-core.ts`、`lib/kyc/core.ts`，新增 `lib/http/errors.ts`；`lib/http/route.ts` 仅调整错误类导入并注明来源修改。
- `applications`、`inbound_events`、`nonces` 均按 `partner_id` 隔离；签约/撤回写入 `application_events`，不覆盖 submitted payload。
- 增加跨合作方 409、重复 submitted、signed/withdrawn 状态推进、withdrawn 闭合和并发唯一约束测试。
- `.gitignore` 增加无斜杠的 `node_modules` 规则；本地仓库 `git status` 干净。

本机实际结果：

```text
npm test       10 passed, 0 failed
npm run typecheck 通过
npm run lint      通过，0 errors
npm run build     通过，Vinext 5 个阶段完成
```

机构本地仓库仍未设置远程、未推送；本报告分支按要求同步更新并推送。
