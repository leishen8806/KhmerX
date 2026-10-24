# P2 · 手机上完成实名资料（KYC）· 契约

```
Document:  76-P2-kyc-contract.md          Date: 2026-10-12
Owner:     Claude（契约）                  Implementer: 按业主指示由 Claude 本轮实现
Status:    IMPLEMENTED（2026-10-12，模拟器 + 本地后端实测）；待 Codex 独立验收
Basis:     真实后端代码（app/api/kyc/*、lib/kyc/core.ts、lib/kyc/server.ts、lib/kyc/options.json）· 55（P2 定义）· 54（公共入口）
Backend:   无需新增后端接口（沿用现有 /api/kyc*）
```

## 1. 目标
任何已登录用户在 APP 里完成**人工审核用**的实名资料：填写资料 → 上传材料 → 提交 → 查看审核结果 → 被要求补件时修改并重新提交。**不做**外部身份核验、活体、银行校验（后端明示"未接入"）。

## 2. 范围
**包含**：状态总览；5 个表单分组（个人与身份、紧急联系人、工作与资产、收款账户、授权确认）；材料上传（拍照 / 相册）；保存草稿；提交；`needs_info` 补件重提；`submitted` / `approved` / `rejected` 只读展示。
**不包含**：手写签名（属于贷款签约，P3）、定位上报与 geocode（可选，后续）、员工审核、深链。

## 3. 后端接口（现状事实）
| 动作 | 请求 | 说明 |
|---|---|---|
| 读取 | `GET /api/kyc` | 返回案件视图：`id, revision, status, updatedAt, profile{values, files{slot→FileRef}, consent, declarationVersion}, phoneVerified, ruleVersion, missing[], review?{decision,reason}, score` |
| 保存 / 提交 | `POST /api/kyc`，JSON ≤ 50000 字节，`{action:"save"\|"submit", revision, profile:{values, files:{slot:{id}}, consent, declarationVersion}}` | 仅 `draft` / `needs_info` 可写，否则 409；`revision` 必须等于最新值，否则 409；提交前服务端校验必填，缺项返回错误文案 |
| 上传材料 | `POST /api/kyc/files`，请求头 `x-kyc-slot: <slot>`，**请求体为文件原始字节**，≤ 10 MB | 返回 `FileRef{id,slot,name,type,size,sha256}`；字节完全相同会复用旧记录（重试安全）；每客户最多 40 份；经安全扫描（本地测试模式跳过） |
| 同源 | 所有写请求带 `Origin`（与 APP 其它请求一致） | |
- 状态：`draft`（可编辑）· `submitted`（待人工审核，只读）· `needs_info`（待补件，可编辑，显示审核意见）· `approved`（通过，只读）· `rejected`（未通过，终态，**P2 不提供重新申请**，见 CR-010）。
- 字段值是服务端校验的**精确字符串**。选项取值见 §5。

## 4. 字段与规则（与 `lib/kyc/core.ts` 一致，服务端为准）
| 分组 | 必填 | 选填 |
|---|---|---|
| identity | surname, givenName, gender, education, marital, province, district, address + 材料 idFront, idBack, selfie | — |
| contacts | 联系人 1、2 各：Relation, Name, Phone | 联系人 3（**三项全填或全空**） |
| employment | workType, company, industry, position, income, tenure + 材料 incomeProof | supervisorName+supervisorPhone（**同时填或同时空**）、vehicle、housing；有车时**三选一**上传 vehicleInvoice / vehicleContract / vehiclePhoto；housing=租房 → rentContract 必传；=个人房产 → propertyCertificate 必传 |
| bank | bankName, bankAccount, bankHolder | — |
| consent | consent=true 且 `declarationVersion = kyc-data-consent-v2` | — |
- 文本 ≤ 240 字符；人名服务端转大写；电话为国际格式 `^\+[1-9]\d{7,14}$`（客户端去掉空格、括号、连字符）；联系人关系不得重复、联系人电话不得重复；district 必须属于所选 province。
- **材料类型**：selfie / vehiclePhoto 只接受 JPG/PNG；其余也接受 PDF。**APP 的 P2 只提供拍照/相册图片**（PDF 在后续版本）。

## 5. 选项数据
`options.json`（版本 `kyc-2026-09-21-v1`）随 APP 打包为资源；读取到的 `ruleVersion` 与资源版本不一致时，**提交按钮失败关闭**并提示"请更新应用"（不上传不匹配的取值）。选项标签为"English / ខ្មែរ"；性别、婚姻、联系人关系、车辆、住房、银行等取值为中文字符串，**发送给服务端的是取值，界面显示本地化文字**（km / en / zh）。

