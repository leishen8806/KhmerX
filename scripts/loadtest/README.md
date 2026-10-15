# B0 申请主流程基线压测

本目录只包含本地或预发环境的 k6 脚本。脚本模拟：

`GET 认证预检 → 发送/校验演示验证码 → GET KYC → 上传 4 份虚构 JPG → 保存并提交 KYC → 轮询状态`

## 前置条件

1. 安装 [k6](https://grafana.com/docs/k6/latest/set-up/)。
2. 启动本地应用和数据库。默认目标是 `http://127.0.0.1:5173`。
3. 本地认证必须使用演示模式（`PAYEASE_AUTH_MODE=demo`、`KHMERX_TEST_MODE=true`），并准备一个可访问工作区的身份头。没有 ChatGPT 网关注入身份时，可通过环境变量传入：

```sh
export K6_USER_ID=synthetic-b0-runner
export K6_USER_EMAIL=b0-runner@example.test
```

如果预发网关要求身份证明，再传 `K6_IDENTITY_PROOF`。公司上下文可用 `K6_COMPANY`（例如 `t_<uuid>`）。

## 运行

```sh
# 先做 50 VU 验收，默认 3 分钟
k6 run -e BASE_URL=http://127.0.0.1:5173 -e VUS=50 -e DURATION=3m \
  --summary-export=scripts/loadtest/reports/b0-50.json scripts/loadtest/b0-main-flow.js

# 指定 100/300/600/1000 VU
k6 run -e BASE_URL=https://staging.example.test -e VUS=600 -e DURATION=3m \
  --summary-export=scripts/loadtest/reports/b0-600.json scripts/loadtest/b0-main-flow.js

# 阶梯场景：100 → 300 → 600，每档 3 分钟
k6 run -e BASE_URL=https://staging.example.test -e STAGES=true \
  --summary-export=scripts/loadtest/reports/b0-stages.json scripts/loadtest/b0-main-flow.js
```

仅允许本地、环回地址或 `LOADTEST_ALLOWED_HOSTS` 明确列出的预发目标。脚本会拒绝
`payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org` 生产域名。

### 直连源站压测

压测从 `165.22.108.5` 发起，直连应用源站 `159.223.77.134`，并发送测试域名
Host 头，不经过 Cloudflare。用 `run-b0.sh` 传入 `--origin-ip` 与 `--host`；两者
必须同时提供，且 IP 与 Host 都必须列入 `LOADTEST_ALLOWED_HOSTS`：

```sh
LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org \
  scripts/loadtest/run-b0.sh --origin-ip 159.223.77.134 --host testapi.khmerx.org \
  -e VUS=600 -e DURATION=3m \
  -e REPORT_PATH=scripts/loadtest/reports/b0-600.json
```

对 Mini App/H5 API 使用 `testpayease.khmerx.org` 替换 Host，并同步加入白名单。

## B0b 灰度资源采集

资源采集必须在金融机构灰度源站 `159.223.77.134` 上运行，不要在生产机运行。
采集器每 2 秒将 `docker stats --no-stream` 和 `vmstat` 追加到 CSV，直到按
`Ctrl-C` 停止：

```sh
scripts/loadtest/sample-resources.sh \
  --output scripts/loadtest/reports/b0b-resources.csv
```

`--origin-ip` 和 `--host` 属于压测脚本 `run-b0.sh`，不属于采样脚本。压测结束后
停止采集器，再将 CSV 与 B0b 的 100/300/600 VU 报告一并归档。

## 报告

`--summary-export` 是 k6 原始 JSON；脚本的自定义报告还包括每秒请求数、总用时、
请求延迟 p50/p95/p99、错误率、按 HTTP 状态码和响应 `code` 的计数、409 写冲突
重试次数、陈旧更新错误数和上传成功率。`checks` 失败时先查看认证、Cookie、Origin
和服务端配置，再提高并发；不要把生产域名用于压测。
