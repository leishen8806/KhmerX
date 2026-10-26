# KYC 改版验收清单（2026-10-26）

基线：`main bb4eaef`（#115 合并后），对照 `docs/kyc-ux-review-20261023.md`。GitHub PR 状态在本轮只读核实。此表区分“代码已合并”与“产品/生产验收完成”，不是部署或冻结范围解禁许可。仅 H5/Mini 与员工 Web；Flutter、生产写入和发布不在本轮验收范围。

状态口径：“已合并 #N”只证明该 PR 已进入 main；“待批准”指已有实现、未获本轮明确合并批准；“未做”指原建议仍缺；无法由当前证据确认的部分均标“需人工验收”。#78/#79/#80–#84 的历史治理记录仍以 decision-log D-25 为准，不因本表列出已合并而追认权限。

## 证据索引

截图均为真实 Chromium + 本地合成数据，不是生产或真实用户验收。以下路径相对于 `/Users/suchen/Documents/ChatGPT/KhmerX/claude-bridge/`，不在本仓库内；仓库外阅读者需取得原始文件，不可把路径存在当作已经看过。

- E1：`outbox/artifacts/20261026-1005-01/bank-{zh,km}-375.png`，账户页面；同目录 `queue-{zh,km}-375.png` 为较早队列状态，不是后续修复验收。
- E2：`outbox/artifacts/20261026-1100-02/changes-{zh,km}-{1440,375}.png`，R5/K5b，移动固定决定栏遮挡是已知问题。
- E3：`outbox/artifacts/20261026-1210-02/queue-{zh,km}-375-expanded.png`，#116 返修，展开跟进；`browser-evidence.log` 验证宽度375、无pageerror。
- E4：`outbox/artifacts/20261026-1210-03/review-{zh,km}-{success,failure,amend}-375.png`，#114 本地显示成功/失败/显示后编辑；日志含真实原 handler 返回，未执行代修改提交。
- E5：`outbox/artifacts/20261026-1210-04/review-{zh,km}-375-{before,after}.png` 与 `review-{zh,km}-1440-after.png`，#117 K8a；决定栏从 fixed→static，宽度375/1440、提交按钮可滚动到达。before/after-browser.log 同目录。只有 K8a 分支，不是 main 或生产效果。
- 没有对应截图的项目明确写“未补专项截图，需人工验收”，不借用不相关图片证明。

## 客户端 C1–C15

