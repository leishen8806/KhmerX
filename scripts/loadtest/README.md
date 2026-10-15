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
  --summary-export=reports/b0-50.json scripts/loadtest/b0-main-flow.js

# 指定 100/300/600/1000 VU
k6 run -e BASE_URL=https://staging.example.test -e VUS=600 -e DURATION=3m \
  --summary-export=reports/b0-600.json scripts/loadtest/b0-main-flow.js

# 阶梯场景：100 → 300 → 600，每档 3 分钟
k6 run -e BASE_URL=https://staging.example.test -e STAGES=true \
  --summary-export=reports/b0-stages.json scripts/loadtest/b0-main-flow.js
```

仅允许本地、环回地址或明确的预发主机。脚本会拒绝 `payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org` 及其 HTTPS 生产请求。

## B0b 灰度资源采集

资源采集必须在金融机构灰度源站 `159.223.77.134` 上运行，不要在生产机运行。
采集器每 2 秒将 `docker stats
--no-stream` 和 `vmstat` 追加到 CSV，直到按 `Ctrl-C` 停止：

```sh
scripts/loadtest/sample-resources.sh \
  --origin-ip 159.223.77.134 \
  --host testapi.khmerx.org \
  --output scripts/loadtest/reports/b0b-resources.csv
```

`--origin-ip` 和 `--host` 只作为本次压测的元数据写入 CSV；实际请求仍由
k6 的目标配置决定。对 `testpayease.khmerx.org` 压测时，将 `--host` 改为该域名。
压测结束后停止采集器，再将 CSV 与 B0b 的 100/300/600 VU 报告一并归档。

## 报告

`--summary-export` 是 k6 原始 JSON；脚本的自定义指标包括总请求延迟 p50/p95/p99、错误率、按 HTTP 状态码和响应 `code` 的计数，以及上传成功率。`checks` 失败时先查看认证、Cookie、Origin 和服务端配置，再提高并发；不要把生产域名用于压测。
