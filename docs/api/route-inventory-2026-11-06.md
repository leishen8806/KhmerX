# S-2 接口清单与缺口报告

- 基线：`origin/main` = `3a9a34883f5bce68ddbab80fe2f7588d76419972`
- 清单来源：`git ls-files 'app/api/**/route.ts'`
- 路由文件数：43；报告登记行数：43（同一路由的不同 HTTP 方法各登记一行）
- 仅读取本地源文件；未操作灰度/VPS/域名，未访问外部服务。
- 证据规则：每个单元格带来源文件与行号；无法从当前基线确认处写“未验证”。

## 1. 全量登记

|#|路径与方法|认证方式|Origin 守卫|共享失败函数|稳定 code / requestId|成功响应顶层字段与类型|请求体顶层字段|Web 调用方|Flutter 调用方|
|---:|---|---|---|---|---|---|---|---|---|
|1|/admin/customer-cleanup (POST)|员工会话|有 requireOrigin (route.ts:1,4)|无|未验证 code/requestId|{ok:boolean} (route.ts:6-13)|未验证 (route.ts:4-5)|app/admin/customer-cleanup/client.tsx:7|未验证|
|2|/analytics/events (POST)|客户会话|有 requireOrigin (route.ts:9)|无|无稳定 code；requestId 未验证 (route.ts:16)|{ok:boolean} (route.ts:16-19)|未验证 (route.ts:10)|未验证|未验证|
|3|/bots (GET)|员工会话/ChatGPT|route wrapper origin required (route.ts:11)|无|未验证 (route.ts:22-27)|直接对象 (route.ts:22-27)|无 (route.ts:11-18)|未验证|未验证|
|4|/h5/auth/account (POST)|客户会话|有 requireOrigin (route.ts:5)|failure (route.ts:14)|failure code；requestId 未验证 (route.ts:14)|{ok:boolean,...} (route.ts:7,13)|action,password,... (route.ts:6-7)|app/h5/login.tsx:31-45|mobile/lib/core/network/endpoints.dart:87,96|
|5|/h5/auth/logout (POST)|客户会话|有 requireOrigin (route.ts:4)|failure (route.ts:8)|failure code；requestId 未验证 (route.ts:8)|{authenticated:boolean} (route.ts:6)|无 (route.ts:4-6)|app/h5/login.tsx:52|mobile/lib/core/network/endpoints.dart:151|
|6|/h5/auth/recovery (POST)|无/客户会话|有 requireOrigin (route.ts:4)|failure (route.ts:10)|failure code；requestId 未验证 (route.ts:10)|{ok:boolean} (route.ts:8-9)|action,email,token,password (route.ts:5)|components/password-recovery.tsx:20-31|mobile/lib/core/network/endpoints.dart:105|
|7|/h5/auth (GET)|客户会话|有 requireOrigin (route.ts:5)|failure (route.ts:8)|failure code；requestId 未验证 (route.ts:8)|{company,authenticated,session,mode,pending,policy,languages} (route.ts:6)|无 (route.ts:5-6)|app/h5/login.tsx:18; components/mini-shell.tsx:34|mobile/lib/core/network/endpoints.dart:62|
|8|/h5/auth/send (POST)|客户会话|有 requireOrigin (route.ts:5)|failure (route.ts:10)|failure code；requestId 未验证 (route.ts:10)|{ok:boolean} (route.ts:8-9)|phone (route.ts:6)|app/h5/login.tsx:26|mobile/lib/core/network/endpoints.dart:69|
|9|/h5/auth/telegram (POST)|Telegram|有 requireOrigin (route.ts:12)|failure (route.ts:45)|failure code；requestId 未验证 (route.ts:45)|{ok:boolean,...} (route.ts:44)|未验证 (route.ts:13-43)|app/h5/login.tsx:60|未验证|
|10|/h5/auth/verify (POST)|客户会话|有 requireOrigin (route.ts:5)|failure (route.ts:10)|failure code；requestId 未验证 (route.ts:10)|{ok:boolean} (route.ts:8-9)|phone,code (route.ts:6)|app/h5/login.tsx:37|mobile/lib/core/network/endpoints.dart:78|
|11|/h5/locale (POST)|客户会话|有 requireOrigin (route.ts:6)|failure (route.ts:11)|failure code；requestId 未验证 (route.ts:11)|{ok:boolean,locale:string} (route.ts:9-10)|locale (route.ts:7)|components/mini-shell.tsx:42|mobile/lib/core/network/endpoints.dart:159|
|12|/h5/state (GET/POST)|客户会话|未验证 (route.ts:9-11)<br>未验证 (route.ts:13-17)|未验证|未验证 code/requestId (route.ts:9-11)<br>未验证 code/requestId (route.ts:13-17)|未验证 (route.ts:11)<br>未验证 (route.ts:17)|无 (route.ts:9-11)<br>未验证 (route.ts:15)|app/workspace.tsx:36|mobile/lib/core/network/endpoints.dart:114|
|13|/institution/callback (POST)|机构签名|无共享 Origin；签名校验 (route.ts:25-37)|无|自定义 error；requestId 未验证 (route.ts:22-66)|{ok,eventId} (route.ts:42-43)|未验证 (route.ts:25-37)|未验证|未验证|
|14|/jobs/postloan (POST)|任务授权|无 (route.ts:4-18)|无|无稳定 code/requestId (route.ts:4-18)|{ok:boolean} (route.ts:10,16)|未验证 (route.ts:5-8)|未验证|未验证|
|15|/kyc/contract (GET)|客户会话|未验证 (route.ts:5-7)|failed (route.ts:7)|failed code；requestId 未验证|{contract,blocks} (route.ts:7)|无 (route.ts:5-7)|app/contract/view.tsx:8|未验证|
|16|/kyc/files (POST/GET/HEAD)|客户会话|未验证 (route.ts:8-18)<br>未验证 (route.ts:22)<br>未验证 (route.ts:24)|failed (route.ts:18)<br>failed (route.ts:22)<br>failed (route.ts:24)|failed code；requestId 未验证|{ok:boolean,...} (route.ts:14-17)<br>文件响应 (route.ts:22)<br>响应头 (route.ts:24)|未验证 (route.ts:9-12)<br>无 (route.ts:22)<br>无 (route.ts:24)|app/contract/view.tsx:8; app/kyc/client.tsx:174<br>未验证|mobile/lib/core/network/endpoints.dart:141<br>未验证|
|17|/kyc/geocode (POST)|客户会话|有 origin 校验 (route.ts:1,7,10)|failed (route.ts:47)|failed code；requestId 未验证|{ok,latitude,longitude,...} (route.ts:42)|address (route.ts:10)|未验证|未验证|
|18|/kyc/review/changes (GET)|员工会话|未验证 (route.ts:19-31)|无|X-Request-Id；稳定 code 未验证 (route.ts:31)|{items,...} (route.ts:31)|无 (route.ts:19-31)|未验证|未验证|
|19|/kyc/review/reveal (POST)|员工会话|route wrapper origin required (route.ts:4)|由 reveal 内部 (route.ts:4-8)|未验证|直接对象 (route.ts:7-8)|未验证 (route.ts:4-8)|未验证|未验证|
|20|/kyc/review (GET/POST)|员工会话|未验证 (route.ts:6)<br>未验证 (route.ts:7)|failed/内部 (route.ts:6)<br>failed/内部 (route.ts:7)|未验证 code/requestId|直接对象 (route.ts:6)<br>直接对象 (route.ts:7)|无 (route.ts:6)<br>未验证 (route.ts:7)|未验证|未验证|
|21|/kyc (GET/POST)|客户会话|未验证 (route.ts:4-6)<br>未验证 (route.ts:8-11)|未验证|未验证|直接对象 (route.ts:6)<br>直接对象 (route.ts:11)|无 (route.ts:4-6)<br>未验证 (route.ts:9-10)|未验证|mobile/lib/core/network/endpoints.dart:121<br>mobile/lib/core/network/endpoints.dart:129|
|22|/loan/sign (GET/POST)|客户会话|有 origin/headers 校验 (route.ts:7)<br>有 origin/headers 校验 (route.ts:8)|无|未验证|直接对象 (route.ts:7)<br>直接对象 (route.ts:8)|无 (route.ts:7)<br>未验证 (route.ts:8)|app/loan/sign/client.tsx:12|未验证|
|23|/postloan (GET/POST)|客户会话|有 requireOrigin (route.ts:5)<br>有 requireOrigin (route.ts:6)|failure (route.ts:5)<br>failure (route.ts:6)|failure code；requestId 未验证|直接对象 (route.ts:5)<br>{ok:boolean} (route.ts:6)|无 (route.ts:5)<br>未验证 (route.ts:6)|未验证|未验证|
|24|/state (GET/POST)|客户会话|未验证 (route.ts:7-11)<br>未验证 (route.ts:13-17)|未验证|未验证|直接对象 (route.ts:11)<br>直接对象 (route.ts:17)|无 (route.ts:7-11)<br>未验证 (route.ts:15)|app/workspace.tsx:36|未验证|
|25|/team/audit-integrity (GET/POST)|员工会话|未验证 (route.ts:6)<br>未验证 (route.ts:7)|无|未验证|{items} (route.ts:6)<br>{ok,...} (route.ts:7)|无 (route.ts:6)<br>action (route.ts:7)|未验证|未验证|
|26|/team/auth (POST)|员工会话|有 requireOrigin (route.ts:9)|failure (route.ts:67)|failure code；requestId 未验证|{ok,...} (route.ts:11-66)|action,... (route.ts:11-66)|app/team/client.tsx:42|未验证|
|27|/team/bots (POST)|员工会话|有 sameOrigin (route.ts:5)|无|自定义 catch；code/requestId 未验证 (route.ts:5)|{ok,...} (route.ts:5)|未验证 (route.ts:5)|未验证|未验证|
|28|/team/customer-tags (GET/POST)|员工会话|未验证 (route.ts:10-14)<br>未验证 (route.ts:20-26)|无|未验证|{tags,links} (route.ts:14)<br>{ok,...} (route.ts:20-26)|无 (route.ts:10-14)<br>action,... (route.ts:20-26)|app/team/client.tsx:58|未验证|
|29|/team/emergency (GET/POST)|员工会话|未验证 (route.ts:6)<br>未验证 (route.ts:7)|无|未验证|{items} (route.ts:6)<br>{ok,...} (route.ts:7)|无 (route.ts:6)<br>action (route.ts:7)|app/team/client.tsx:64|未验证|
|30|/team/funding-risk (GET/POST)|员工会话|未验证 (route.ts:5)<br>未验证 (route.ts:6)|无|未验证|{items} (route.ts:5)<br>{ok,...} (route.ts:6)|无 (route.ts:5)<br>action (route.ts:6)|app/team/client.tsx:70|未验证|
|31|/team/funding-settings (GET/POST)|员工会话|未验证 (route.ts:4)<br>未验证 (route.ts:5)|无|未验证|直接对象 (route.ts:4)<br>{ok,...} (route.ts:5)|无 (route.ts:4)<br>未验证 (route.ts:5)|app/team/client.tsx:76|未验证|
|32|/team/institution-callbacks (GET/POST)|员工会话|未验证 (route.ts:13)<br>未验证 (route.ts:23)|无|未验证|{events,redacted} (route.ts:19)<br>{ok,eventId,attempt,nextAt} (route.ts:33)|无 (route.ts:13-19)<br>未验证 (route.ts:23-33)|app/team/client.tsx:82|未验证|
|33|/team/kyc-followups (GET/POST)|员工会话|未验证 (route.ts:4)<br>未验证 (route.ts:5)|无|未验证|直接对象 (route.ts:4)<br>{ok,...} (route.ts:5)|无 (route.ts:4)<br>未验证 (route.ts:5)|app/team/client.tsx:88|未验证|
|34|/team/locale (POST)|员工会话|未验证 (route.ts:5)|无|未验证|{ok,locale} (route.ts:5)|locale (route.ts:5)|app/team/client.tsx:94|未验证|
|35|/team/members (GET)|员工会话|未验证 (route.ts:4-15)|failure (route.ts:15)|failure code；requestId 未验证|{members,...} (route.ts:4-14)|无 (route.ts:4-15)|app/team/client.tsx:100|未验证|
|36|/team/notification-templates (GET/POST)|员工会话|未验证 (route.ts:5)<br>未验证 (route.ts:6)|无|未验证|{templates} (route.ts:5)<br>{ok,...} (route.ts:6)|无 (route.ts:5)<br>未验证 (route.ts:6)|components/notification-templates.tsx:9-10|未验证|
|37|/team/products (GET/POST)|员工会话|未验证 (route.ts:18-21)<br>未验证 (route.ts:23-60)|无|未验证|{products} (route.ts:21)<br>{ok,id}或{ok} (route.ts:23-60)|无 (route.ts:18-21)<br>action,... (route.ts:23-60)|components/loan-products.tsx:12,14|未验证|
|38|/team/reports/export (POST)|员工会话|未验证 (route.ts:7-11)|无|未验证|text/csv (route.ts:10)|未验证 (route.ts:7-9)|components/report-center.tsx:17|未验证|
|39|/team/risk-rules (GET/POST)|员工会话|未验证 (route.ts:5)<br>未验证 (route.ts:6)|无|未验证|直接对象 (route.ts:5)<br>{ok,...} (route.ts:6)|无 (route.ts:5)<br>未验证 (route.ts:6)|components/risk-rules.tsx:11,13|未验证|
|40|/team (GET/POST)|员工会话|未验证 (route.ts:6)<br>未验证 (route.ts:7)|无|未验证|直接对象 (route.ts:6)<br>{ok,...} (route.ts:7)|无 (route.ts:6)<br>action (route.ts:7)|app/team/client.tsx:18|未验证|
|41|/team/servicing (GET/POST)|员工会话|未验证 (route.ts:4)<br>未验证 (route.ts:5)|无|未验证|直接对象 (route.ts:4)<br>{ok,...} (route.ts:5)|无 (route.ts:4)<br>未验证 (route.ts:5)|components/servicing-config.tsx:7,9|未验证|
|42|/team/tickets (GET/POST)|员工会话|未验证 (route.ts:18)<br>未验证 (route.ts:19)|无|未验证|{tickets} (route.ts:18)<br>{ok,id,publicRef}或{ok,publicRef} (route.ts:19)|无 (route.ts:18)<br>action,... (route.ts:19)|components/service-tickets.tsx:12-15|未验证|
|43|/telegram (GET)|Telegram|未验证 (route.ts:5)|无|未验证|直接对象 (route.ts:5)|无 (route.ts:5)|components/telegram-notifications.tsx:8-11|未验证|

