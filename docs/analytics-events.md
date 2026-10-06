# PayEase 第一方数据埋点

埋点接口：`POST /api/analytics/events`，只接受同源、已登录客户请求。事件写入 `analytics_events`，不接入第三方统计平台。

## 记录原则

- 不记录原始手机号、姓名、身份证号、银行卡号、地址、文件名或文件内容。
- `customer_id` 仅用于同一客户的漏斗统计；前端会话标识只作为属性保存。
- 每个客户每分钟最多写入 120 条事件，异常请求静默丢弃，不阻断业务流程。
- 事件属性限制为简单字符串、数字和布尔值，并限制数量与长度。

## 当前事件

`page_view`、`mini_nav_home`、`mini_nav_records`、`mini_nav_profile`、`kyc_step_view`、`kyc_step_complete`、`kyc_file_select`、`kyc_file_upload_success`、`kyc_file_upload_failed`、`kyc_submit`、`loan_apply_start`、`loan_bill_confirm`、`loan_signature_saved`、`loan_submitted`、`telegram_notification_sent`、`telegram_notification_failed`。

## 数据表

`analytics_events` 使用现有 `tenant_id / customer_id / event_name / locale / screen / properties / created_at` 字段结构，兼容 VPS 已有历史数据。