| 项 | 当前状态 / PR | 可追溯测试 | 截图与未确认边界 |
|---|---|---|---|
| C1 内部/测试信息 | 已合并 #79，客户隐藏权重、来源和测试说明，审核端保留 | `tests/kyc-customer-copy.test.mjs`: customer H5 and mini expose no internal test or scoring metadata | 未补专项截图，需人工验收所有进入状态；不是保证外部校验已接入 |
| C2 三语与时间 | 已合并 #79；客户 UI/属性/安全错误和时间按语言 | 同文件：all customer sections render localized UI and attributes；customer validation errors and timestamps follow locale | E1 只覆盖账户；其他页面需人工验收，Khmer 母语复核未完成 |
| C3 字段错误/聚焦 | 已合并 #81、#95，支持国际电话保留与+855占位规整 | 同文件：blur exposes linked field error；Submit locates an invalid field；T1–T5 电话与导航回归 | 未补错误态专项截图，需手机键盘/屏幕阅读器人工验收 |
| C4 拍照/预览/进度 | 已合并 #80、#82，拍摄+相册、内联图、PDF下载与重试 | 同文件：identity capture uses the correct camera；uploaded image opens an inline dialog；compression, actual byte progress and manual retry；`tests/kyc-upload.test.mjs` | 未补拍摄/弱网/真PDF专项截图；真机相机和 Telegram 环境需人工验收 |
| C5 结构化补件 | 已合并 #87、#104；精确字段/材料定位，旧 checklist 兼容；不再解析自由文本 | `tests/kyc-supplement-ui.test.mjs`、`tests/kyc-requests.test.mjs`；customer-copy: structured supplementation focuses exact target；legacy supplementary reason is never parsed | E2 是审核侧，不代替客户补件走查；客户完整闭环需人工验收 |
| C6 分组可访问 | 已合并 #89；未完成组可进入，Next 仍本步校验、提交全量校验 | customer-copy: customers can open unfinished groups without validating other groups | 未补跨分组专项截图，需人工验收 |
| C7 自动保存 | 已合并 #89；1.5s防抖、保存状态/重试、409保留本地、Mini离开等待 | `tests/kyc-draft-save.test.mjs`；customer-copy: customer autosave status and local input survive delayed saves；Mini leave during an existing autosave；customer 409 keeps local input | 未补慢网/断网专项截图，真实 Mini 离开及恢复需人工验收 |
| C8 完成进度 | 已合并 #90；六组进度使用现有必填规则，保留既有分组金额文案，未改授信 | customer-copy: customer progress counts six groups using existing required rules；filled but invalid phone does not count its group complete | 未补进度专项截图；额度文案不是实际贷款批准，需人工验收 |
| C9 检查并提交 | 已合并 #90；分组汇总、修改入口、明确确认才提交 | customer-copy: submit opens grouped summary and only its explicit confirmation submits；entering the submission summary starts at the warning and heading | 未补汇总页专项截图，需人工验收警告/返回修改/提交锁定闭环 |
| C10 状态时间线 | 已合并 #90 的真实状态/历史时间线；原建议的预计处理时长与Telegram送达承诺未做，不编造 | customer-copy: submitted timeline does not invent review start, turnaround or notification | 未补各结果态专项截图；通知真实送达及SLA需另行证据，不能写完成 |
| C11 内联地址候选 | 已合并 #111（#91曾合入旧功能分支，不单独认作main交付）；只主动点击才请求、确认才应用 | customer-copy: geocoding stays inline and only confirmation applies the candidate；review amendment shows address candidate | 未补定位许可/拒绝专项截图，浏览器许可、Google响应需人工验收 |
| C12 收款账户复核 | 已合并 #111；姓名只预填空且未动过的字段；二次账号仅本地确认，不阻塞草稿 | customer-copy: bank holder prefills only an empty untouched value；account repeat is ephemeral | E1；真实银行校验/KESS未接入，本项不证明账户真实性 |
| C13 联系人关系 | 已合并 #92；旁侧清除按钮、占用选项说明 | customer-copy: contact relationship clears beside the field and names the occupying contact in every locale | 未补联系人专项截图，长 Khmer 下拉与触控需人工验收 |
| C14 拍摄示意图 | 已合并 #92；H5/Mini 使用同一组原创正确/错误SVG示意图，不是真实证件 | customer-copy: H5 and Mini show the same original correct and incorrect SVG capture examples | 未补示意图专项截图，视觉指导准确性及真机需人工验收 |
| C15 签名分支清理 | 已合并 #92；KYC 客户页面移除签名相关渲染，签约仍在后续流程 | `app/kyc/client.tsx` 无 SignaturePad 导入；现有 customer-copy/kyc-submitted-mini 回归覆盖KYC流程；无单独签名清理行为断言 | 未补专项截图；贷款签约不在本轮验证范围，不改贷款签名逻辑 |

## 审核端 R1–R11（另附 R0）

