# Google Geocoding API 配置

KYC 详细地址的地图图标调用服务端 `POST /api/kyc/geocode`，服务端再请求 Google Geocoding API。浏览器、Telegram Mini App 和客户端日志不会接触 API Key。

## VPS 配置

在 `/opt/payease/data/config.json` 的 `bindings` 中加入：

```json
"GOOGLE_MAPS_API_KEY": "由 Google Cloud 创建的受限服务端密钥"
```

API Key 应仅允许 Geocoding API，并限制来源为 VPS 出口 IP（如 Google Cloud 项目策略支持）。启用 Geocoding API 和结算账户后，重启 `payease` 容器即可生效。

未配置密钥时接口返回 503，不会退回客户端直连，也不会将密钥写入构建产物。
