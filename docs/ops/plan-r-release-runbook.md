# Plan R 上线手册（R-7，VPS SQLite / Miniflare 架构）

本文只依据仓库中的部署文件和运维文档整理。Codex 不登录服务器、不执行线上读写、不部署；命令均为负责人审批后的操作草案。

## 1. 环境核实（仓库证据）

| 环境/入口 | 仓库中对应的配置 | 数据库判断 | 结论与待确认项 |
|---|---|---|---|
| `testpayease.khmerx.org`、`testadmin.khmerx.org`、`testapi.khmerx.org`（灰度源站 `159.223.77.134`） | `deploy/standalone/gray/compose.gray.yaml`、`deploy/standalone/gray/README.md`、`deploy/standalone/Caddyfile.gray` | VPS 上的 Miniflare/workerd 兼容 D1，持久化目录映射为 `/opt/payease/data`，其中 D1 状态在 `/data/d1` | 明确是灰度 SQLite 文件，不是 Cloudflare 托管 D1。 |
| Licensed `165.22.108.5` | `deploy/clamav-gateway/gray/*` | 这些文件只描述 Licensed 机上的临时 ClamAV 扫描服务；应用 compose 和应用数据库配置未在仓库中绑定到该 IP | 不能据仓库判断该机是否运行 PayEase 应用或数据库，待负责人确认；不要把它当作 Plan R 迁移目标。 |
| `payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org`（生产源站 `159.223.92.104`） | `deploy/standalone/compose.yaml`、`deploy/standalone/server.mjs`、`deploy/standalone/hosts.mjs`；正式域名列表也出现在 `deploy/standalone/server.mjs` | `server.mjs` 使用 Miniflare 的 `d1Persist: '/data/d1'`，compose 将宿主机 `/opt/payease/data` 挂到容器 `/data`；因此按仓库设计是 VPS 上的 Miniflare/D1 SQLite 文件 | 入口与生产配置吻合，但仓库没有把该 IP 写进 compose 的主机映射，实际当前容器/域名归属仍待负责人确认。 |

仓库没有证据表明这些入口使用 Cloudflare 托管 D1。`wrangler d1 export --remote` 不适用于当前已核实的数据库目标，也不应作为本手册的备份命令。若负责人确认另有 Cloudflare D1 环境，必须另建环境专用步骤；届时 `wrangler d1 export` 会占用数据库资源并可能造成不可用窗口，Time Travel 可用 `wrangler d1 time-travel info` 查询、用 `wrangler d1 time-travel restore` 做时间点恢复，但本任务不执行这些命令。

## 2. 代码和迁移机制

`deploy/standalone/server.mjs` 启动时：

1. 创建 Miniflare D1，持久化到 `/data/d1`；
2. 读取 `/app/drizzle` 下的 SQL 文件；
3. 用 `standalone_migrations` 记录已执行迁移，并按文件名顺序逐个执行；
4. 因此 VPS 上没有独立的 Wrangler 远程迁移命令，迁移是在启动包含新 `/app/drizzle/0062` 的应用容器时自动执行。

本地演练使用 `scripts/dev-app-backend/migrate-dev.mjs`，它只操作 checkout 的 `.wrangler/state`，并明确禁止连接非本地数据库：

```sh
node scripts/dev-app-backend/migrate-dev.mjs
node scripts/audit-seq-verify.mjs \
  --db <LOCAL_MINIFLARE_SQLITE_COPY> \
  --backfill-max-seq <N>
```

## 3. 备份与迁移前演练

### 3.1 灰度

`deploy/standalone/gray/backup.sh` 是仓库现成的灰度备份脚本。它加锁、确认唯一 writer、短暂停止 `payease`、对 `/opt/payease/data` 中每个 SQLite 文件执行 `.backup`，做 SHA256/SQLite 完整性校验，然后上传到私有、异区域 Spaces；恢复脚本只下载到新的临时目录，不替换 live data。

由负责人批准后在灰度主机执行：

