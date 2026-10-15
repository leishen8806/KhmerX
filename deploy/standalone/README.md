# PayEase 独立测试部署

仅供测试：使用 Miniflare/workerd 兼容原 D1/R2 绑定，持久化到 /opt/payease/data。不是正式资金生产架构。
Docker 服务在 127.0.0.1:4300，经 Caddy 暴露 IP 入口。已有业务不改动。
站点访问 Basic 口令单独保存，网关清除外来身份头并签发独立浏览器身份；员工仍须公司代码+邮箱+密码登录。IP HTTP 仅虚构资料，后续配置域名 HTTPS。
数据库从空库迁移并创建两家公司及 14 个测试岗位账号；未迁移 Sites 客户资料、文件或 Telegram 密钥。
每日贷后检查由 /etc/cron.d/payease-postloan 在 01:00 UTC 执行。
停止：cd /opt/payease/app && docker compose stop
日志：docker compose logs --tail=100
备份：先 docker compose stop，再备份 /opt/payease/data，之后 docker compose start。config.json 加密密钥与数据必须一同备份。

KYC 文件上传会先经过内部 ClamAV 扫描网关，扫描服务不可用时默认拒绝上传（fail closed）。ClamAV 特征库保存在 `/opt/payease/clamav`，仅通过 Docker 内部网络访问，不对公网暴露。健康检查：`docker compose exec scanner python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/health').read())"`。
部署包不应包含 config.json、账号明文或测试脚本。配置置于镜像外，仅 root 可读。

## 灰度 Caddy

灰度域名模板在 `Caddyfile.gray`：`testpayease.khmerx.org`、`testadmin.khmerx.org`、`testapi.khmerx.org` 反代到本机网关 `127.0.0.1:4300`，官网 `test.khmerx.org` 从 `/srv` 提供静态文件。Caddy 在本机前置并写入 `X-Real-IP`；`trusted_proxies` 只列 Cloudflare 官方网段，`client_ip_headers` 使用 `CF-Connecting-IP`。

灰度初始阶段使用 Cloudflare SSL/TLS **Full**，各 HTTPS 站点由模板的 `tls internal` 提供源站证书。确认 DNS、Caddy 和网关正常后，换成 Cloudflare Origin CA 证书，并将站点改为 `tls <cert> <key>`；证书切换完成后再把 Cloudflare SSL/TLS 改为 **Full (strict)**。没有这份受信代理配置时，网关不会信任 `X-Real-IP`；不要单独复制 `header_up X-Real-IP` 到其他 Caddy 配置。

### 如何验证

```sh
caddy validate --config /etc/caddy/Caddyfile.gray
curl -k --resolve testapi.khmerx.org:443:127.0.0.1 https://testapi.khmerx.org/healthz
curl -k --resolve testpayease.khmerx.org:443:127.0.0.1 https://testpayease.khmerx.org/healthz
curl -k --resolve testadmin.khmerx.org:443:127.0.0.1 https://testadmin.khmerx.org/
```