## 5.1 图片处理
选择后在客户端缩放（长边 ≤ 2000 px）并以 JPEG 质量 85 压缩，保证 < 10 MB；逐个上传；失败可重试；上传内容、文件名、路径**不得写入日志**。

## 6. 客户端行为
- 服务端是唯一真相：进入时 `GET /api/kyc`；每次保存/提交后用返回的视图替换本地状态。
- 本地表单仅存内存；"保存草稿"= `action:save`（必须带最新 `revision`）。离开分组时自动保存。
- 409（版本变化/已锁定）→ 重新读取并提示；会话失效 → 回登录页（既有逻辑）。
- 提交前客户端先做与服务端一致的完整性检查并定位到缺失项；服务端仍是最终裁决。
- 授权文案：P2 使用 APP 内置的占位授权文案（km/en/zh），**法务正式文本待 DEC-6**；用户必须滚动并勾选后才可提交。
- 状态页：`needs_info` 显示审核意见 `review.reason`（原样展示，不翻译）。

## 7. 验收
1. 新用户：首页「开始验证」→ 总览 → 逐组填写 → 上传 4 张必需材料 → 授权 → 提交 → 状态变为"待审核"。
2. 提交后全部只读；退出重进状态保持。
3. 管理员（测试环境脚本）把案件改为 `needs_info` 并写入意见 → APP 刷新后显示意见，可修改并重新提交。
4. 缺项时提交被拦并定位；服务端 409/网络错误有本地化提示，无键名、无堆栈。
5. km / en / zh 三种语言全部页面无混语、无键名。
6. 自动化：schema/校验单测、仓库层（假服务）测试、关键页面 widget 测试；`flutter analyze` 0 问题。

## 8. 风险与待定
| 项 | 说明 |
|---|---|
| DEC-6 授权/协议法务文本 | 当前为占位文本，正式上线前必须替换 |
| CR-010 `rejected` 重新申请 | 后端无接口，P2 只展示结果 |
| 高棉语译文 | 机器辅助翻译，需母语者复核 |
| 外部核验未接入 | 页面需如实说明"人工审核，不代表外部实名核验"（沿用后端 `scope` 文案） |

## 9. K4 结构化补件协议（2026-10-24，开发变更；需技术负责人批准合并）

员工 `POST /api/kyc/review` 在现有 `id, revision, decision, reason, checklist` 之外新增可选 `requests`：

```json
{"requests":[{"target":"slot:idFront","reasonCode":"blurred","note":"请重新拍摄完整清晰照片"}]}
```

- 每项固定为 `{target:string, reasonCode:string, note:string}`，不接受额外属性；`note` 必须是字符串，原始长度 ≤500，保存时去除首尾空白。数组最多32项，同一 `target` 不得重复。
- `target` 精确匹配 `lib/kyc/core.ts` 当前字段、材料或分区：`field:<fieldId>`、`slot:<slotId>`、`section:<sectionId>`；不得发送显示标签或未知 ID。`slot:signature` 属于后续贷款签约，明确排除。服务端还依据当前案件的 `slotVisible` 拒绝不适用的住房/车辆材料。`requestSection` 将三类有效目标映射至该核心分区；`parseRequests(raw, profile?)` 的可选 profile 保持无上下文调用兼容，审核决定必须传入当前 profile。
- 原因码固定：`blurred` 照片模糊、`incomplete_document` 证件不完整、`selfie_mismatch` 自拍与证件不符、`data_mismatch` 信息与证件不一致、`contact_unreachable` 联系人无法接通、`income_unclear` 收入证明不清、`other` 其他。发送原始码；zh/en/km 标签见 `lib/kyc/requests.ts` 的 `reasonCodes` 元组（顺序 zh,en,km）及 `requestReason`。
- 所有原有权限、状态、版本、checklist 和 reason 校验仍执行；新增内容校验失败返回400且案件、版本、历史不变。字段可随合法审核决定提交；客户端仅在 `status=needs_info` 时将其当作待补件要求展示。
- 可选数据存入现有加密 `review.requests`，由原有版本快照保存，审计历史沿用既有 `actor`；不新增数据库表/迁移，不把补件说明写入明文审计表。
- `GET /api/kyc`、审核详情 `GET /api/kyc/review?id=...` 的 `review.requests` 及后者 `history[].review.requests` 原样返回；客户保存/重交延用既有 review，直到下一次决定更新它。
- **兼容**：未传/旧数据缺少 `requests` 时保持缺省，客户端按旧 `review.checklist` 回退；显式 `[]` 表示本次没有结构化项目，不得把缺省和空数组混同。旧 App 可继续只显示 `review.reason`，现有请求无需新增此字段。本次不修改 Flutter 代码。