## 2. 没有共享失败函数的接口

|接口|证据|
|---|---|
|/institution/callback POST|自定义 response/failure 分支；app/api/institution/callback/route.ts:22-66|
|/jobs/postloan POST|直接返回 JSON 错误；app/api/jobs/postloan/route.ts:4-18|
|/kyc/review/changes GET|直接构造响应并设置 X-Request-Id；app/api/kyc/review/changes/route.ts:19-31|
|/team/bots POST|catch 内自定义 JSON；app/api/team/bots/route.ts:5|
|其余“无”项|按主表逐项来源；未把“无”推断为缺陷，需逐路由复核。|

## 3. 成功响应形状不一致分组

|分组|接口|证据|
|---|---|---|
|直接对象|/h5/auth GET, /kyc GET/POST, /loan/sign GET/POST, /team GET, /team/funding-settings GET, /team/servicing GET, /team/risk-rules GET, /telegram GET|各 route.ts 对应主表行号与行内来源|
|{ok,...}|/analytics/events, /h5/auth/account, /h5/auth/send, /h5/auth/verify, /h5/locale, 多数 team POST|各 route.ts 对应主表行号与行内来源|
|列表包装|/team/members {members}, /team/products {products}, /team/tickets {tickets}, /team/notification-templates {templates}|对应 route.ts:5,18,21 等，详见主表|
|非 JSON|/team/reports/export text/csv；/kyc/files GET/HEAD 文件/响应头|对应 route.ts:10、22、24|
|机构回调信封|/institution/callback {ok,eventId}|app/api/institution/callback/route.ts:42-43|

