# 本地全面验收 harness

这是本地 gray standalone 的可重复验收入口。它只使用虚构公司、虚构员工、虚构机构、随机密钥和本地 D1/R2 持久化目录，不连接 VPS、正式环境、Telegram 或短信服务。

## 前置条件

- Node.js `>=22.13`。
- 已安装依赖（`npm ci`）。
- 当前工作树可运行 `npm run build:separated`。
- Playwright 使用 `/private/tmp/pw-run` 中的本地安装；真实浏览器验收脚本不得改用线上地址。

## 运行

终端一启动 standalone：

```sh
TMPDIR=/private/tmp node scripts/local-acceptance/start.mjs
```

它会在 `/private/tmp/khmerx-local-acceptance/{app,data}` 准备分离构建产物和 `config.json`，生成 gray 配置（`PAYEASE_ENV=gray`、`KHMERX_TEST_MODE=false`、`PAYEASE_DEMO_OTP_ALLOWED=true`、单一 `KhmerX Gray` 公司），然后监听 `127.0.0.1:4300`。随机访问凭据和密钥仅写到 `/private/tmp/khmerx-local-acceptance/data/`，不会进入仓库。

终端二写入本地验收员工和测试机构数据：

```sh
node scripts/local-acceptance/seed.mjs
```

员工密码仅输出到 `/private/tmp/khmerx-local-acceptance/data/local-acceptance-staff.json`。角色包括 `admin`、`kyc`、`checker`、`finance`、`finance_checker`；机构回调签名密钥由启动脚本生成并存入本地 secrets 文件。

终端三运行当前自动化探针：

```sh
node scripts/local-acceptance/run.mjs
```

报告写入 `/private/tmp/khmerx-local-acceptance/reports/local-acceptance.json`。每项只能通过真实 HTTP/浏览器请求或明确的只读命令证据标记为 PASS；未完成的浏览器流程、后台角色矩阵、机构链路或审计数据库校验必须保持 FAIL/BLOCKED，不能用直接写数据库冒充通过。

## 验收边界

- H5/Mini/App/后台均必须指向本地 `127.0.0.1:4300`；验证码测试值为 `123456`，不得连接短信。
- Telegram Mini App 使用本地随机 bot token 和按 Telegram 规则签名的 synthetic initData；结果必须标注 synthetic，不能当作真实 Telegram 认证。
- App 端仅允许 API/HTTP harness；Flutter UI 不在此脚本中运行。
- 渠道配置相关 PR 未合并时，对应项标记“待合并后复跑”。
- 正式域名和 VPS 灰度环境不检查、不写入、不准备部署操作；需负责人另行评估后才可进行任何灰度部署。
- `audit-seq-verify` 是只读校验，目标报告必须明确记录 `seqNull=0`；失败或无法定位本地 SQLite 时必须报告 BLOCKED/FAIL。

## 清理与证据

停止终端一的进程即可停止服务。验收报告、截图和 SHA256 应放在 `/private/tmp/khmerx-local-acceptance/reports/`，不要复制 secrets。报告中列出测试号码、公司 ID、员工角色和数据库文件路径等合成数据，但不列出密码、Token 或密钥。
