# K8 审核页静态文案复核（2026-10-26）

以下为源码与真实组件渲染检查发现并补齐的残留。全部新增 Khmer 为“新增待复核”，不声称已母语确认。客户字段、审核意见、补件说明、历史 actor 等原文保留。已有“补件原因”翻译在 lib/kyc/ui-copy.ts，RequestEditor 已调用；本批真实渲染测试覆盖它。

| 中文／源标识 | English | Khmer | 状态 |
|---|---|---|---|
| 审计只读：敏感资料仅由 KYC 审核岗位查看 | Audit read-only: sensitive details are restricted to KYC reviewers | សវនកម្មអាចអានតែប៉ុណ្ណោះ៖ ព័ត៌មានរសើបសម្រាប់តែអ្នកពិនិត្យ KYC | 新增待复核 |
| 无权查看 | Not authorized to view | គ្មានសិទ្ធិមើល | 新增待复核 |
| 要求补充： | Request updates: | ស្នើឱ្យបំពេញបន្ថែម៖ | 新增待复核 |
| 资料审核授权： | Consent for profile review: | ការយល់ព្រមឱ្យពិនិត្យព័ត៌មាន៖ | 新增待复核 |
| 已确认 | Confirmed | បានបញ្ជាក់ | 新增待复核 |
| 勾选需要客户补充的页面，客户重新进入时会直接定位到第一项。 | Select the sections requiring updates. The customer will return to the first requested section. | ជ្រើសផ្នែកដែលអតិថិជនត្រូវបំពេញបន្ថែម។ ពេលត្រឡប់មកវិញ នឹងបើកផ្នែកដែលបានស្នើដំបូង។ | 新增待复核 |
| 审核意见 / 补件原因 | Review note / reason for updates | មតិពិនិត្យ / មូលហេតុស្នើព័ត៌មានបន្ថែម | 新增待复核 |
| 姓名 | Full name | ឈ្មោះពេញ | 新增待复核 |
| 完整住址 | Full residential address | អាសយដ្ឋានលំនៅដ្ឋានពេញលេញ | 新增待复核 |
| 联系人 1 电话 | Contact 1 phone | ទូរសព្ទអ្នកទំនាក់ទំនង ១ | 新增待复核 |
| 联系人 2 电话 | Contact 2 phone | ទូរសព្ទអ្នកទំនាក់ទំនង ២ | 新增待复核 |
| 联系人 3 电话 | Contact 3 phone | ទូរសព្ទអ្នកទំនាក់ទំនង ៣ | 新增待复核 |
| 购车发票 | Vehicle purchase invoice | វិក្កយបត្រទិញយានយន្ត | 新增待复核 |
| 购车合同 | Vehicle purchase contract | កិច្ចសន្យាទិញយានយន្ត | 新增待复核 |
| 车辆照片 | Vehicle photo | រូបថតយានយន្ត | 新增待复核 |
| 租房合同 | Rental contract | កិច្ចសន្យាជួលផ្ទះ | 新增待复核 |
| 房屋产权证 | Property title | ប័ណ្ណកម្មសិទ្ធិផ្ទះ | 新增待复核 |
| 协议 / 授权确认 | Agreement / consent | កិច្ចព្រមព្រៀង / ការយល់ព្រម | 新增待复核 |
| Telegram 手机号验证 | Telegram phone verification | ការផ្ទៀងផ្ទាត់ទូរសព្ទ Telegram | 新增待复核 |
| Telegram 账号验证（未接入） | Telegram account verification (not integrated) | ការផ្ទៀងផ្ទាត់គណនី Telegram (មិនទាន់ភ្ជាប់) | 新增待复核 |
| 自主授权定位（设备报告，非核验） | Consented location (device-reported, not verified) | ទីតាំងដែលបានយល់ព្រម (រាយការណ៍ដោយឧបករណ៍ មិនបានផ្ទៀងផ្ទាត់) | 新增待复核 |
| B6:F6 / 附件一 | B6:F6 / Appendix 1 | B6:F6 / ឧបសម្ព័ន្ធ ១ | 新增待复核 |
| B20:F20 / 附件五 | B20:F20 / Appendix 5 | B20:F20 / ឧបសម្ព័ន្ធ ៥ | 新增待复核 |
| B22:F22 / 附件三 | B22:F22 / Appendix 3 | B22:F22 / ឧបសម្ព័ន្ធ ៣ | 新增待复核 |
| B23:F23 / 附件二 | B23:F23 / Appendix 2 | B23:F23 / ឧបសម្ព័ន្ធ ២ | 新增待复核 |
| B24:F24 / 附件六 | B24:F24 / Appendix 6 | B24:F24 / ឧបសម្ព័ន្ធ ៦ | 新增待复核 |
| B25:F25 / 附件四 | B25:F25 / Appendix 4 | B25:F25 / ឧបសម្ព័ន្ធ ៤ | 新增待复核 |

分区目标使用 core.sections 元数据翻译；枚举值仅在 core.fields.options 精确匹配时翻译，非枚举原文不翻译。原材料来源的行号标识保留，附件名称作静态标签翻译。审核历史 reason、姓名不传入翻译函数。旧代修改 CustomerKyc 页面不在本批 KycReview 子树范围；R10b 合并尚待明确批准。
