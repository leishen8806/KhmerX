# PayEase 线上上线验证证据

验证时间：2026-10-06 02:58 UTC（Asia/Phnom_Penh 09:58）  
环境：`payease.khmerx.org`，公司测试租户  
部署镜像：`app-payease:latest`（最新镜像摘要 `sha256:2f48cc1f0b38320738879f23c97dddd0bce0121bc67288fec869fb4253eb3a59`）  
代码基线：`204a19ba500ee341a0ff3feea0a083f711c1494c`；部署包包含工作区未提交变更，工作区差异指纹：`fab7c7e8dc2e8e5fa3e76ba5cc33dcbfd91a41c4c60f74ebc86f0040ae17ebf1`

## 服务部署

- `app-payease-1`：运行中。
- `app-scanner-1`：运行中且 healthy。
- `app-clamav-1`：运行中且 healthy。
- `https://payease.khmerx.org/api/h5/auth`：HTTP 200。
- `https://admin.khmerx.org/team/login`：HTTP 200。
- `https://khmerx.org/`：HTTP 200。
- OA 与其他 Docker 服务未重启、未改动。

## 线上 API 闭环

本次使用合成 Telegram 身份（不含真实姓名、证件、手机号或银行资料）生成官方格式签名数据，验证生产 Bot 凭据、登录会话、KYC 数据库和私有对象存储。

| 步骤 | 结果 | 证据 |
|---|---|---|
| Telegram 签名登录 | 通过，HTTP 200 | 会话创建成功，策略返回 Telegram 登录无需手机号验证 |
| KYC 初次读取 | 通过，HTTP 200 | case `cd4150ca19ea3ab69a20e1391a29fdbb7fb48dbf1f2f0db0037f38e1ab4d9bd7`，revision 0 |
| KYC 写入 | 通过，HTTP 200 | revision 0 → 1，状态保持 `draft` |
| 文件上传 | 通过，HTTP 200 | `idFront` 文件 `faaa0ab6-da4a-4af1-9c7a-3ac946518c21`，SHA-256 `c04d024733231da0e2d725d30c9fb10aa39a4afcdad03b1625443f2eb4305d10` |
| 对象读取 | 通过，HTTP 200 | 私有文件 API 回读 1 字节 PNG，响应受 `no-store`、`nosniff` 和 sandbox 保护 |
| KYC 回读 | 通过，HTTP 200 | case ID 相同、revision 1、`idFront` 文件引用存在 |
| 会话清理 | 通过，HTTP 200 | `/api/h5/auth/logout` 后再次读取认证状态为 `authenticated:false` |

## 数据库与审计留存

- `kyc_cases`：case 存在，revision 1，状态 `draft`。
- `kyc_files`：文件行存在，slot `idFront`，`ready=1`。
- `kyc_history`：审计记录 `acebaaf7-24c8-4b1f-9184-80e4c52f83f1`，action `save`，revision 1。
- 文件对象和上述数据库/审计记录均未删除，作为上线证据保留。
- 未调用生产破坏性清理；当前系统的 customer cleanup 仅允许 demo 模式，且发现文件或审计记录时会拒绝清理，这是上线保护行为。

## Telegram 桌面端复验

- 已从 Telegram Desktop 的 KhmerXBot 打开 `payease.khmerx.org/h5`。
- URL 中带有 Telegram `tgWebAppData`，重新加载后自动登录成功，页面显示已登录首页及 KYC 草稿入口。
- 进入 KYC 后成功读取现有草稿，个人信息页面与线上保存数据一致。
- 在未上传身份证正面的情况下点击“下一步”，页面正确阻止跳转并提示“请先完成：身份证正面”。
- 发现并修复了桌面端脚本加载时序问题：前端现在同时读取 `Telegram.WebApp.initData` 和 URL 片段中的 `tgWebAppData`，避免误显示“当前未从 Telegram 打开”。修复已重新构建并部署。

## Telegram Desktop 合成文件闭环复验（2026-10-06 03:11–03:16 UTC）

本轮使用当前 Telegram Desktop 登录会话，仅上传本地生成的 1×1 PNG 合成测试文件，不使用真实证件或其他真实 KYC 资料。

| 步骤 | 结果 | 证据 |
|---|---|---|
| Mini App 自动登录 | 通过 | Telegram Desktop 打开 `payease.khmerx.org/h5` 后自动进入已登录首页，无客户端登录错误提示 |
| KYC 草稿读取 | 通过 | 进入 KYC 后读取现有草稿，个人信息和草稿状态正常显示 |
| 合成文件上传 | 通过 | 身份证正面上传控件接收 `image/png`，页面显示文件已上传、0.1 KB，并可查看已上传材料 |
| 文件对象回读 | 通过 | 服务器 R2 对象存在，类型为 PNG，大小 96 bytes；数据库 `kyc_files.ready=1` |
| 前端校验 | 通过 | 移除身份证正面后点击下一步，正确提示“请先完成：身份证正面”，未绕过必填校验 |
| 草稿引用清理 | 通过 | 从当前步骤移除后，在个人信息步骤保存，再离开并重新进入 KYC；身份证正面回读为“尚未上传”，后续步骤保持禁用 |
| 审计留存 | 通过 | 线上 `kyc_history` 新增保存记录；合成文件对象和数据库文件行按本次上线证据保留，未删除真实用户资料 |

本轮未提交 KYC 审核、未发起贷款、未改变真实身份字段；仅验证 Telegram 登录、KYC 草稿读写、合成文件上传/回读、必填校验、引用清理及持久化行为。
