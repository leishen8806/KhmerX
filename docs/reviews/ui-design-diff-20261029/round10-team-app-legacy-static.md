# PR149 第二次交付：team / App / 旧页面静态设计差异审核

## 审核边界

本轮只做静态代码审核，不拍截图、不改产品代码、不改变路由或交互逻辑。对照样式库约束：主蓝 `#1677FF`、主文字 `#172033`、次文字 `#667085`；输入框与主要按钮目标高度 48px；容器目标圆角 16px；页面气质分别遵循 Calm Flow（客户流程）、Operator Grid（后台工作台）和 Trust Surface（协议、审核、敏感信息）。优先级含义：P0 阻塞核心流程或造成严重无障碍/数据误操作，P1 影响主要任务或跨页面一致性，P2 明显视觉/响应式偏差，P3 细节和维护性。

## 差异清单

| 优先级 | 文件:行号 | 差异 | 建议 | UI-FIX 拆分 |
| --- | --- | --- | --- | --- |
| P1 | `app/globals.css:4-6` | 全局 `--primary` 为 `#0057e6`、`--brand-primary` 为 `#1769e8`，但样式库主蓝要求 `#1677FF`；同一页面还混用硬编码 `#0b5bea/#2f72e6`。 | 收敛为单一 `--color-brand-primary:#1677FF`，渐变/状态色从 token 派生；保留状态色语义，不在组件内重新定义蓝色。 | Team shell + shared tokens |
| P1 | `app/globals.css:6` | `button[data-slot=button]` 默认 `min-height:40px;border-radius:10px`，与 48px/16px 目标不符；只有 `.primary` 被局部提升到 48px。 | 将主要操作默认提升到 48px、16px；次级紧凑按钮使用显式 `size=sm`，不要让页面依赖局部覆盖。 | Team shell + shared tokens |
| P1 | `app/globals.css:6` | 输入框为 48px 但 `border-radius:8px`，与 16px Trust Surface/Calm Flow 目标不一致；select 也走同一偏小半径。 | 统一表单控件 radius token；若密集 Operator Grid 需要 8px，限定在表格筛选器而非全局 input。 | Team shell + shared tokens |
| P2 | `app/globals.css:6,11` | `.sample`、`.steps>div`、`.filters button`、`.side-nav button` 分别使用 10/8/8/10px，页面层级的卡片与导航难以呈现统一 Trust Surface。 | 卡片/确认面板统一 16px；按钮与导航统一 16px，紧凑筛选器单独注明 8px 例外。 | Team shell + shared tokens |
| P1 | `app/team/client.tsx:80-85` | 工作台把大量角色、语言、公司切换、通知、登出和分区内容集中在一个 client 组件；视觉 token 通过全局 class 与内联 `style` 混用，迭代时容易出现页面间漂移。 | 保留数据编排，但把 shell、header、account popover、loading/error surface 拆成可复用视觉组件，并只接收 tokenized props。 | Team shell + navigation |
| P1 | `app/team/login/client.tsx:11` | 登录页 header 使用 72px logo、页面 maxWidth 内联样式，登录/邀请/MFA 三段操作共用不一致的 Button 变体；没有统一的 Trust Surface 表单节奏。 | 抽出 `TeamAuthCard`，统一 48px 控件、16px radius、section 间距和错误区域；logo 尺寸纳入品牌 token。 | Team shell + login |
| P2 | `app/team/[section]/page.tsx:1-20` | section 路由只负责 `initialQueue`，真实页面视觉由 `TeamClient` 和大量分支决定；静态入口缺少可审计的页面级布局边界。 | 让每个 section 显式声明 page title、breadcrumb、layout variant，供 Operator Grid 统一渲染与审计。 | Team shell + navigation |
| P2 | `components/kyc-orders.tsx:38-39` | KYC 队列筛选、checkbox、CSV/重置操作与结果列表在同一渲染层，checkbox 内联 18px、toolbar 内联 `flexWrap`/gap，且卡片标题/动作在窄屏依赖 wrap。 | 建立 `KycQueueToolbar` 和 `KycCaseCard` 样式层；控件统一 48px 触控高度，checkbox 只保留可访问的 24px hit area，动作区按 Operator Grid 断点堆叠。 | KYC queue + review |
| P1 | `components/kyc-orders.tsx:39-48` | 队列卡片同时展示 public ref、内部 KYC ID、版本、更新时间、状态和跟进，信息密度高但没有明确 Trust Surface 分组；部分文本依赖 `style={{overflowWrap...}}`。 | 把身份、状态、时间、内部审计元数据分成四个语义块；将换行/颜色规则移入 class，敏感字段统一脱敏展示。 | KYC queue + review |
| P2 | `components/kyc-review.tsx:192-203` | KYC 字段、上传材料、审核决策和历史记录连续堆叠；银行 logo 固定 72×52，动作按钮/上传入口由多个局部 class 和 inline 规则控制。 | 以步骤/section 卡片组织 Trust Surface；图片尺寸用 token，审核决定区固定为独立高对比 surface，并为材料预览/决策动作保留 48px 行高。 | KYC queue + review |
| P2 | `components/customer-center.tsx:1` | 客户中心、贷款关系、状态标签与操作入口由大组件内分支输出，和 KYC queue 共用 `.panel/.sample` 但没有明确页面级密度策略。 | 为 Customer/Loan/Report 三类列表定义同一 Operator Grid row contract（标题、次文字、状态、动作），避免各组件自行调 padding/radius。 | Customer + loan + reports |
| P2 | `components/report-center.tsx:1` | 报表类页面与队列类页面共享 card token，但指标、表格和空态缺少统一的 16px/24px rhythm 约束。 | 统一指标卡、表格 header、empty/error state 的 spacing 和语义颜色；只将数据密度差异作为 variant。 | Customer + loan + reports |
| P2 | `components/service-tickets.tsx:1` | 客服工单/通知/贷后等操作面板使用同一 team shell，却未在静态结构上标出危险动作与确认区的 Trust Surface。 | 将保存、发送、关闭、升级等动作分成 primary/secondary/danger 三类，并在确认对话框沿用 16px radius 与 48px CTA。 | Service + operations |
| P2 | `mobile/lib/app/theme/khmerx_theme.dart:30-34` | Flutter light theme 已显式设置 primary `#1677FF`，但仍用 `ColorScheme.fromSeed` 生成其他色，无法保证 web 样式库的 `#172033/#667085` 和状态色精确对应。 | 用显式 `ColorScheme`/扩展 token 覆盖 text/outline/surface/error，避免 seed 漂移；维护 web 与 Flutter token 对照表。 | Mobile theme + shell |
| P2 | `mobile/lib/app/theme/khmerx_theme.dart:69-94` | Flutter input/button 的默认形状来自 Material 主题；FilledButton 为 52px/14px、SnackBar 为 12px，未完全收敛到 48px/16px。 | 将 FilledButton、InputDecoration、SnackBar 的 shape/height 统一为 style-library token；允许 52px 仅用于特定大 CTA 并记录例外。 | Mobile theme + shell |
| P1 | `mobile/lib/app/shell/authenticated_shell.dart:26-72` | 主壳只声明 `NavigationBar`，没有 page-level Calm Flow 背景/安全区/状态 surface；导航标签与 web `mini-bottom` token 由两个系统独立维护。 | 将 shell 背景、safe-area、selected/unselected color、destination spacing 收入同一 token；路由页面仅提供 body。 | Mobile theme + shell |
| P2 | `mobile/lib/features/auth/presentation/auth_placeholder.dart:218-238` | Telegram 与密码入口使用局部 52px/14px 按钮覆盖，和主题 48px/16px 目标不一致；忘记密码是独立 TextButton，层级对比偏弱。 | 删除局部高度/半径，统一 auth CTA 组件；把辅助入口放入明确的 secondary action surface。 | Mobile auth + KYC |
| P2 | `mobile/lib/features/auth/presentation/auth_placeholder.dart:309-345` | 手机号 TextField、CheckboxListTile、错误文案和发送按钮的间距为 12/8px 混合，缺少 Trust Surface 的同一 field group。 | 用 `FormSection` 包住身份、同意、错误和 CTA；错误使用主题 error surface，保持 16px section gap。 | Mobile auth + KYC |
| P2 | `mobile/lib/features/kyc/presentation/kyc_pages.dart:193-232` | KYC 总览卡片使用 ListTile + 8px margin，问题列表 12px padding；视觉上比样式库 16px 卡片更紧，进度条 radius 4px。 | 统一 KYC section card 16px radius/16px padding；进度条 radius 使用 token，问题列表支持完整触控行。 | Mobile auth + KYC |
| P1 | `mobile/lib/features/kyc/presentation/kyc_pages.dart:565-640` | KYC 分步页底部按钮虽然有 Expanded，但 top/bottom padding 与 step progress 的 4px radius 仍是局部规则；键盘/窄屏下按钮区没有统一 safe-area surface。 | 将 stepper、content、bottom action 做三段式 shell；底部操作区使用 safe-area + 16px surface，按钮统一 48px。 | Mobile auth + KYC |
| P2 | `mobile/lib/features/kyc/presentation/kyc_pages.dart:715-770` | TextFormField/DropdownButtonFormField 直接构造 InputDecoration，字段之间的 label/error/辅助文本 rhythm 分散，未显式复用样式库字段 token。 | 抽取 `KycFieldDecoration`，统一 label、error、focused outline、16px radius 和 48px 最小高度。 | Mobile auth + KYC |
| P2 | `app/kyc/client.tsx:179-192` | 旧 `/kyc` 仍自带 `.kyc-header`、银行 logo 72×52、字段和材料上传大块连续布局；与新 mini-app KYC stepper 的视觉语言不同。 | 旧页先包进同一 KYC shell/stepper token，逐步删除 bespoke header/logo 尺寸；上传和审核区按 Trust Surface 分组。 | Legacy KYC + agreements |
| P2 | `app/contract/view.tsx:7` | `/contract` 几乎整页单行 JSX，签名图片通过 inline `height:160`，加载/错误/摘要/正文/签名缺少可审计的独立 surface。 | 拆成 AgreementShell、ContractSummary、ContractBody、SignatureSurface；尺寸和间距移到 tokenized CSS。 | Legacy KYC + agreements |
| P2 | `app/agreements/loan/page.tsx:8-13` | `/agreements/loan` 使用 72px logo、`.agreement-shell/.kyc-header` 与 `/contract` 复用不足；目录、正文、测试环境提示、footer 的 Trust Surface 层级不统一。 | 统一协议阅读 shell、目录 sticky/移动折叠策略、版本/来源 metadata；品牌 logo 与 CTA 采用共享 token。 | Legacy KYC + agreements |
| P3 | `app/contract/view.tsx:7`、`app/agreements/loan/page.tsx:8-13` | 旧页仍含 inline `style` 和旧版中文“测试合同/资料填写”文案，静态审计和后续术语维护成本高。 | 将文案映射到术语表，移除 inline style，保留旧路由兼容但只由共享协议组件渲染。 | Legacy KYC + agreements |

