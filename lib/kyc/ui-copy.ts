import {legacyText,type Locale} from '../i18n';
import {messageForError} from '../error-messages';

// UI copy only. Never pass customer field values, review notes or signed text here.
const copy:Record<string,[string,string]>={
 '取消':['Cancel','បោះបង់'],
 '已保存':['Saved','បានរក្សាទុក'],
 '保存中…':['Saving…','កំពុងរក្សាទុក…'],
 '保存失败':['Save failed','ការរក្សាទុកបរាជ័យ'],
 '资料版本已变化，请重新加载后核对':['This profile changed. Reload and check before saving.','ព័ត៌មាននេះបានផ្លាស់ប្តូរ។ សូមផ្ទុកឡើងវិញ និងពិនិត្យមុនរក្សាទុក។'],
 '重新加载服务器资料':['Reload server profile','ផ្ទុកព័ត៌មានពីម៉ាស៊ីនមេឡើងវិញ'],
 '重新加载会放弃本页未保存修改，是否继续？':['Reloading discards unsaved changes on this page. Continue?','ការផ្ទុកឡើងវិញនឹងបោះបង់ការកែប្រែមិនទាន់រក្សាទុក។ បន្តឬ?'],
 '需补充':['Update needed','ត្រូវបន្ថែម'],
 '已修改，待审核':['Updated · awaiting review','បានកែប្រែ · រង់ចាំពិនិត្យ'],
 '补件原因':['Reason for update','មូលហេតុនៃការបន្ថែម'],
 '补充说明':['Additional note','ចំណាំបន្ថែម'],
 '前往补充':['Update now','បន្ថែមឥឡូវ'],
 '本次修改状态仅供参考，提交后由审核员确认。':['Edits are provisional until reviewed.','ការកែប្រែត្រូវរង់ចាំការបញ្ជាក់ពីអ្នកពិនិត្យ។'],
 '网络较慢，上传中断，请重试':['Slow network. Upload interrupted. Please retry.','បណ្ដាញយឺត។ ការផ្ទុកឡើងបានផ្អាក។ សូមព្យាយាមម្ដងទៀត។'],
 '拍照上传':['Take a photo','ថតរូបដើម្បីផ្ទុកឡើង'],
 '从相册选择':['Choose from gallery','ជ្រើសពីវិចិត្រសាល'],
 '放大查看材料':['Enlarge document','ពង្រីកមើលឯកសារ'],
 '关闭预览':['Close preview','បិទការមើលជាមុន'],
 '下载已上传材料':['Download uploaded document','ទាញយកឯកសារដែលបានផ្ទុកឡើង'],
 '压缩中…':['Compressing…','កំពុងបង្រួម…'],
 '上传中…':['Uploading…','កំពុងផ្ទុកឡើង…'],
 '上传完成':['Upload complete','ផ្ទុកឡើងបានបញ្ចប់'],
 '上传失败，请重试':['Upload failed. Please retry.','ផ្ទុកឡើងបរាជ័យ។ សូមព្យាយាមម្ដងទៀត។'],
 '上传进度':['Upload progress','វឌ្ឍនភាពផ្ទុកឡើង'],
 '请检查：{field}':['Check {field}.','សូមពិនិត្យ {field}។'],
 '资料 {id} · 版本 {revision}':['Profile {id} · Version {revision}','ព័ត៌មាន {id} · កំណែ {revision}'],
 '资料 {id}':['Profile {id}','ព័ត៌មាន {id}'],
 '{status} · 版本 {revision}':['{status} · Version {revision}','{status} · កំណែ {revision}'],
 '{field}上传':['Upload {field}','ផ្ទុក {field}'],
 '电话号码示例：+855 12 345 678；请保留国家区号。':['Example: +855 12 345 678. Keep the country code.','ឧទាហរណ៍៖ +855 12 345 678។ សូមរក្សាលេខកូដប្រទេស។'],
 '证件号码示例：123456789':['ID number example: 123456789','ឧទាហរណ៍លេខអត្តសញ្ញាណប័ណ្ណ៖ 123456789'],
 '收款账户资料（审核必要项）':['Payout account (required)','គណនីទទួលប្រាក់ (ចាំបាច់)'],
 '资料授权确认（审核必要项）':['Data consent (required)','ការយល់ព្រមទិន្នន័យ (ចាំបាច់)'],
 '材料':['Document','ឯកសារ'],
 '联系人 3 请完整填写或全部留空':['Complete contact 3 or leave it blank','បំពេញទំនាក់ទំនងទី ៣ ឬទុកទទេ'],
 '联系人关系不能重复':['Choose a different relationship for each contact','ជ្រើសទំនាក់ទំនងខុសគ្នាសម្រាប់មនុស្សម្នាក់ៗ'],
 '车辆材料请选择并上传一份':['Choose and upload one vehicle document','ជ្រើស និងផ្ទុកឯកសារយានយន្តមួយ'],
 '当前设备不支持定位，可继续提交并由人工核对地址':['Location is unavailable. Continue for manual address review.','មិនអាចកំណត់ទីតាំងបាន។ បន្តដើម្បីឱ្យបុគ្គលិកពិនិត្យអាសយដ្ឋាន។'],
 '请在浏览器中决定是否授权定位。':['Choose whether to allow location in your browser.','ជ្រើសថាតើអនុញ្ញាតទីតាំងក្នុងកម្មវិធីរុករកឬអត់។'],
 '重试':['Retry','ព្យាយាមម្ដងទៀត'],'前往手机号登录':['Sign in with phone','ចូលដោយលេខទូរស័ព្ទ'],
 '请选择':['Choose','សូមជ្រើសរើស'],
 '省 / 直辖市':['Province / city','ខេត្ត / រាជធានី'],'区 / 县 / 市':['District','ស្រុក / ខណ្ឌ'],
 '工作类型':['Work type','ប្រភេទការងារ'],'公司 / 商店名称':['Company / shop name','ឈ្មោះក្រុមហ៊ុន / ហាង'],
 '行业':['Industry','វិស័យ'],'职位':['Position','តួនាទី'],'月收入区间':['Monthly income range','ចន្លោះចំណូលប្រចាំខែ'],
 '工作年限':['Time in job','រយៈពេលធ្វើការ'],'部门上司姓名':['Supervisor name','ឈ្មោះប្រធាន'],
 '部门上司电话（含国家区号）':['Supervisor phone (country code)','លេខទូរស័ព្ទប្រធាន រួមទាំងលេខកូដប្រទេស'],
 '车辆类型':['Vehicle type','ប្រភេទយានជំនិះ'],'住房类型':['Housing type','ប្រភេទលំនៅដ្ឋាន'],
 '收入 / 工作证明':['Income / work evidence','ភស្តុតាងចំណូល / ការងារ'],
 'KYC 资料审核已通过，可以开始贷款申请。':['KYC approved. You can start a loan application.','KYC បានអនុម័ត។ អ្នកអាចចាប់ផ្តើមដាក់ពាក្យកម្ចី។'],
 '最近审核意见 ·':['Latest review ·','មតិពិនិត្យចុងក្រោយ ·'],
 '返回资料分类':['Back to sections','ត្រឡប់ទៅផ្នែកព័ត៌មាន'],
 '原银行：':['Previous bank:','ធនាគារមុន៖'],
 '，请重新选择支持的银行。':['. Choose a supported bank.','។ ជ្រើសធនាគារដែលគាំទ្រ។'],
 '（选填）':['(optional)','(ស្រេចចិត្ត)'],
 '如无适用项，请联系审核人员，勿填写不符信息。':['If no option fits, contact a reviewer. Do not enter incorrect information.','បើគ្មានជម្រើសសមស្រប សូមទាក់ទងអ្នកពិនិត្យ។ កុំបញ្ចូលព័ត៌មានមិនត្រឹមត្រូវ។'],
 '车辆材料 *':['Vehicle document *','ឯកសារយានយន្ត *'],
 '车辆材料类型':['Vehicle document type','ប្រភេទឯកសារយានយន្ត'],
 '车辆材料上传':['Upload vehicle document','ផ្ទុកឯកសារយានយន្ត'],
 '图片压缩后单份不超过 5 MB；PDF 单份不超过 10 MB。图片支持 JPG/PNG，证明材料可使用 PDF。PDF 以下载方式查看。':['JPG/PNG: up to 5 MB after compression. PDF evidence: up to 10 MB, viewed by download.','JPG/PNG៖ មិនលើស ៥ MB ក្រោយបង្រួម។ ឯកសារភស្តុតាង PDF៖ មិនលើស ១០ MB មើលដោយទាញយក។'],
 '提交审核':['Submit for review','ដាក់ស្នើឱ្យពិនិត្យ'],
 '返回首页':['Back to home','ត្រឡប់ទៅទំព័រដើម'],
 '身份资料审核中':['KYC review in progress','កំពុងពិនិត្យព័ត៌មាន KYC'],
 '预计 24 小时内完成审核。':['Review is expected within 24 hours.','រំពឹងថាការពិនិត្យនឹងបញ្ចប់ក្នុងរយៈពេល ២៤ ម៉ោង។'],
 '资料已通过人工审核。返回贷款页面确认 KYC 后继续申请；最终贷款决定由机构作出。':['Profile approved. Return to loans to continue. The institution makes the final loan decision.','ព័ត៌មានបានអនុម័ត។ ត្រឡប់ទៅទំព័រកម្ចីដើម្បីបន្ត។ ស្ថាប័នជាអ្នកសម្រេចចុងក្រោយលើកម្ចី។'],
};
const optionZh:Record<string,string>={'None':'无','Primary':'小学','Secondary':'初中','High School':'高中','University':'大学','Masters/PHD':'硕士／博士','Staff':'员工','Manager':'经理','Boss':'负责人','Agriculture/Forestry/Fishery':'农林渔业','Civil Service':'公务员','Construction':'建筑业','Education':'教育','Engineering/Machinery/Electronics':'工程／机械／电子','Finance/Insurance/Accounting':'金融／保险／会计','Food/Beverages':'餐饮','Garment':'服装','HR':'人力资源','Infrastructure':'基础设施','IT':'信息技术','Logistics':'物流','Medical/Healthcare':'医疗／保健','NGO':'非政府组织','Real Estate':'房地产','Retail':'零售','Telecommunication':'电信','Tourism':'旅游','Trading':'贸易','Others':'其他','Less than 3 months':'少于3个月','4-12 months':'4–12个月','1-3 years':'1–3年','More than 3 years':'超过3年','Freelancer':'自由职业','Business Owner':'企业主','Employee':'雇员','Other':'其他','Less than 100 USD':'低于100 USD','101-250 USD':'101–250 USD','251-350 USD':'251–350 USD','351-500 USD':'351–500 USD','501-700 USD':'501–700 USD','701-1000 USD':'701–1000 USD','More than 1000 USD':'超过1000 USD'};
export function kycText(text:string,locale:Locale):string{
 if(text.includes(' / ')&&/[\u1780-\u17ff]/.test(text)){const [en,km]=text.split(' / ');return locale==='zh'?optionZh[en]||text:locale==='km'?km:en}
 if(locale==='zh')return text;
 if(copy[text])return copy[text][locale==='km'?1:0];
 const progress=/^上传中 (\d+)%$/.exec(text);
 if(progress)return locale==='km'?`កំពុងផ្ទុកឡើង ${progress[1]}%`:`Uploading ${progress[1]}%`;
 const missing=/^(请补全：|请先完成：)(.*)$/.exec(text);
 if(missing)return (locale==='km'?'សូមបំពេញ៖ ':'Please complete: ')+missing[2].split('、').map(label=>kycText(label,locale)).join(', ');
 const retry=/^正在重试（第 (\d+) 次）$/.exec(text);
 if(retry)return locale==='km'?`កំពុងព្យាយាមម្ដងទៀត (${retry[1]})`:`Retrying (${retry[1]})`;
 const limit=/^单份材料不能超过 (.+)$/.exec(text);
 if(limit)return locale==='km'?`ឯកសារមួយមិនអាចលើស ${limit[1]} ទេ`:`Each file must be ${limit[1]} or smaller`;
 const location=/^设备报告 (.+)（精度约 (.+) 米）$/.exec(text);
 if(location)return locale==='km'?`ទីតាំងឧបករណ៍ ${location[1]} (ប្រហែល ${location[2]} m)`:`Device location ${location[1]} (about ${location[2]} m accuracy)`;
 // Stored geographic values are identifiers. Use supplied Khmer names where
 // present, otherwise retain the supplied Latin place name, never invent one.
 if(/^[\u4e00-\u9fff]+\s*\//.test(text)&&/[A-Za-z]/.test(text)){
  const parts=text.split('/').map(value=>value.trim());
  const native=parts.find(value=>/[\u1780-\u17ff]/.test(value)&&!/[A-Za-z\u4e00-\u9fff]/.test(value));
  const latin=parts.find(value=>/[A-Za-z]/.test(value)&&!/[\u4e00-\u9fff]/.test(value));
  if(locale==='km'&&native)return native;if(latin)return latin;
 }
 return legacyText(text,locale);
}
export function kycDate(value:string,locale:Locale){return new Date(value).toLocaleString({zh:'zh-CN',en:'en-GB',km:'km-KH'}[locale],{timeZone:'Asia/Phnom_Penh'})}
export function kycFormat(key:string,locale:Locale,values:Record<string,string|number>){return kycText(key,locale).replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??''))}
export function kycError(error:unknown,locale:Locale){const e=error as {code?:string;params?:Record<string,unknown>;message?:string};if(e.code==='KYC_UPLOAD_INTERRUPTED')return kycText('网络较慢，上传中断，请重试',locale);if(e.code)return messageForError(e,locale);const translated=kycText(e.message||'',locale);return translated!==e.message?translated:messageForError({code:'REQUEST_FAILED'},locale)}
