# Licensed 灰度机临时扫描服务（Q9）

**165.22.108.5 是持牌机构灰度机，扫描仅为临时用途；持牌机构系统 M4 开始前必须迁走。**

只提供模板。以下步骤由人工在 Licensed 机执行，不在 Codex 会话中远程执行。压测不得同时在该 4GB 机器上运行。

当前两实例部署 **HOLD**：现有 4GB 机器未满足内存前提。按 [ClamAV 官方说明](https://docs.clamav.net/manual/Installing/Docker.html)，单实例最低约 3GiB，病毒库重载会抬高峰值。本模板每实例限制 3GB，并要求 8GB 级主机预检；是否扩容或调整实例数须由技术负责人决定，不自动购买资源，不以 swap 代替 RAM 验收。

## 配置与验证

1. 准备 Docker Compose、已启用且 SSH 已验证可用的 UFW，以及足够磁盘、内存/交换空间。复制整个 `deploy/clamav-gateway` 目录。验证：
   ```bash
   docker compose version
   sudo ufw status numbered
   free -h
   df -h
   bash preflight.sh
   ```
2. 人工创建 `/opt/payease-scanner/scanner.env`，权限 600、root 所有；内容为 `KYC_SCAN_TOKEN=<随机令牌>`、`SCANNER_HOST=<扫描服务 DNS 主机名>`。不得提交、输出或启用 shell tracing。主机名必须直连 Licensed，不经过 Cloudflare 代理。配置 DNS 与该主机名的受信任 TLS 证书（含完整证书链）/私钥，保存为 `/opt/payease-scanner/tls/scanner.crt`、`scanner.key`；私钥权限 600。验证：
   ```bash
   sudo stat -c '%U %a' /opt/payease-scanner/scanner.env /opt/payease-scanner/tls/scanner.key
   sudo openssl x509 -in /opt/payease-scanner/tls/scanner.crt -noout -subject -dates
   ```
3. 进入本目录，校验配置。`config -q` 不输出令牌：
   ```bash
   sudo docker compose --env-file /opt/payease-scanner/scanner.env config -q
   bash firewall.sh --dry-run
   sudo bash firewall.sh --apply
   ```
   9443 仅允许源站 `159.223.77.134`，其他来源拒绝。TLS 入口使用 host 网络，避免 Docker 发布端口绕过 UFW；两个内部网关只发布到回环，clamd 不发布端口。保留现有 SSH 和机构业务规则。
4. 启动并验证（首次下载病毒库可能耗时；不因等待而绕过健康检查）：
   ```bash
   sudo docker compose --env-file /opt/payease-scanner/scanner.env up -d --build
   sudo docker compose --env-file /opt/payease-scanner/scanner.env ps
   sudo bash healthcheck.sh
   ```
   两个 clamd 各 3GB、网关各 128MB、TLS 入口 128MB；均自动重启并限制日志 10MB×3。两个独立病毒库用官方 `FRESHCLAM_CHECKS=1` 每日检查一次，通知各自 clamd；入口在两组既有网关之间轮询。数据库加载/更新峰值必须在目标机器观察验证后再扩量。
5. 病毒库更新验证：
   ```bash
   sudo docker compose --env-file /opt/payease-scanner/scanner.env logs --tail 100 clamd-a clamd-b
   sudo docker compose --env-file /opt/payease-scanner/scanner.env exec clamd-a clamscan --version
   sudo docker compose --env-file /opt/payease-scanner/scanner.env exec clamd-b clamscan --version
   ```
   证书到期前由运维续期并重启 TLS 服务，确认两组扫描器健康。建议每日 cron 执行本目录 `healthcheck.sh`，非零退出交给外部告警系统。

## 源站接入与回退

金融服务公司侧人工设置 `KYC_SCAN_URL=https://<SCANNER_HOST>:9443/scan` 与同一 `KYC_SCAN_TOKEN`，重启对应应用后验证一次虚构小文件上传。不可使用 HTTP 或跳过证书校验。先从源站验证 `/health` 返回 200、无令牌 `/scan` 返回 401；从其他机器验证 9443 无法连接或返回 403。

回退时先把源站扫描配置切回已验证的扫描服务，确认上传仍强制扫描，再在此目录执行 `docker compose ... down`。保留病毒库卷、证书和原防火墙规则供排查，不自动删除数据。
