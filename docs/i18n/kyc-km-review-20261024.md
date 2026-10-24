# KYC 高棉语母语复核包

主文件：[kyc-km-review-20261024.csv](kyc-km-review-20261024.csv)。这是译文复核资料，不是翻译批准、代码修改或发布记录。

## 使用方法 / Review instructions

请使用正式友好、适合金融服务的语气。证件和银行术语采用柬埔寨常用说法，英文及高棉语尽量简短。不确定之处请明确标注，不猜测。保留占位符、数值、单位、授权和审核含义，不新增服务承诺。仅填写最后两列，空白不代表审核通过。经母语审核并由业务负责人确认后，另开代码任务应用，不自动回写代码。

Use a formal, friendly financial-services tone and ID/banking terms commonly used in Cambodia. Keep English and Khmer concise. Flag uncertainty instead of guessing. Preserve placeholders, numbers, units, consent and review meaning, without adding service promises. Fill only the last two columns. Blank cells do not mean approval. Applying reviewed copy requires a separate code task and business confirmation.

- CSV 为 UTF-8（含 BOM），八列固定；首行为列名，接下来的两个 `__instructions_*` 记录是中英文说明，不是业务文案。筛选掉这两条后复核675个资料条目。
- 652条含源代码实际高棉文字；另23条是地名的既有拉丁文回退，没有凭空补译。源未提供高棉地名时已在状态列标明，请核对官方常用名称后再提出建议。
- `key` 是“来源类别 + 源键哈希”，不表示应用原本已有这些翻译ID；位置列保留源路径、位置/原键和提交号。重复文字跨来源保留，便于核对不同语境或不一致译法，不将不同运行时来源静默合并。
- “当前高棉语”逐字提取原有值，没有自动润色。动态表达式只把运行时变量归一成 `{field}`、`{n}`、`{owner}` 等占位符；例如字段模板中现存英文 `Contact` 也原样保留，须母语复核，不伪称已全部柬语化。
- 源字典含兼容/旧版词条，不等同当前客户一定可见。特别标出K6已撤下的24小时时效承诺、K7已替换的清空关系下拉词条、K7已移除的KYC签名入口；不得据此恢复旧功能或承诺。其他兼容项标为“待复核及显示场景确认”。

## 来源快照与范围

本包是 main 基础字典与尚未合并的 K1–K7 候选实现的文案并集，**不代表main已合入，也不代表线上已发布**。文档分支基于最新已核验的 origin/main `4d3c4a2b187cb4a3977fb32703f49a087a3b310f`，只增加文档，不引入功能代码。

| 来源 | 固定提交 | 主要用途 |
|---|---|---|
| lib/i18n.tsx、lib/error-messages.ts、lib/kyc/options.json | 4d3c4a2b187cb4a3977fb32703f49a087a3b310f | 既有KYC/兼容标签、客户错误、字段选项与地名 |
| lib/kyc/ui-copy.ts | 834976cb782e8a69db557050308b5411afdfcb10（#89） | K1/K2基础 + K4补件 + K6自动保存文案 |
| lib/kyc/requests.ts、components/kyc-customer-overview.tsx、components/kyc-customer-checks.tsx | 5379aab368d65f8425cef3238049262e21feae63（#91） | 补件原因、进度/汇总/时间线、地址/账户确认 |
| lib/kyc/contact-ui.ts、components/kyc-capture-examples.tsx | f01242560fa4f2913d89771c0fe3f82f2ab89b16（#92） | 关系清除/占用说明、SVG拍摄示例 |

覆盖：69条ui-copy、229条KYC/选项兼容映射、23条共享KYC入口/导航、27条客户错误/回退、44条选项、229条地名、7条补件原因、14条进度/汇总、7条地址/银行检查、5条拍摄示例、2条联系人控件、19条动态模板。

不包含：真实客户填写值、审核员自由备注、合同正文、生产环境数据；后台专用队列/审计/代修改控件与贷款后续操作专用词条不作为本轮客户KYC复核内容。筛选剔除47个明显内部/审核/后续贷款专用词条实例。K5安全敏感部分尚未实现，没有编造其译文；K7的后台相对时间不列入客户清单。

本包保留旧字典可能存在的重复或语义冲突，供人工决定；没有修改旧代码，包括5MB/10MB兼容文案、审核通过与贷款批准的措辞区别。请重点核对银行账户、身份证件、授权、补件、审核/审批、额度与时效等术语。

## 验证

- 使用源代码字面量与固定提交提取，保留已有三语对应关系；不执行应用业务操作。
- 八列一致、key唯一、675个资料条目及2个说明条目；两个人工复核列全部留空。
- 通过结构化表格写入/读回和CSV重新导入逐格对比，空单元格归一后保持一致；未将说明行误计为文案数。
- 只交付所请求CSV及本说明，不额外交付XLSX，不将作者临时脚本加入仓库。
- 母语审校尚未进行；只有资料整理完成，不代表译文已可面向真实客户。
