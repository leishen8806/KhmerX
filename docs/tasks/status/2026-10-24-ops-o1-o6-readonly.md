# OPS 只读执行单:O1–O6(2026-10-24 周六 09:00–11:00)

依据:技术负责人 2026-10-23 冻结决定第 1、2 条。本单**只读**,不是 W1 批准,也不批准 O7。
来源检查项:`docs/tasks/orchestration/zhixu-day7-day8-20261023-24.md` 的 O1–O6(该文件已作废,仅取检查项)。

## 0. 总规则(先读)

1. 时间:09:00–11:00。来不及的项如实写"未做",不得赶工。
2. 只读。**禁止**:改任何文件或权限、`chown`/`chmod`、创建目录、`export`/设置环境变量、重启或重建容器、`docker compose up/down/build`、写 fixture、启动 k6、改 DNS/Cloudflare/Caddy。
3. **禁止输出敏感内容**:不得 `cat` `config.json`;不得运行 `docker inspect`、`docker compose config`、`env`、`printenv`(下文 O3 指定的那一个变量除外)。这些会把令牌、密钥、密码哈希打到屏幕和记录里。
4. 发现任何一步需要写操作才能继续:停下,该项写 FAIL 或"待核对",写明原因,不要自己修。
5. 回填里不得出现令牌、密钥、密码哈希、Cookie、manifest 内容。IP 和路径可以写。
6. 服务器只由 OPS 本人操作。Cloudflare 控制台仅董事会有凭据,OPS 不登录、不代做。
7. 灰度 17:45 自动关闭。今天只读,与此无冲突。
8. 任何一项命令报错或输出与预期不符:原样记录退出码和一行脱敏摘要,不要重试到"凑成功"。

## 1. 灰度源站 159.223.77.134

### O1 权限与属主
```bash
for p in /opt/payease/data /opt/payease/data/config.json /opt/payease/scanner-secrets; do
  stat -c '%n owner=%u:%g mode=%a type=%F' "$p" 2>&1
  [ -L "$p" ] && echo "$p SYMLINK" || echo "$p not-symlink"
done
```
PASS 需同时满足:
- `/opt/payease/data`:owner=1000:1000,mode=700
- `/opt/payease/data/config.json`:owner=0:1000,mode=640
- `/opt/payease/scanner-secrets`:owner=1000:65534,mode=2750
- 三者都 not-symlink

### O2 构建来源
```bash
find /opt/payease -maxdepth 4 -name 'BUILD_INFO*' 2>/dev/null
# 对上一步找到的 BUILD_INFO 文件逐个读取(该文件不含密钥):
#   cat <上面找到的路径>
curl -s -m 5 -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/version
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
```
PASS:BUILD_INFO 中的构建提交是 `02ddd0d`(或其完整哈希),`/version` 有响应,buildId 与 BUILD_INFO 一致。
找不到 BUILD_INFO、或 `/version` 无响应 → FAIL(写明哪一个)。

### O4 压测目录
```bash
for p in /opt/payease/loadtest /opt/payease/loadtest/manifests; do
  stat -c '%n owner=%u:%g mode=%a type=%F' "$p" 2>&1
  [ -L "$p" ] && echo "$p SYMLINK" || echo "$p not-symlink"
done
ls -A /opt/payease/loadtest/manifests 2>&1 | wc -l   # 只报文件个数,不列文件名内容
```
PASS:两个目录都存在,owner=1000:1000,mode=700,not-symlink。
**不存在不要创建**,写 FAIL。

### O6 服务状态(只对本机回环地址发请求)
```bash
for u in /healthz /readyz; do
  echo "$u $(curl -s -m 5 -o /dev/null -w '%{http_code}' -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300$u)"
done
curl -s -m 5 -o /tmp/o6_auth.json -w 'auth http=%{http_code}\n' -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/api/h5/auth
grep -o '"mode":"[a-z]*"' /tmp/o6_auth.json; rm -f /tmp/o6_auth.json
[ -e /opt/payease/data/gray-closed ] && echo "gray-closed EXISTS" || echo "gray-closed absent"
```
PASS:`/healthz`、`/readyz` 都是 200;auth http=200 且 `"mode":"telegram"`;`gray-closed absent`。
(`/tmp/o6_auth.json` 是本命令自己的临时文件,命令末尾已删除。)

### O5(Caddy 部分)
```bash
systemctl show caddy -p ExecStart 2>&1
```
PASS:ExecStart 中加载的是 `/etc/caddy/Caddyfile.gray`。unit 不存在 → FAIL。

## 2. 压测机 165.22.108.5

### O3 压测机就绪(不启动压测)
```bash
k6 version 2>&1
printenv LOADTEST_ALLOWED_HOSTS   # 只读当前值;不要 export、不要设置
```
再由 OPS 记录仓库脚本所在路径,并确认可读:
```bash
test -r <仓库路径>/scripts/loadtest/rows-flow.js && echo readable || echo NOT-readable
```
PASS:k6 已安装;脚本可读;`LOADTEST_ALLOWED_HOSTS` 的值**恰好**是 `159.223.77.134,testapi.khmerx.org`。
变量没设置或值不同 → FAIL,**不要自己设置**。

## 3. 域名与代理(O5 的其余部分)

OPS 可做(人工,只读):
```bash
for d in testapi testpayease testadmin test; do echo "== $d.khmerx.org"; dig +short $d.khmerx.org; done
curl -s -m 10 -o /dev/null -w 'testapi healthz http=%{http_code}\n' https://testapi.khmerx.org/healthz
```
记录:四个域名的解析结果是否为 Cloudflare 的 IP;testapi 返回码是不是 521。
PASS 条件:四域名经 Cloudflare 代理解析;testapi 不是 521。

**以下两项 OPS 无法核实,写"待核对,交董事会":**
- Cloudflare 里 DNS 记录是否指向 159.223.77.134 且代理已开启
- SSL/TLS 模式是否为「完整」

按 Claude 验收口径,"待核对"不算 PASS,O5 整体将不通过,直到董事会补证据。

## 4. 回填表(只放 PASS/FAIL/待核对、脱敏摘要、时间、操作员)

| 项 | 结果 | 脱敏摘要 | 时间(+07) | 操作员 |
|---|---|---|---|---|
| O1 | | | | |
| O2 | | | | |
| O3 | | | | |
| O4 | | | | |
| O5 | | | | |
| O6 | | | | |

附注:
- 每项写一行摘要,例如"owner=1000:1000 mode=700,非软链接"。
- FAIL 要写缺什么(目录不存在 / 返回码 / 值不符),不要写修复动作。
- 未执行的项写"未做"。

## 5. 交付

- 回填表发技术负责人,转 Claude。**11:00 前交**;来不及也在 11:00 交已完成部分。
- Claude 验收规则:证据不足一律按 FAIL;"待核对"、跳过的项不算通过。
- 全部 PASS 之前,不做 O7,不改 `bindings`,不重建容器。周一 W1 须在 O1–O6 全部 PASS 后由技术负责人另行批准。

## 6. 中止并上报

出现任一情况,立即停止并汇报,不要继续:
- 屏幕或记录里出现了令牌、密钥、密码哈希、Cookie 或 manifest 内容
- 命令意外产生了写入(文件、权限、容器状态变化)
- 服务器上发现不明进程、不明登录或磁盘 > 85%
