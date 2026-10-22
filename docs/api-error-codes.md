# API 错误码约定

所有 JSON 接口发生错误时返回：

```json
{
  "code": "AUTH_REQUIRED",
  "error": "客户登录已失效，请重新验证手机号"
}
```

`code` 是稳定的机器可读值，Flutter 必须按 `code` 使用本地化资源；`error` 仅作为旧客户端兼容字段，不应作为判断条件或翻译 key。

| code | 含义 |
| --- | --- |
| `AUTH_REQUIRED` | 未登录、会话失效或需要重新认证 |
| `FORBIDDEN` | 已登录但没有访问或操作权限 |
| `NOT_FOUND` | 资源不存在或不可访问 |
| `CONFLICT` | 版本、状态或重复操作冲突 |
| `PAYLOAD_TOO_LARGE` | 请求体或上传文件超过限制 |
| `INVALID_REQUEST` | 请求格式或 Content-Type 无效 |
| `RATE_LIMITED` | 请求频率超过限制 |
| `INVALID_PHONE` | 手机号格式或归属校验失败 |
| `INVALID_VERIFICATION_CODE` | 验证码无效、过期或尝试次数耗尽 |
| `INVALID_FILE` | 文件类型、内容或安全扫描不通过 |
| `INVALID_KYC` | KYC 资料不完整或不符合规则 |
| `INVALID_ARGUMENT` | 参数值无效 |
| `LOCALE_DISABLED` | 公司尚未启用请求的客户端语言 |
| `REQUEST_FAILED` | 其他可预期业务失败 |
| `SERVICE_UNAVAILABLE` | 服务、数据库或第三方依赖暂不可用 |

Flutter 示例：

```dart
final body = jsonDecode(response.body) as Map<String, dynamic>;
final code = body['code'] as String? ?? 'REQUEST_FAILED';
final message = errorMessages[locale]?[code] ?? errorMessages['en']![code]!;
```

服务端仍保留 `error` 字段，确保旧版 Web 客户端不立即失效；新客户端不得依赖其中的中文内容。