```sh
cd /opt/payease/app
sudo bash deploy/standalone/gray/backup.sh --dry-run
sudo bash deploy/standalone/gray/backup.sh --apply
```

灰度脚本只允许灰度数据，且 `/opt/payease/backup.env` 必须 root-owned、mode 600。备份完成后把快照复制到本地隔离环境，在副本上跑完整迁移演练，并记录迁移后的：

```sql
SELECT MAX(seq) FROM team_audit;
```

记录结果为 `N`，然后运行只读 verifier：

```sh
node scripts/audit-seq-verify.mjs \
  --db <LOCAL_COPY_OF_GRAY_SQLITE> \
  --backfill-max-seq <N>
```

验收必须为 `seqNull.count=0`、`seqUnique=true`、`orderCheck="passed"`，进程退出码为 0；不传 N 时的 `orderCheck="skipped"` 不能作为迁移验收。

### 3.2 生产

仓库没有把 `deploy/standalone/gray/backup.sh` 声明为生产备份脚本。生产配置只明确 `/opt/payease/data` 是持久化目录；因此负责人必须先确认现有生产备份/上传流程，再批准操作。若确认采用手工 SQLite 副本，操作形态应类似：

```sh
# 以下只供负责人审批后在确认的生产主机执行；本任务未执行
cd /opt/payease/app
sudo docker compose -f deploy/standalone/compose.yaml stop payease
sudo mkdir -p /opt/payease/backups/plan-r-<UTC-TIMESTAMP>/data/d1
sudo cp -a /opt/payease/data/config.json /opt/payease/backups/plan-r-<UTC-TIMESTAMP>/
sudo find /opt/payease/data/d1 -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) -print0 |
  while IFS= read -r -d '' db; do
    out=/opt/payease/backups/plan-r-<UTC-TIMESTAMP>/data/d1/$(basename "$db")
    sudo sqlite3 "$db" ".backup '$out'"
  done
sudo docker compose -f deploy/standalone/compose.yaml start payease
```

实际执行前必须把 `<UTC-TIMESTAMP>` 固定替换成同一个目录名、确认 WAL/SQLite 文件已由 `.backup` 安全导出、计算并保存校验值，并确认配置密钥与数据备份匹配。若采用负责人确认的现有 off-host 备份脚本，应以该脚本为准，不得把上面的示例直接当作授权。

## 4. 推荐上线顺序：先灰度，后生产

### 4.1 灰度维护窗口

灰度有仓库现成的维护标记机制：`deploy/standalone/gray/gray-hours.sh` 写入 `/opt/payease/data/gray-closed`，容器内映射为 `/data/gray-closed`。标记存在时，业务 API 返回 503、`Retry-After` 和 request ID，浏览器路由显示 km/en/zh 维护页；`GET /healthz`、`/readyz`、`/version` 保持诊断行为。Telegram Mini App 的 API 请求会收到 503，页面不能完成登录/业务动作；H5 同样暂时不可用；服务机构和持牌机构后台页面显示维护页，后台 API 请求返回 503。计时器型后台任务不保证被该标记暂停。

负责人批准后，灰度可按以下顺序：

```sh
cd /opt/payease/app
sudo bash deploy/standalone/gray/gray-hours.sh close --apply
curl -i -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/healthz
docker compose -f deploy/standalone/gray/compose.gray.yaml stop payease
```

停止容器是备份脚本和迁移窗口的实际停写手段；若只写维护标记而不停止容器，后台定时任务或其他内部写入仍可能发生。灰度恢复时先部署/启动新版本并检查 ready，再执行：

```sh
docker compose -f deploy/standalone/gray/compose.gray.yaml start payease
sudo bash deploy/standalone/gray/gray-hours.sh open --apply
```

### 4.2 灰度迁移和验证

新镜像启动时由 `deploy/standalone/server.mjs` 自动执行 0062。不得另用 Wrangler 连接远程 D1。启动后在本地/负责人批准的只读运维通道确认：