| 项 | 当前状态 / PR | 可追溯测试 | 截图与未确认边界 |
|---|---|---|---|
| R0 导航阻断（补充） | 已合并 #78、#85；审核切组无 save 请求，独立单页替代客户Next | `tests/kyc-review-navigation.test.mjs`: reviewer can access all seven anchors without any save request；single page review needs no Next action | E2/E5；历史权限记录不因功能通过而自动追认 |
| R1 统一队列/SLA | 已合并 #84；无id跳团队队列、memberId分配过滤、真实submitted_at排序/超24h标红；#116文案返修待批准 | `tests/kyc-queue.test.mjs`：assigned to me uses member id；real submission time renders relative age；no-id review redirects | E3 为#116，非main；缺少提交时间明确不可计算，不用updated_at冒充 |
| R2 单页审核 | 已合并 #85、#101；七区只读、锚点/折叠、逐区核对；窄屏遮挡修复#117待批准 | `tests/kyc-review-workspace.test.mjs`、`tests/kyc-review-navigation.test.mjs`；#117新增 `tests/kyc-k8-copy.test.mjs` | E2 展示旧问题，E5 展示#117修复；真实触控/桌面内滚动需人工验收 |
| R3 材料查看器 | 已合并 #86；缩略图、缩放旋转、证件/自拍并排、内联PDF回退；“查看记录写审计”未做 | `tests/kyc-material-viewer.test.mjs`：authenticated thumbnails；zoom reserves a scrollable stage；PDF stays inline | E2/E5仅合成图片；真PDF、多图和键盘需人工验收。R10字段reveal审计不等于材料查看审计 |
| R4 逐区/结构化补件 | 已合并 #87、#101、#104；字段/材料/分区目标，原因白名单和other必填；#117修复静态文案待批准 | `tests/kyc-requests.test.mjs`、`tests/kyc-supplement-ui.test.mjs`；review-workspace: needs-info decision requires a chosen reason | E2/E5；客户→补件→重交闭环需人工验收；Flutter实际运行未独立验证 |
| R5 本次变更 | 已合并 #112、#115；历史基线、字段掩码/材料id对比、无基线未知；section标签和枚举显示修复#117待批准 | `tests/kyc-review-changes.test.mjs`、`tests/kyc-review-changes-ui.test.mjs` | E2/E5；consent/location无R5差异证据，始终未知并展开，不能称全部字段都有比较 |
| R6 下一条 | 已合并 #105；先POST成功再取下一条，可自动；队列失败重试，不伪造空队列 | `tests/kyc-review-next.test.mjs`；customer-copy: review success reads queue after POST | 未补跨案件专项截图，真实并发/分配变化需人工验收 |
| R7 二次确认/短语 | 已合并 #105；有摘要二次确认和三语常用短语；原建议“通过意见选填”未做，服务端仍要求原因 | `tests/kyc-review-actions.test.mjs`；review-workspace: reason is always required while checklist is required only for approval | 未补确认弹窗专项截图；不得把“意见可空”列为已完成，不在前端绕过服务端 |
| R8 唯一审核入口 | 已合并 #88；跟进只记联系情况，链接不带预选approved，详情忽略旧参数 | `tests/kyc-review-controls.test.mjs`: followup links to neutral review detail；review-navigation: legacy approved URL never preselects | E3 展开跟进，权限/保存真实流程需人工验收 |
| R9 代修改模式/确认 | 已合并 #88；醒目模式条、字段高亮、差异及确认；R10b清理敏感编辑凭证#114待批准 | review-controls: amendment shows differences and requires fresh confirmation；#114 customer-copy含步骤切换/敏感编辑清理回归 | E4仅显示后编辑截图，未提交；完整保存退回确认闭环需人工验收；旧代修改页面仍有中文 |
| R10 默认脱敏/显示审计 | #88仅前端遮罩已合并；服务端staff投影、审计成功后reveal、scope凭证#113/#114待明确合并批准 | main review-controls的显示/隐藏；分支 `tests/kyc-reveal.test.mjs`、`tests/kyc-amend-sensitive.test.mjs`、`tests/kyc-staff-redaction.test.mjs`、该分支 `tests/kyc-review-controls.test.mjs`；#114全量458/448pass/10skip/0fail | E4；不能把main当前前端遮罩当作服务端已不发明文或已写显示审计。30s仅进程内去重、5min凭证可重复使用、历史自由文本/材料图像不在范围 |
| R11 相对更新时间 | 已合并 #93；submitted/updated语义分离，金边完整时间tooltip；km完整单位返修#116待批准 | `tests/kyc-queue-time.test.mjs`、`tests/kyc-queue.test.mjs` | E3（#116）；需人工验收浏览器与目标设备字体/Intl环境 |

## 剩余验收与权限边界

1. #113/#114/#116/#117 尚未合并，不写成已交付生产。#113/#114 顺序：先#113到main，再#114改base为main、同步、当前CI通过且明确授权后合并。
2. 本轮不实施材料查看审计、SLA/Telegram送达承诺、通过意见选填，也不触及其接口/资金/权限依赖。母语复核与完整本地闭环的缺图项目保留人工验收。
3. 本轮各分支全量门禁/CI详见对应PR与bridge结果；10项skip不算通过。未运行全端真机/真实SSO/生产写入验收，不因HTTP可访问声称端到端健康。
4. 未部署、未迁移、未改服务器/DNS/Cloudflare、未强推或删除数据，未解冻其他#63切片。