## UI-FIX 拆分建议

每组按一个独立 PR 估算，目标均控制在约 400 行以内；本轮只提出拆分，不实施。

1. **Team shell + login（约 180–260 行）**：`app/team/client.tsx`、`app/team/login/client.tsx`、`app/team/[section]/page.tsx` 与共享 shell/token。统一导航、语言/账户菜单、loading/error、登录/MFA/邀请卡片。
2. **KYC queue + review（约 280–380 行）**：`components/kyc-orders.tsx`、`components/kyc-review.tsx`、`kyc-material-viewer.tsx`、`kyc-review-actions.tsx`。拆信息密度、上传/预览、审核决策和触控尺寸。
3. **Customer / loan / reports（约 220–340 行）**：`customer-center.tsx`、贷款/账单、`report-center.tsx`。建立 Operator Grid row contract、指标卡、表格和空态。
4. **Service / operations surfaces（约 220–360 行）**：通知、工单、贷后、放款/还款、审计面板。统一 primary/secondary/danger 动作与确认 surface。
5. **Mobile theme + authenticated shell（约 180–280 行）**：`mobile/lib/app/theme/khmerx_theme.dart`、`mobile/lib/app/shell/authenticated_shell.dart`。显式 token、safe-area、NavigationBar 和 Material 组件形状。
6. **Mobile auth + KYC pages（约 300–390 行）**：`auth_placeholder.dart`、`kyc_pages.dart`。复用 FormSection/KycFieldDecoration，统一 48px 控件和 KYC stepper。
7. **Legacy KYC / contract / agreements（约 240–360 行）**：`app/kyc/**`、`app/contract/**`、`app/agreements/**`。建立兼容旧路由的共享协议/KYC shell，清除 inline style 与旧术语漂移。

## 结论

静态审核覆盖了 `/team` 页面与组件（含 `components/kyc-orders.tsx`）、Flutter `mobile/` 主壳/auth/KYC/公司入口，以及仍在使用的 `/kyc`、`/contract`、`/agreements/*`。当前最大的一致性风险是 web 主蓝/控件半径与样式库不一致，以及 team/KYC/协议页面依赖大量局部 class/inline style。建议先落地 Team shell、KYC queue/review、Flutter theme 三组，再处理旧页面兼容层。未修改产品代码，未执行截图或动态验收。