```sh
docker compose -f deploy/standalone/gray/compose.gray.yaml logs --tail=200 payease
curl --fail http://127.0.0.1:4300/readyz
```

再从备份副本运行 verifier，并在灰度应用内创建和校验一份 v3 manifest。灰度完整通过后，才具备生产上线的前置证据。

### 4.3 生产

生产没有在仓库中确认等价的维护标记已经配置，因此不能假设 Caddy 会显示维护页。上线前负责人必须确认维护模式；若没有配置，唯一仓库明确存在的停写手段是停止 standalone `payease` 容器，这会使三个生产域名的业务请求不可用，Caddy 可能返回连接失败/502，而不是应用维护页。

推荐生产顺序：备份并在灰度通过 → 负责人批准维护窗口 → 停止生产 `payease` → 让新版本容器启动并自动执行 0062 → 检查 ready/迁移日志 → 完成只读验证和 v3 manifest → 恢复流量。迁移后旧代码若继续写入会省略 seq 并产生 NULL，所以不能在迁移和新代码之间保留运行中的旧 writer。

先部署代码再迁移不可行：standalone 新代码的启动流程会自行按 `/app/drizzle` 执行未完成迁移；若代码/迁移版本不一致，必须停止并回滚发布，不得让旧实例与新 schema 长时间混写。暂停、迁移、部署、恢复流量均需负责人批准。

## 5. 上线后验证

在已批准的只读通道执行等价检查，不能用 verifier 直接打开线上路径：

```sql
SELECT COUNT(*) AS seq_null_count FROM team_audit WHERE seq IS NULL;
SELECT COUNT(*) AS total_rows,
       COUNT(seq) AS non_null_seq,
       COUNT(DISTINCT seq) AS distinct_seq,
       MAX(seq) AS max_seq
FROM team_audit;
SELECT seq, id, created_at FROM team_audit ORDER BY seq DESC LIMIT 20;
```

条件是 NULL 为 0，`non_null_seq = distinct_seq = total_rows`，并记录新的 `MAX(seq)`。在本地副本使用该次迁移完成时的 N 运行 verifier；新 writer 的 seq 应大于回填上限且递增。随后由负责人批准在测试租户创建一份 v3 manifest，并校验 `version=3`、`match=true`、`needsManualReview=false`。

## 6. 回滚

0062 没有 down migration。代码回滚不等于数据库回滚：保留 seq 列、索引和触发器，旧代码仍可读取并 INSERT（seq 列可 NULL），但旧 INSERT 会产生 NULL seq，导致 v3 manifest 进入 `needsManualReview`。触发器阻止 UPDATE/DELETE，不阻止 INSERT，因此不能靠旧代码修复已有行，也不能删除/重编号审计行。

若新版本失败：停止写入，保留备份和迁移日志，按负责人批准回滚代码；在新代码恢复前禁止把 v3 验收标记为通过。若必须恢复数据，先停止应用，把备份恢复到经过验证的副本，再由负责人批准替换 live `/opt/payease/data`；仓库没有自动生产恢复命令。生产维护模式未确认前，不能声称客户端会得到维护页。

## 7. 待负责人确认清单

- `159.223.92.104` 当前实际运行的是 `deploy/standalone/compose.yaml`，以及三个生产域名是否都由该实例承载。
- `165.22.108.5` 是否只运行 ClamAV/扫描服务，是否存在未写入仓库的 PayEase 应用或数据库。
- 生产现有 off-host 备份脚本、备份存储和恢复责任人；仓库只给出灰度备份脚本。
- 生产 Caddy/网关是否已配置 `GRAY_CLOSED_FILE` 或其他维护页机制；未确认前按“停止容器、可能返回 502”评估影响。
- 生产迁移窗口、停止写入范围、部署版本、备份校验值和允许执行线上 0062 的明确批准。

本 PR 只修改文档，不执行服务器登录、线上读写、备份、迁移、部署、`--remote` 或强推。
