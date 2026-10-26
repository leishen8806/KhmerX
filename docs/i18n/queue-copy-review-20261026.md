# 审核队列静态中文清单与母语复核

范围：KycOrders、OrderFollowups、队列 CSV 按钮、既有审核状态；不是整个后台翻译验收。下表是本轮静态中文项及 en/km 映射，km 均标“新增待复核”，未冒称母语确认。原有排序/等待/缺失时间文案已有三语，本轮保留。动态客户姓名、备注、部门名称、actor、接口编号原样，不自动翻译。外部 renderAssignment 子界面的文案不在本组件映射范围。

高棉语相对时间不再依赖部分 Chromium 的 ICU 缩写回退：分钟/小时/天及更新时间秒数显式显示高棉语单位，数值仍合法本地数字；不是禁止一切数字。不改变提交排序、24h SLA、原始时间或 CSV 数据列。

| 中文源串 | English | Khmer | 状态 |
| --- | --- | --- | --- |
| 待跟进 | Pending follow-up | រង់ចាំតាមដាន | 新增待复核 |
| 已联系 | Contacted | បានទាក់ទង | 新增待复核 |
| 等待客户补充 | Waiting for customer | រង់ចាំអតិថិជនបំពេញបន្ថែម | 新增待复核 |
| 跟进完成 | Follow-up resolved | បានបញ្ចប់ការតាមដាន | 新增待复核 |
| 查询订单 | Search cases | ស្វែងរកករណី | 新增待复核 |
| 订单编号、客户编号、脱敏手机号、部门或审核员 | Case, customer, masked phone, department or reviewer | លេខករណី អតិថិជន ទូរសព្ទដែលលាក់ខ្លះ ផ្នែក ឬអ្នកពិនិត្យ | 新增待复核 |
| 审核状态 | Review status | ស្ថានភាពពិនិត្យ | 新增待复核 |
| 全部状态 | All statuses | គ្រប់ស្ថានភាព | 新增待复核 |
| 部门／机构 | Department / institution | ផ្នែក / ស្ថាប័ន | 新增待复核 |
| 全部授权部门 | All authorized departments | គ្រប់ផ្នែកដែលបានអនុញ្ញាត | 新增待复核 |
| 当前结果 | Results | លទ្ធផល | 新增待复核 |
| 条，仅包含当前授权范围。 | cases within your authorized scope. | ករណី ក្នុងដែនសិទ្ធិដែលបានអនុញ្ញាត។ | 新增待复核 |
| 重置查询 | Reset filters | កំណត់តម្រងឡើងវិញ | 新增待复核 |
| 资料审核状态与跟进情况独立记录。公司 Admin 可确认审核通过；分配的审核员可通过、补件或拒绝。 | Review status and follow-up are recorded separately. Company admins may approve; assigned reviewers may approve, request more information or reject. | ស្ថានភាពពិនិត្យ និងការតាមដានត្រូវបានកត់ត្រាដាច់ដោយឡែក។ អ្នកគ្រប់គ្រងក្រុមហ៊ុនអាចអនុម័ត; អ្នកពិនិត្យដែលបានចាត់តាំងអាចអនុម័ត ស្នើព័ត៌មានបន្ថែម ឬបដិសេធ។ | 新增待复核 |
| 没有符合条件的 KYC 订单。 | No matching KYC cases. | មិនមានករណី KYC ដែលត្រូវនឹងលក្ខខណ្ឌ។ | 新增待复核 |
| 资料编号 | Case reference | លេខយោងករណី | 新增待复核 |
| 注册手机 | Registered phone | ទូរសព្ទដែលបានចុះឈ្មោះ | 新增待复核 |
| 历史测试资料（无注册账号） | Legacy test record (no registered account) | ទិន្នន័យសាកល្បងចាស់ (គ្មានគណនីចុះឈ្មោះ) | 新增待复核 |
| 客户 | Customer | អតិថិជន | 新增待复核 |
| 待分配部门 | Department unassigned | មិនទាន់ចាត់ផ្នែក | 新增待复核 |
| 已分配审核员 | Reviewer assigned | បានចាត់អ្នកពិនិត្យ | 新增待复核 |
| 待分配审核员 | Reviewer unassigned | មិនទាន់ចាត់អ្នកពិនិត្យ | 新增待复核 |
| 内部 KYC ID： | Internal KYC ID: | លេខសម្គាល់ KYC ខាងក្នុង៖ | 新增待复核 |
| · 资料版本 | · Revision | · កំណែទិន្នន័យ | 新增待复核 |
| 收起详情 | Collapse details | លាក់ព័ត៌មានលម្អិត | 新增待复核 |
| KYC详情与跟进 | KYC details and follow-up | ព័ត៌មានលម្អិត KYC និងការតាមដាន | 新增待复核 |
| 审核操作：通过／补件／拒绝 → | Review: approve / request information / reject → | ពិនិត្យ៖ អនុម័ត / ស្នើព័ត៌មានបន្ថែម / បដិសេធ → | 新增待复核 |
| 查看完整 KYC 资料 → | View full KYC details → | មើលព័ត៌មានលម្អិត KYC → | 新增待复核 |
| 订单详情与跟进情况 | Case details and follow-up | ព័ត៌មានលម្អិតករណី និងការតាមដាន | 新增待复核 |
| 正在加载… | Loading… | កំពុងផ្ទុក… | 新增待复核 |
| 重试加载 | Retry loading | ព្យាយាមផ្ទុកម្តងទៀត | 新增待复核 |
| 订单编号： | Case ID: | លេខករណី៖ | 新增待复核 |
| 关联用户： | Linked customer: | អតិថិជនដែលពាក់ព័ន្ធ៖ | 新增待复核 |
| 注册手机： | Registered phone: | ទូរសព្ទចុះឈ្មោះ៖ | 新增待复核 |
| 无注册账号记录 | No registered account record | គ្មានកំណត់ត្រាគណនីចុះឈ្មោះ | 新增待复核 |
| · 注册于 | · Registered | · បានចុះឈ្មោះនៅ | 新增待复核 |
| 关联贷款订单： | Linked loan applications: | ពាក្យស្នើកម្ចីដែលពាក់ព័ន្ធ៖ | 新增待复核 |
| 暂无，KYC 通过后可申请贷款 | None yet; loans may be requested after KYC approval | មិនទាន់មាន; អាចស្នើកម្ចីក្រោយ KYC បានអនុម័ត | 新增待复核 |
| 审核状态： | Review status: | ស្ថានភាពពិនិត្យ៖ | 新增待复核 |
| · 跟进情况： | · Follow-up: | · ការតាមដាន៖ | 新增待复核 |
| 尚无跟进记录 | No follow-up records yet | មិនទាន់មានកំណត់ត្រាតាមដាន | 新增待复核 |
| 查看审核详情 → | View review details → | មើលព័ត៌មានលម្អិតការពិនិត្យ → | 新增待复核 |
| 查看审核详情 | View review details | មើលព័ត៌មានលម្អិតការពិនិត្យ | 新增待复核 |
| 请由公司 Admin 或本订单分配的 KYC 审核员确认审核。 | Ask the company admin or assigned KYC reviewer to review this case. | សូមឱ្យអ្នកគ្រប់គ្រងក្រុមហ៊ុន ឬអ្នកពិនិត្យ KYC ដែលបានចាត់តាំង ពិនិត្យករណីនេះ។ | 新增待复核 |
| 跟进情况 | Follow-up status | ស្ថានភាពតាមដាន | 新增待复核 |
| 跟进备注 | Follow-up note | កំណត់សម្គាល់ការតាមដាន | 新增待复核 |
| 记录联系情况、补件说明或下次跟进安排 | Contact outcome, requested information or next follow-up | លទ្ធផលទំនាក់ទំនង ព័ត៌មានបន្ថែម ឬការតាមដានបន្ទាប់ | 新增待复核 |
| 保存中… | Saving… | កំពុងរក្សាទុក… | 新增待复核 |
| 保存跟进备注 | Save follow-up note | រក្សាទុកកំណត់សម្គាល់តាមដាន | 新增待复核 |
| 暂无跟进备注。 | No follow-up notes yet. | មិនទាន់មានកំណត់សម្គាល់តាមដាន។ | 新增待复核 |
| 草稿 | Draft | សេចក្តីព្រាង | 新增待复核 |
| 待人工审核 | Awaiting review | រង់ចាំពិនិត្យ | 新增待复核 |
| 已提交 | Submitted | បានដាក់ស្នើ | 新增待复核 |
| 待补件 | More information needed | ត្រូវការព័ត៌មានបន្ថែម | 新增待复核 |
| 人工资料审核通过 | Review approved | ការពិនិត្យបានអនុម័ត | 新增待复核 |
| 资料审核未通过 | Review rejected | ការពិនិត្យត្រូវបានបដិសេធ | 新增待复核 |
| 导出当前结果 CSV | Export results CSV | នាំចេញលទ្ធផល CSV | 新增待复核 |
| 无法加载，请重试 | Unable to load. Please retry. | មិនអាចផ្ទុកបានទេ។ សូមព្យាយាមម្តងទៀត។ | 新增待复核 |
# 1210-02 新增待复核

| 中文 | English | Khmer | 状态 |
| --- | --- | --- | --- |
| 保存失败，请重试 | Unable to save. Please retry. | មិនអាចរក្សាទុកបានទេ។ សូមព្យាយាមម្តងទៀត។ | 新增待复核 |