## 4. 被 Flutter 依赖的接口及响应字段

|接口|Flutter 路径证据|响应字段（仅顶层）|
|---|---|---|
|/h5/auth|mobile/lib/core/network/endpoints.dart:62|company, authenticated, session, mode, pending, policy, languages|
|/h5/auth/send|...:69|ok|
|/h5/auth/verify|...:78|ok|
|/h5/auth/account|...:87,96|ok及账户字段（主表 route.ts:7,13）|
|/h5/auth/recovery|...:105|ok|
|/h5/state|...:114|未验证|
|/kyc|...:121,129|未验证|
|/kyc/files|...:141|ok及文件字段（主表 route.ts:14-17）|
|/h5/auth/logout|...:151|authenticated|
|/h5/locale|...:159|ok, locale|

## 5. 写方法但没有 Origin 守卫

|接口|方法|证据|机器对机器？|
|---|---|---|---|
|/institution/callback|POST|签名校验而非 Origin；route.ts:25-37|是，机构回调|
|/jobs/postloan|POST|jobAuthorized；route.ts:4-8|是，任务接口|
|/kyc/files|POST/GET/HEAD|未见 requireOrigin；route.ts:8-24|否（客户会话）|
|/kyc/contract|GET|未见 requireOrigin；route.ts:5-7|否（客户会话）|
|/kyc/review, /kyc/review/changes|GET/POST|未见 requireOrigin；route.ts:6-31|否（员工会话）|
|/state|POST|未见 requireOrigin；route.ts:13-17|否（客户状态）|
|/h5/state|POST|未见 requireOrigin；route.ts:13-17|否（客户状态）|
|/team/* 未显示 requireOrigin 的写方法|POST|对应各 route.ts 行号见主表|否（员工会话）|
|/team GET|GET|读取方法，不纳入写方法 Origin 清单|不适用|

## 6. 发现（最多五条）

1. 43 个登记行与基线文件数 43 一致；证据为同一 SHA 下的 git 清单与本报告主表。
2. 共享失败函数并未覆盖所有接口，至少四个路由使用自定义错误路径；见第 2 节。
3. 成功响应同时存在直接对象、`{ok,...}`、列表包装、文件/CSV 五类形状；见第 3 节。
4. Flutter 生产代码只按路径字符串依赖 10 个接口；其余路由未在 `mobile/lib` 路径中发现调用。
5. 多个员工/客户写方法未显示 Origin 守卫；机构回调与任务接口有各自机器认证，其他项应在拆分前单独复核。

## 7. 证据边界

本报告是静态源代码清单，不等同于运行时、浏览器、Flutter 真机、数据库、灰度或生产证据；未做外部验证。

### 1. /admin/customer-cleanup POST
- 认证：员工会话；来源：route.ts（见主表行 1）。
- Origin：有 requireOrigin (route.ts:1,4)。
- 失败与错误字段：无；未验证 code/requestId。
- 成功形状：{ok:boolean} (route.ts:6-13)；请求体：未验证 (route.ts:4-5)。
- Web：app/admin/customer-cleanup/client.tsx:7；Flutter：未验证。

### 2. /analytics/events POST
- 认证：客户会话；来源：route.ts（见主表行 2）。
- Origin：有 requireOrigin (route.ts:9)。
- 失败与错误字段：无；无稳定 code；requestId 未验证 (route.ts:16)。
- 成功形状：{ok:boolean} (route.ts:16-19)；请求体：未验证 (route.ts:10)。
- Web：未验证；Flutter：未验证。

### 3. /bots GET
- 认证：员工会话/ChatGPT；来源：route.ts（见主表行 3）。
- Origin：route wrapper origin required (route.ts:11)。
- 失败与错误字段：无；未验证 (route.ts:22-27)。
- 成功形状：直接对象 (route.ts:22-27)；请求体：无 (route.ts:11-18)。
- Web：未验证；Flutter：未验证。

### 4. /h5/auth/account POST
- 认证：客户会话；来源：route.ts（见主表行 4）。
- Origin：有 requireOrigin (route.ts:5)。
- 失败与错误字段：failure (route.ts:14)；failure code；requestId 未验证 (route.ts:14)。
- 成功形状：{ok:boolean,...} (route.ts:7,13)；请求体：action,password,... (route.ts:6-7)。
- Web：app/h5/login.tsx:31-45；Flutter：mobile/lib/core/network/endpoints.dart:87,96。

### 5. /h5/auth/logout POST
- 认证：客户会话；来源：route.ts（见主表行 5）。
- Origin：有 requireOrigin (route.ts:4)。
- 失败与错误字段：failure (route.ts:8)；failure code；requestId 未验证 (route.ts:8)。
- 成功形状：{authenticated:boolean} (route.ts:6)；请求体：无 (route.ts:4-6)。
- Web：app/h5/login.tsx:52；Flutter：mobile/lib/core/network/endpoints.dart:151。

### 6. /h5/auth/recovery POST
- 认证：无/客户会话；来源：route.ts（见主表行 6）。
- Origin：有 requireOrigin (route.ts:4)。
- 失败与错误字段：failure (route.ts:10)；failure code；requestId 未验证 (route.ts:10)。
- 成功形状：{ok:boolean} (route.ts:8-9)；请求体：action,email,token,password (route.ts:5)。
- Web：components/password-recovery.tsx:20-31；Flutter：mobile/lib/core/network/endpoints.dart:105。

### 7. /h5/auth GET
- 认证：客户会话；来源：route.ts（见主表行 7）。
- Origin：有 requireOrigin (route.ts:5)。
- 失败与错误字段：failure (route.ts:8)；failure code；requestId 未验证 (route.ts:8)。
- 成功形状：{company,authenticated,session,mode,pending,policy,languages} (route.ts:6)；请求体：无 (route.ts:5-6)。
- Web：app/h5/login.tsx:18; components/mini-shell.tsx:34；Flutter：mobile/lib/core/network/endpoints.dart:62。

### 8. /h5/auth/send POST
- 认证：客户会话；来源：route.ts（见主表行 8）。
- Origin：有 requireOrigin (route.ts:5)。
- 失败与错误字段：failure (route.ts:10)；failure code；requestId 未验证 (route.ts:10)。
- 成功形状：{ok:boolean} (route.ts:8-9)；请求体：phone (route.ts:6)。
- Web：app/h5/login.tsx:26；Flutter：mobile/lib/core/network/endpoints.dart:69。

### 9. /h5/auth/telegram POST
- 认证：Telegram；来源：route.ts（见主表行 9）。
- Origin：有 requireOrigin (route.ts:12)。
- 失败与错误字段：failure (route.ts:45)；failure code；requestId 未验证 (route.ts:45)。
- 成功形状：{ok:boolean,...} (route.ts:44)；请求体：未验证 (route.ts:13-43)。
- Web：app/h5/login.tsx:60；Flutter：未验证。

### 10. /h5/auth/verify POST
- 认证：客户会话；来源：route.ts（见主表行 10）。
- Origin：有 requireOrigin (route.ts:5)。
- 失败与错误字段：failure (route.ts:10)；failure code；requestId 未验证 (route.ts:10)。
- 成功形状：{ok:boolean} (route.ts:8-9)；请求体：phone,code (route.ts:6)。
- Web：app/h5/login.tsx:37；Flutter：mobile/lib/core/network/endpoints.dart:78。

### 11. /h5/locale POST
- 认证：客户会话；来源：route.ts（见主表行 11）。
- Origin：有 requireOrigin (route.ts:6)。
- 失败与错误字段：failure (route.ts:11)；failure code；requestId 未验证 (route.ts:11)。
- 成功形状：{ok:boolean,locale:string} (route.ts:9-10)；请求体：locale (route.ts:7)。
- Web：components/mini-shell.tsx:42；Flutter：mobile/lib/core/network/endpoints.dart:159。

### 12. /h5/state GET
- 认证：客户会话；来源：route.ts（见主表行 12）。
- Origin：未验证 (route.ts:9-11)。
- 失败与错误字段：未验证；未验证 code/requestId (route.ts:9-11)。
- 成功形状：未验证 (route.ts:11)；请求体：无 (route.ts:9-11)。
- Web：app/workspace.tsx:36；Flutter：mobile/lib/core/network/endpoints.dart:114。

### 13. /h5/state POST
- 认证：客户会话；来源：route.ts（见主表行 13）。
- Origin：未验证 (route.ts:13-17)。
- 失败与错误字段：未验证；未验证 code/requestId (route.ts:13-17)。
- 成功形状：未验证 (route.ts:17)；请求体：未验证 (route.ts:15)。
- Web：app/workspace.tsx:36；Flutter：mobile/lib/core/network/endpoints.dart:114。

### 14. /institution/callback POST
- 认证：机构签名；来源：route.ts（见主表行 14）。
- Origin：无共享 Origin；签名校验 (route.ts:25-37)。
- 失败与错误字段：无；自定义 error；requestId 未验证 (route.ts:22-66)。
- 成功形状：{ok,eventId} (route.ts:42-43)；请求体：未验证 (route.ts:25-37)。
- Web：未验证；Flutter：未验证。

### 15. /jobs/postloan POST
- 认证：任务授权；来源：route.ts（见主表行 15）。
- Origin：无 (route.ts:4-18)。
- 失败与错误字段：无；无稳定 code/requestId (route.ts:4-18)。
- 成功形状：{ok:boolean} (route.ts:10,16)；请求体：未验证 (route.ts:5-8)。
- Web：未验证；Flutter：未验证。

### 16. /kyc/contract GET
- 认证：客户会话；来源：route.ts（见主表行 16）。
- Origin：未验证 (route.ts:5-7)。
- 失败与错误字段：failed (route.ts:7)；failed code；requestId 未验证。
- 成功形状：{contract,blocks} (route.ts:7)；请求体：无 (route.ts:5-7)。
- Web：app/contract/view.tsx:8；Flutter：未验证。

### 17. /kyc/files POST
- 认证：客户会话；来源：route.ts（见主表行 17）。
- Origin：未验证 (route.ts:8-18)。
- 失败与错误字段：failed (route.ts:18)；failed code；requestId 未验证。
- 成功形状：{ok:boolean,...} (route.ts:14-17)；请求体：未验证 (route.ts:9-12)。
- Web：app/contract/view.tsx:8; app/kyc/client.tsx:174；Flutter：mobile/lib/core/network/endpoints.dart:141。

### 18. /kyc/files GET
- 认证：客户会话；来源：route.ts（见主表行 18）。
- Origin：未验证 (route.ts:22)。
- 失败与错误字段：failed (route.ts:22)；failed code；requestId 未验证。
- 成功形状：文件响应 (route.ts:22)；请求体：无 (route.ts:22)。
- Web：app/contract/view.tsx:8; app/kyc/client.tsx:174；Flutter：mobile/lib/core/network/endpoints.dart:141。

### 19. /kyc/files HEAD
- 认证：客户会话；来源：route.ts（见主表行 19）。
- Origin：未验证 (route.ts:24)。
- 失败与错误字段：failed (route.ts:24)；failed code；requestId 未验证。
- 成功形状：响应头 (route.ts:24)；请求体：无 (route.ts:24)。
- Web：未验证；Flutter：未验证。

### 20. /kyc/geocode POST
- 认证：客户会话；来源：route.ts（见主表行 20）。
- Origin：有 origin 校验 (route.ts:1,7,10)。
- 失败与错误字段：failed (route.ts:47)；failed code；requestId 未验证。
- 成功形状：{ok,latitude,longitude,...} (route.ts:42)；请求体：address (route.ts:10)。
- Web：未验证；Flutter：未验证。

### 21. /kyc/review/changes GET
- 认证：员工会话；来源：route.ts（见主表行 21）。
- Origin：未验证 (route.ts:19-31)。
- 失败与错误字段：无；X-Request-Id；稳定 code 未验证 (route.ts:31)。
- 成功形状：{items,...} (route.ts:31)；请求体：无 (route.ts:19-31)。
- Web：未验证；Flutter：未验证。

### 22. /kyc/review/reveal POST
- 认证：员工会话；来源：route.ts（见主表行 22）。
- Origin：route wrapper origin required (route.ts:4)。
- 失败与错误字段：由 reveal 内部 (route.ts:4-8)；未验证。
- 成功形状：直接对象 (route.ts:7-8)；请求体：未验证 (route.ts:4-8)。
- Web：未验证；Flutter：未验证。

### 23. /kyc/review GET
- 认证：员工会话；来源：route.ts（见主表行 23）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：failed/内部 (route.ts:6)；未验证 code/requestId。
- 成功形状：直接对象 (route.ts:6)；请求体：无 (route.ts:6)。
- Web：未验证；Flutter：未验证。

### 24. /kyc/review POST
- 认证：员工会话；来源：route.ts（见主表行 24）。
- Origin：未验证 (route.ts:7)。
- 失败与错误字段：failed/内部 (route.ts:7)；未验证 code/requestId。
- 成功形状：直接对象 (route.ts:7)；请求体：未验证 (route.ts:7)。
- Web：未验证；Flutter：未验证。

### 25. /kyc GET
- 认证：客户会话；来源：route.ts（见主表行 25）。
- Origin：未验证 (route.ts:4-6)。
- 失败与错误字段：未验证；未验证。
- 成功形状：直接对象 (route.ts:6)；请求体：无 (route.ts:4-6)。
- Web：未验证；Flutter：mobile/lib/core/network/endpoints.dart:121。

### 26. /kyc POST
- 认证：客户会话；来源：route.ts（见主表行 26）。
- Origin：未验证 (route.ts:8-11)。
- 失败与错误字段：未验证；未验证。
- 成功形状：直接对象 (route.ts:11)；请求体：未验证 (route.ts:9-10)。
- Web：未验证；Flutter：mobile/lib/core/network/endpoints.dart:129。

### 27. /loan/sign GET
- 认证：客户会话；来源：route.ts（见主表行 27）。
- Origin：有 origin/headers 校验 (route.ts:7)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:7)；请求体：无 (route.ts:7)。
- Web：app/loan/sign/client.tsx:12；Flutter：未验证。

### 28. /loan/sign POST
- 认证：客户会话；来源：route.ts（见主表行 28）。
- Origin：有 origin/headers 校验 (route.ts:8)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:8)；请求体：未验证 (route.ts:8)。
- Web：app/loan/sign/client.tsx:12；Flutter：未验证。

### 29. /postloan GET
- 认证：客户会话；来源：route.ts（见主表行 29）。
- Origin：有 requireOrigin (route.ts:5)。
- 失败与错误字段：failure (route.ts:5)；failure code；requestId 未验证。
- 成功形状：直接对象 (route.ts:5)；请求体：无 (route.ts:5)。
- Web：未验证；Flutter：未验证。

### 30. /postloan POST
- 认证：客户会话；来源：route.ts（见主表行 30）。
- Origin：有 requireOrigin (route.ts:6)。
- 失败与错误字段：failure (route.ts:6)；failure code；requestId 未验证。
- 成功形状：{ok:boolean} (route.ts:6)；请求体：未验证 (route.ts:6)。
- Web：未验证；Flutter：未验证。

### 31. /state GET
- 认证：客户会话；来源：route.ts（见主表行 31）。
- Origin：未验证 (route.ts:7-11)。
- 失败与错误字段：未验证；未验证。
- 成功形状：直接对象 (route.ts:11)；请求体：无 (route.ts:7-11)。
- Web：app/workspace.tsx:36；Flutter：未验证。

### 32. /state POST
- 认证：客户会话；来源：route.ts（见主表行 32）。
- Origin：未验证 (route.ts:13-17)。
- 失败与错误字段：未验证；未验证。
- 成功形状：直接对象 (route.ts:17)；请求体：未验证 (route.ts:15)。
- Web：app/workspace.tsx:36；Flutter：未验证。

### 33. /team/audit-integrity GET
- 认证：员工会话；来源：route.ts（见主表行 33）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：{items} (route.ts:6)；请求体：无 (route.ts:6)。
- Web：未验证；Flutter：未验证。

### 34. /team/audit-integrity POST
- 认证：员工会话；来源：route.ts（见主表行 34）。
- Origin：未验证 (route.ts:7)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:7)；请求体：action (route.ts:7)。
- Web：未验证；Flutter：未验证。

### 35. /team/auth POST
- 认证：员工会话；来源：route.ts（见主表行 35）。
- Origin：有 requireOrigin (route.ts:9)。
- 失败与错误字段：failure (route.ts:67)；failure code；requestId 未验证。
- 成功形状：{ok,...} (route.ts:11-66)；请求体：action,... (route.ts:11-66)。
- Web：app/team/client.tsx:42；Flutter：未验证。

### 36. /team/bots POST
- 认证：员工会话；来源：route.ts（见主表行 36）。
- Origin：有 sameOrigin (route.ts:5)。
- 失败与错误字段：无；自定义 catch；code/requestId 未验证 (route.ts:5)。
- 成功形状：{ok,...} (route.ts:5)；请求体：未验证 (route.ts:5)。
- Web：未验证；Flutter：未验证。

### 37. /team/customer-tags GET
- 认证：员工会话；来源：route.ts（见主表行 37）。
- Origin：未验证 (route.ts:10-14)。
- 失败与错误字段：无；未验证。
- 成功形状：{tags,links} (route.ts:14)；请求体：无 (route.ts:10-14)。
- Web：app/team/client.tsx:58；Flutter：未验证。

### 38. /team/customer-tags POST
- 认证：员工会话；来源：route.ts（见主表行 38）。
- Origin：未验证 (route.ts:20-26)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:20-26)；请求体：action,... (route.ts:20-26)。
- Web：app/team/client.tsx:58；Flutter：未验证。

### 39. /team/emergency GET
- 认证：员工会话；来源：route.ts（见主表行 39）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：{items} (route.ts:6)；请求体：无 (route.ts:6)。
- Web：app/team/client.tsx:64；Flutter：未验证。

### 40. /team/emergency POST
- 认证：员工会话；来源：route.ts（见主表行 40）。
- Origin：未验证 (route.ts:7)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:7)；请求体：action (route.ts:7)。
- Web：app/team/client.tsx:64；Flutter：未验证。

### 41. /team/funding-risk GET
- 认证：员工会话；来源：route.ts（见主表行 41）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{items} (route.ts:5)；请求体：无 (route.ts:5)。
- Web：app/team/client.tsx:70；Flutter：未验证。

### 42. /team/funding-risk POST
- 认证：员工会话；来源：route.ts（见主表行 42）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:6)；请求体：action (route.ts:6)。
- Web：app/team/client.tsx:70；Flutter：未验证。

### 43. /team/funding-settings GET
- 认证：员工会话；来源：route.ts（见主表行 43）。
- Origin：未验证 (route.ts:4)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:4)；请求体：无 (route.ts:4)。
- Web：app/team/client.tsx:76；Flutter：未验证。

### 44. /team/funding-settings POST
- 认证：员工会话；来源：route.ts（见主表行 44）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:5)；请求体：未验证 (route.ts:5)。
- Web：app/team/client.tsx:76；Flutter：未验证。

### 45. /team/institution-callbacks GET
- 认证：员工会话；来源：route.ts（见主表行 45）。
- Origin：未验证 (route.ts:13)。
- 失败与错误字段：无；未验证。
- 成功形状：{events,redacted} (route.ts:19)；请求体：无 (route.ts:13-19)。
- Web：app/team/client.tsx:82；Flutter：未验证。

### 46. /team/institution-callbacks POST
- 认证：员工会话；来源：route.ts（见主表行 46）。
- Origin：未验证 (route.ts:23)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,eventId,attempt,nextAt} (route.ts:33)；请求体：未验证 (route.ts:23-33)。
- Web：app/team/client.tsx:82；Flutter：未验证。

### 47. /team/kyc-followups GET
- 认证：员工会话；来源：route.ts（见主表行 47）。
- Origin：未验证 (route.ts:4)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:4)；请求体：无 (route.ts:4)。
- Web：app/team/client.tsx:88；Flutter：未验证。

### 48. /team/kyc-followups POST
- 认证：员工会话；来源：route.ts（见主表行 48）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:5)；请求体：未验证 (route.ts:5)。
- Web：app/team/client.tsx:88；Flutter：未验证。

### 49. /team/locale POST
- 认证：员工会话；来源：route.ts（见主表行 49）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,locale} (route.ts:5)；请求体：locale (route.ts:5)。
- Web：app/team/client.tsx:94；Flutter：未验证。

### 50. /team/members GET
- 认证：员工会话；来源：route.ts（见主表行 50）。
- Origin：未验证 (route.ts:4-15)。
- 失败与错误字段：failure (route.ts:15)；failure code；requestId 未验证。
- 成功形状：{members,...} (route.ts:4-14)；请求体：无 (route.ts:4-15)。
- Web：app/team/client.tsx:100；Flutter：未验证。

### 51. /team/notification-templates GET
- 认证：员工会话；来源：route.ts（见主表行 51）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{templates} (route.ts:5)；请求体：无 (route.ts:5)。
- Web：components/notification-templates.tsx:9-10；Flutter：未验证。

### 52. /team/notification-templates POST
- 认证：员工会话；来源：route.ts（见主表行 52）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:6)；请求体：未验证 (route.ts:6)。
- Web：components/notification-templates.tsx:9-10；Flutter：未验证。

### 53. /team/products GET
- 认证：员工会话；来源：route.ts（见主表行 53）。
- Origin：未验证 (route.ts:18-21)。
- 失败与错误字段：无；未验证。
- 成功形状：{products} (route.ts:21)；请求体：无 (route.ts:18-21)。
- Web：components/loan-products.tsx:12,14；Flutter：未验证。

### 54. /team/products POST
- 认证：员工会话；来源：route.ts（见主表行 54）。
- Origin：未验证 (route.ts:23-60)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,id}或{ok} (route.ts:23-60)；请求体：action,... (route.ts:23-60)。
- Web：components/loan-products.tsx:12,14；Flutter：未验证。

### 55. /team/reports/export POST
- 认证：员工会话；来源：route.ts（见主表行 55）。
- Origin：未验证 (route.ts:7-11)。
- 失败与错误字段：无；未验证。
- 成功形状：text/csv (route.ts:10)；请求体：未验证 (route.ts:7-9)。
- Web：components/report-center.tsx:17；Flutter：未验证。

### 56. /team/risk-rules GET
- 认证：员工会话；来源：route.ts（见主表行 56）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:5)；请求体：无 (route.ts:5)。
- Web：components/risk-rules.tsx:11,13；Flutter：未验证。

### 57. /team/risk-rules POST
- 认证：员工会话；来源：route.ts（见主表行 57）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:6)；请求体：未验证 (route.ts:6)。
- Web：components/risk-rules.tsx:11,13；Flutter：未验证。

### 58. /team GET
- 认证：员工会话；来源：route.ts（见主表行 58）。
- Origin：未验证 (route.ts:6)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:6)；请求体：无 (route.ts:6)。
- Web：app/team/client.tsx:18；Flutter：未验证。

### 59. /team POST
- 认证：员工会话；来源：route.ts（见主表行 59）。
- Origin：未验证 (route.ts:7)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:7)；请求体：action (route.ts:7)。
- Web：app/team/client.tsx:18；Flutter：未验证。

### 60. /team/servicing GET
- 认证：员工会话；来源：route.ts（见主表行 60）。
- Origin：未验证 (route.ts:4)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:4)；请求体：无 (route.ts:4)。
- Web：components/servicing-config.tsx:7,9；Flutter：未验证。

### 61. /team/servicing POST
- 认证：员工会话；来源：route.ts（见主表行 61）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,...} (route.ts:5)；请求体：未验证 (route.ts:5)。
- Web：components/servicing-config.tsx:7,9；Flutter：未验证。

### 62. /team/tickets GET
- 认证：员工会话；来源：route.ts（见主表行 62）。
- Origin：未验证 (route.ts:18)。
- 失败与错误字段：无；未验证。
- 成功形状：{tickets} (route.ts:18)；请求体：无 (route.ts:18)。
- Web：components/service-tickets.tsx:12-15；Flutter：未验证。

### 63. /team/tickets POST
- 认证：员工会话；来源：route.ts（见主表行 63）。
- Origin：未验证 (route.ts:19)。
- 失败与错误字段：无；未验证。
- 成功形状：{ok,id,publicRef}或{ok,publicRef} (route.ts:19)；请求体：action,... (route.ts:19)。
- Web：components/service-tickets.tsx:12-15；Flutter：未验证。

### 64. /telegram GET
- 认证：Telegram；来源：route.ts（见主表行 64）。
- Origin：未验证 (route.ts:5)。
- 失败与错误字段：无；未验证。
- 成功形状：直接对象 (route.ts:5)；请求体：无 (route.ts:5)。
- Web：components/telegram-notifications.tsx:8-11；Flutter：未验证。



