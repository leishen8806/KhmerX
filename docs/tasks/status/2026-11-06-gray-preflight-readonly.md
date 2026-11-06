操作时间：2026-11-06 17:14（Asia/Phnom_Penh）

本次仅通过一次授权范围内的 SSH 只读预检访问 `159.223.77.134`；未做任何写操作，未停止/重启/重建容器，未安装软件，未执行迁移，也未访问其他主机或域名。

## Q1：迁移 0062

结果：**无法验证**。

只读定位到 `/opt/payease/data` 下的 SQLite 文件：

- `/opt/payease/data/r2/miniflare-R2BucketObject/metadata.sqlite`，4096 bytes
- `/opt/payease/data/d1/miniflare-D1DatabaseObject/e721dd83e8998d1346b9ebe67413cf3d07997596913b3957d87ec30369f6d2a5.sqlite`，839680 bytes
- `/opt/payease/data/d1/miniflare-D1DatabaseObject/metadata.sqlite`，4096 bytes

主机没有 `sqlite3`（只读 `command -v sqlite3` 检查）；因此未打开数据库、未读取表、未执行迁移。不能据此判断是否包含 0062。OPS 若要人工核对，可在批准的只读窗口执行：

```sh
sqlite3 "file:<D1 SQLite 路径>?mode=ro" ".tables"
sqlite3 "file:<D1 SQLite 路径>?mode=ro" "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5;"
```

## Q2：当前制品与 BUILD_INFO

结果：**部分可验证；BUILD_INFO 缺失**。

只读 `docker ps --no-trunc` 摘要：

- `gray-payease-1`：镜像名 `gray-payease`，镜像/容器 ID `a1eba29a…`，创建时间 `2026-10-22 15:51:30 +0700`，状态 `Up 10 days`
- `gray-scanner-1`：镜像名 `gray-scanner`，镜像/容器 ID `706ab6a5…`，创建时间 `2026-10-22 15:51:30 +0700`，状态 `Up 9 days (unhealthy)`

只读 `find /opt/payease -type f -name BUILD_INFO` 未找到文件，因此构建提交和制品构建来源无法核对；D-29/O2 的 BUILD_INFO 缺口仍存在。未输出任何环境变量值或密钥。

## Q3：资源余量

结果：**PASS（资源检查本身）**。

命令：`df -h`、`free -m`、`docker ps`。摘要：根文件系统 77G，总已用 6.4G、可用 71G、使用率 9%；内存总量 3915MB、可用 2978MB；Swap 总量 2047MB、可用 2010MB。PayEase 容器运行，scanner 容器为 `unhealthy`。

## Q4：四个配置键存在性

结果：**FAIL/未验证完整生效链**。

在运行容器环境中只读检查四个键，结果均为 `ABSENT`：

- `PAYEASE_ALLOWED_ORIGINS`：不存在
- `KHMERX_TEST_MODE`：不存在
- `PAYEASE_DEMO_OTP_ALLOWED`：不存在
- `PAYEASE_H5_AUTH_MODE`：不存在

同时只读检查 `/opt/payease/payease-release/compose.yaml` 及常见 `.env` 路径，未找到这四个键。未尝试补写或设置任何键；因此不能把缺失解释为已生效的默认值。

## 结论

Q1 迁移 0062 因主机无 sqlite3 无法验证；Q2 未找到 BUILD_INFO 且 scanner unhealthy；Q3 资源余量检查通过；Q4 四个配置键均未发现。该预检不构成可开窗或部署批准。
