# PayEase 独立测试部署

仅供测试：使用 Miniflare/workerd 兼容原 D1/R2 绑定，持久化到 /opt/payease/data。不是正式资金生产架构。
Docker 服务在 127.0.0.1:4300，经 Caddy 暴露 IP 入口。已有业务不改动。
站点访问 Basic 口令单独保存，网关清除外来身份头并签发独立浏览器身份；员工仍须公司代码+邮箱+密码登录。IP HTTP 仅虚构资料，后续配置域名 HTTPS。
数据库从空库迁移并创建两家公司及 14 个测试岗位账号；未迁移 Sites 客户资料、文件或 Telegram 密钥。
每日贷后检查由 /etc/cron.d/payease-postloan 在 01:00 UTC 执行。
停止：cd /opt/payease/app && docker compose stop
日志：docker compose logs --tail=100
备份：先 docker compose stop，再备份 /opt/payease/data，之后 docker compose start。config.json 加密密钥与数据必须一同备份。
部署包不应包含 config.json、账号明文或测试脚本。配置置于镜像外，仅 root 可读。
