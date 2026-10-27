# O2 来源证据修复执行单(灰度制品:从已评审提交构建并留下可核对的来源)

日期:2026-10-27
依据:`deploy/standalone/gray/README.md` 的 "Reviewed gray artifacts (C2)" 一节(#60,main `c013f3f`);O2 缺口描述见 OPS 回填(服务器上没有 `BUILD_INFO`,`/version` 的 `buildId` 无法对应到已批准的构建提交)。
性质:**含写操作。本单不是批准,也不是 W1 批准。** 在技术负责人另行书面批准一个重建窗口之前,**不得执行第 2 部分之后的任何一步**。灰度、VPS、L2/Q12 保持 HOLD。

## 0. 为什么这样做(两句话)
- `/version` 返回的 `buildId` 读的是镜像里的 `BUILD_ID` 文件,是框架构建编号,不是 Git 提交。能把运行物对应到提交的只有 `BUILD_INFO.json`(含完整 `gitSha` 和与 `dist/server/BUILD_ID` 一致的 `buildId`),它只由 `scripts/build-gray-artifact.sh` 生成。
- **不得手写 `BUILD_INFO`**,也不得把 `02ddd0d` 直接写进现有服务器的文件:那只是一条声明,不是证明。重启也不能补上来源证据。

## 1. 已核对的事实(git 对比,不是服务器上的验证)
| 项 | 值 |
|---|---|
| 已评审、要求使用的提交 | `02ddd0d`,完整 SHA:`02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61` |
| 灰度服务器当前 checkout | `9355f3a`,完整 SHA:`9355f3ae7c68444f0d08a4e5cdd12158fa64165c` |
| 两者之间 | 5 个提交,**只改 `mobile/`(13 个文件)**;没有 Web、网关(`deploy/standalone`)、`drizzle` 迁移改动 |
| `02ddd0d` 到当前 main | `drizzle/` 下**没有新的迁移文件** |
| 含义 | 从 `02ddd0d` 重建,启动时网关应用的迁移集合与现在一致,理论上不产生新迁移;服务器上 `9355f3a` 的非 mobile 文件与 `02ddd0d` 一致 |
| 未核实的 | 灰度数据库里实际已应用了哪些迁移(网关启动会应用镜像里全部 `drizzle/*.sql`)。见第 5 部分 X1 |

说明:`docker compose` 的构建上下文是服务器上的仓库根目录,`Dockerfile` 用 `COPY dist ./dist` 取预构建的制品,其余文件(`server.mjs`、`drizzle` 等)取自服务器 checkout。因为两个提交的非 mobile 文件一致,**不需要、也不得为此移动服务器上的 checkout**;保留现有 checkout 里的 `.github/CODEOWNERS` 和其他用户文件。

## 2. 开始前必须具备(缺一不得开始)
| # | 条件 | 谁 | 状态 |
|---|---|---|---|
| 1 | 技术负责人**书面批准**本重建窗口(见第 3 部分批准单) | 技术负责人 | ☐ |
| 2 | **D4 已解决**:构建机的 linux-x64 依赖来源已确定——(a) 批准一次联网 `npm ci`,或 (b) 提供同一 `package-lock.json` 的离线依赖并设置 `GRAY_ARTIFACT_REUSE_DEPS=1` | 技术负责人 | ☐ |
| 3 | 构建机已确定:一台运维人员的 Linux 构建机,**不是灰度源站**;有 Docker、镜像 `node:22.22.1-bookworm-slim`、离线可用的 Git | 技术负责人、OPS | ☐ |
| 4 | **D6 已处理**:备份方案已明确(见第 3 部分"备份"一行) | 技术负责人 | ☐ |
| 5 | 窗口时间已定,**早于灰度自动关闭的周六 17:45**,且预留回退时间 | 技术负责人 | ☐ |
| 6 | 本单第 6 部分的回退材料已就位:旧的完整 `dist` 已按下面要求保留 | OPS | ☐ |

## 3. 窗口批准单(由技术负责人填写后回复"批准")
```
窗口:2026-__-__ __:__ – __:__(须早于周六 17:45)
范围:只替换灰度制品并重建容器;不改任何配置,不改 PAYEASE_* 绑定,不写 fixture,不启动压测,不做 W1/W2
提交:02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61
构建机:______________(不是灰度源站)
依赖来源:联网 npm ci / 离线依赖 GRAY_ARTIFACT_REUSE_DEPS=1(二选一,写明)
备份:使用 backup.sh --apply(需要 D6 的 Spaces 配置) / 接受无异地备份(需技术负责人明确写出)
停机:重建期间应用短暂不可用,约 __ 分钟(可接受 / 不可接受)
回退:恢复保留的旧 dist 并重建容器,由技术负责人批准执行
```
注意:`backup.sh --apply` 会暂停应用、上传到异地私有存储,依赖 D6 的配置;D6 未解决时,必须由技术负责人在这里明确选择,不得由 OPS 自行改用别的办法。

## 4. 执行步骤(仅在批准窗口内)

### 4.1 构建机(不是灰度源站)
```bash
# 1) 在一个全新的临时目录里工作,不要在已有 dist 的目录里构建
# 2) 取得已批准提交的干净检出,并确认完整 SHA
git rev-parse 02ddd0d     # 必须输出 02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61
# 3) 构建脚本在 02ddd0d 里不存在:从 main 取 scripts/build-gray-artifact.sh 与
#    deploy/standalone/gray/verify-artifact.sh,放进该检出的相同路径(仅这两个文件)
# 4) 在 node:22.22.1-bookworm-slim 容器里,按灰度 README 的 C2 一节执行
bash /review/scripts/build-gray-artifact.sh 02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61
bash /review/deploy/standalone/gray/verify-artifact.sh 02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61
```
- 构建输出 `GRAY ARTIFACT BUILD: PASS`;`dist/` 里有 `BUILD_INFO.json`、`BUILD_DEPS.json`、`dist.sha256`。
- 容器的挂载、依赖模式(联网 `npm ci` 或 `GRAY_ARTIFACT_REUSE_DEPS=1`)、Git 的提供方式,以灰度 README 的 C2 一节为准,不在本单重复,也**不要自行变通**。
- 构建脚本拒绝已存在的 `dist`;每次构建都用新的临时副本。
- **构建机上完成这一步并通过校验之前,不得碰灰度源站。**

### 4.2 打包与传输
```bash
tar -czf gray-dist.tgz dist
sha256sum gray-dist.tgz      # 记录哈希
```
经批准的私有通道传到灰度源站;**在源站上核对 `sha256sum gray-dist.tgz` 与构建机记录一致后才解压**。不一致就停止并上报。

### 4.3 灰度源站:窗口开始前的只读核对
记录当前状态,不改任何东西:
```bash
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
curl -s -m 5 -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/version
df -h /opt/payease | tail -1
```
磁盘使用超过 85% 则中止并上报。

### 4.4 灰度源站:替换制品并重建(窗口内)
1. 按批准单的"备份"一行处理备份。
2. 保留旧制品:把现有 `/opt/payease/app/dist` **整体改名**保留(例如 `dist.prev-<日期时间>`),不得删除;记录旧 `dist/server/BUILD_ID` 的内容。
3. 把核对过哈希的新 `dist` 放到 `/opt/payease/app/dist`。
4. 在 `/opt/payease/app` 根目录做源码侧校验(无网络,只读挂载):
```bash
docker run --rm --network none -v "$PWD:/app:ro" -w /app \
  node:22.22.1-bookworm-slim bash deploy/standalone/gray/verify-artifact.sh 02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61
```
5. 校验通过后重建容器(仅在批准窗口内):
```bash
docker compose -f deploy/standalone/gray/compose.gray.yaml up -d --build
```
6. 重建**不得**修改 `config.json`、`scanner-secrets` 或 `/opt/payease/data` 下的任何文件。

### 4.5 回环核验(只对本机回环发请求)
```bash
docker run --rm --network host -v "$PWD:/app:ro" -w /app \
  node:22.22.1-bookworm-slim bash deploy/standalone/gray/verify-artifact.sh 02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61 --running
cat dist/BUILD_INFO.json                     # 该文件不含密钥
curl -s -m 5 -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/version
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
```
**O2 为 PASS 需同时满足:**
- `BUILD_INFO.json` 的 `gitSha` 等于 `02ddd0d01493ea6051e9d0ef4bb48a2904e2bc61`;
- `BUILD_INFO.json` 的 `buildId` 等于 `/version` 返回的 `buildId`;
- `verify-artifact.sh --running` 输出通过;
- 应用与扫描器容器都在运行,`/healthz`、`/readyz` 返回 200。

注意:`--running` 只比较框架构建编号,不比较 Git SHA;`gitSha` 要靠上面第一条核对。

## 5. 额外的只读检查(窗口前后都可以做,不需要批准,但仍然只读)
- **X1 迁移记录**:用只读方式比较灰度数据库的迁移记录条数与镜像内 `drizzle/` 下 `.sql` 文件数。**我没有核实数据库文件路径和迁移记录表名,不要猜;** OPS 先用只读方式查明(例如 `sqlite3 -readonly` 打开数据库只列表),找不到就写"无法确认",不要写操作。
- **X2 同源配置(决策日志 D-26)**:只核对 `PAYEASE_ALLOWED_ORIGINS` 这一个键的取值,**不得 `cat config.json`**,例如只输出该键所在行:
  ```bash
  grep -o '"PAYEASE_ALLOWED_ORIGINS"[^,}]*' /opt/payease/data/config.json
  ```
  未配置也要如实回填。该值不是密钥;但不要把整个文件输出到屏幕或记录。

## 6. 回退(需技术负责人批准执行)
- 触发:`BUILD_INFO` 与 `/version` 对不上、`/readyz` 不是 200、容器起不来、磁盘 > 85%、出现 OOM、需要迁移而不是预期的零迁移。
- 步骤:把保留的旧 `dist` 改回 `/opt/payease/app/dist`,按第 4.4 的第 5 步重建容器,回环核验 `/readyz` 为 200;记录旧 `BUILD_ID`。**旧制品没有 `BUILD_INFO.json`,所以回退后 O2 仍为 FAIL**,这是预期结果。
- 回退完成后立即上报,不要再尝试第二次构建,除非技术负责人另行批准。

## 7. 中止条件(任何一条立即停止并汇报)
- `git rev-parse 02ddd0d` 的输出不是批准单里的完整 SHA。
- 构建脚本或校验脚本任何一步失败;传输后哈希不一致。
- 需要在灰度源站上执行 `npm ci`、`npm install` 或应用构建(**禁止**)。
- 发现令牌、密钥、密码哈希、Cookie 或 manifest 出现在屏幕、日志或回填里。
- 窗口临近周六 17:45:先完成回退并确认应用在运行,不要留着停机状态。

## 8. 禁止事项(整个窗口)
改 `config.json` 或任何 `PAYEASE_*` 绑定;写 fixture;启动压测;做 W1/W2;改 `scanner-secrets`;移动或清理服务器上现有的 checkout 或用户文件;手写 `BUILD_INFO`;在灰度源站上联网安装依赖或构建;对任何 khmerx.org 域名发起请求(回环核验用 `Host` 头对 `127.0.0.1` 发请求,不算)。

## 9. 回填(O2 重做,以及重建后必须重做的项)
重建后必须重做 O6;建议同时重做 O1–O5,并回填 X1、X2。表格只放结果、脱敏摘要、时间、操作员,不放任何敏感值。

| 项 | 结果 | 脱敏摘要 | 时间(+07) | 操作员 |
|---|---|---|---|---|
| O2 | | gitSha 是否等于 02ddd0d 完整 SHA;buildId 是否一致;`--running` 结果 | | |
| O6 | | `/healthz`、`/readyz`、`/api/h5/auth` 返回码与 mode、`gray-closed` | | |
| O1 | | 三个路径的属主、权限、是否软链接 | | |
| O3–O5 | | 同 `2026-10-24-ops-o1-o6-readonly.md` | | |
| X1 | | 迁移记录条数 / 文件数,或"无法确认" | | |
| X2 | | `PAYEASE_ALLOWED_ORIGINS` 的取值或"未配置" | | |

交付:回填表发技术负责人转 Claude。验收规则不变:证据不足一律按 FAIL,"待核对"和跳过的项不算通过。**全部 PASS 之前,不申请 W1。**

## 10. 这份单子没有解决的事
- D4(构建机依赖)与 D6(备份)仍需要技术负责人决定。
- #60 的"真实构建证据"至今没有:这次真实构建将是第一次,请把构建机上的 `BUILD_DEPS.json`、`BUILD_INFO.json` 和 `dist.sha256`(不含敏感内容)一并回填,便于评审。
- 灰度只证明"来源可核对",不证明 Gate A 的任何判据。
