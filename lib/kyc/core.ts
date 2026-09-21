import source from './options.json' with {type:'json'};
export const RULE_VERSION=source.version;
export const choices=source.options;
export const regions=source.regions;
export type KycStatus='draft'|'submitted'|'needs_info'|'approved'|'rejected';
export const statusLabels:Record<KycStatus,string>={draft:'草稿',submitted:'待人工审核',needs_info:'待补件',approved:'人工资料审核通过',rejected:'资料审核未通过'};
export const sections=[{id:'identity',label:'个人与身份资料'},{id:'contacts',label:'紧急联系人'},{id:'employment',label:'工作与资产'},{id:'bank',label:'收款账户资料'},{id:'consent',label:'授权与签名'}] as const;
export type Section=typeof sections[number]['id'];
export type Field={id:string;label:string;section:Section;required?:boolean;options?:{value:string;label:string}[];kind?:'phone'|'select';source:string};
const opts=(values:string[])=>values.map(x=>({value:x,label:x}));
export const fields:Field[]=[
 {id:'surname',label:'姓',section:'identity',required:true,source:'B2:F3'},
 {id:'givenName',label:'名',section:'identity',required:true,source:'B2:F3'},
 {id:'gender',label:'性别',section:'identity',required:true,options:opts(['男','女']),source:'B4:F5'},
 {id:'education',label:'学历',section:'identity',required:true,options:choices.education,source:'B6:F6 / 附件一'},
 {id:'marital',label:'婚姻状态',section:'identity',required:true,options:opts(['已婚','未婚']),source:'B7:F8'},
 {id:'province',label:'省 / 直辖市',section:'identity',required:true,options:regions.map(x=>({value:x.value,label:x.value})),source:'B9:F10 / 附件七'},
 {id:'district',label:'区 / 县 / 市',section:'identity',required:true,source:'B9:F10 / 附件七'},
 {id:'address',label:'详细住址',section:'identity',required:true,source:'B9:F10'},
 ...[1,2,3].flatMap(n=>[
  {id:`contact${n}Name`,label:`联系人 ${n} 姓名`,section:'contacts' as Section,required:n<3,source:`B${12+n*2}:F${13+n*2}`},
  {id:`contact${n}Phone`,label:`联系人 ${n} 电话（含国家区号）`,section:'contacts' as Section,required:n<3,kind:'phone' as const,source:`B${13+n*2}:F${13+n*2}`},
  {id:`contact${n}Relation`,label:`联系人 ${n} 关系`,section:'contacts' as Section,required:n<3,options:opts(['父母','配偶','亲属','朋友','村长','公司主管']),source:'D14:D19'}]),
 {id:'workType',label:'工作类型',section:'employment',required:true,options:choices.workType,source:'B20:F20 / 附件五'},
 {id:'company',label:'公司 / 商店名称',section:'employment',required:true,source:'B21:F21'},
 {id:'industry',label:'行业',section:'employment',required:true,options:choices.industry,source:'B22:F22 / 附件三'},
 {id:'position',label:'职位',section:'employment',required:true,options:choices.position,source:'B23:F23 / 附件二'},
 {id:'income',label:'月收入区间',section:'employment',required:true,options:choices.income,source:'B24:F24 / 附件六'},
 {id:'tenure',label:'工作年限',section:'employment',required:true,options:choices.tenure,source:'B25:F25 / 附件四'},
 {id:'supervisorName',label:'部门上司姓名',section:'employment',source:'B26:F26'},
 {id:'supervisorPhone',label:'部门上司电话（含国家区号）',section:'employment',kind:'phone',source:'B27:F27'},
 {id:'vehicle',label:'车辆类型',section:'employment',options:opts(['摩托车','嘟嘟车','汽车','无']),source:'B29:F32'},
 {id:'housing',label:'住房类型',section:'employment',options:opts(['租房','个人房产','无']),source:'B36:F38'},
 {id:'bankName',label:'银行名称',section:'bank',required:true,source:'B41:F41'},
 {id:'bankAccount',label:'银行账号',section:'bank',required:true,source:'B42:F42'},
 {id:'bankHolder',label:'账户姓名',section:'bank',required:true,source:'B43:F43'},
];
export const slots=[
 {id:'idFront',label:'身份证正面',section:'identity',required:true,points:5,source:'B11:F11'},
 {id:'idBack',label:'身份证反面',section:'identity',required:true,points:5,source:'B12:F12'},
 {id:'selfie',label:'个人自拍照',section:'identity',required:true,points:5,source:'B13:F13'},
 {id:'incomeProof',label:'收入 / 工作证明',section:'employment',required:true,points:5,source:'B28:F28'},
 {id:'vehicleInvoice',label:'购车发票',section:'employment',required:false,points:10,source:'D33:F33'},
 {id:'vehicleContract',label:'购车合同',section:'employment',required:false,points:20,source:'D34:F34'},
 {id:'vehiclePhoto',label:'车辆照片',section:'employment',required:false,points:5,source:'D35:F35'},
 {id:'rentContract',label:'租房合同',section:'employment',required:false,points:10,source:'D39:F39'},
 {id:'propertyCertificate',label:'房屋产权证',section:'employment',required:false,points:20,source:'D40:F40'},
 {id:'signature',label:'手写签名',section:'consent',required:true,points:5,source:'B46:F46'},
] as const;
export type Slot=typeof slots[number]['id'];
export type FileRef={id:string;slot:Slot;name:string;type:string;size:number;sha256:string};
export type Profile={values:Record<string,string>;files:Partial<Record<Slot,FileRef>>;consent:boolean;declarationVersion:string;location?:{lat:number;lon:number;accuracy:number;capturedAt:string}};
export const emptyProfile=():Profile=>({values:{},files:{},consent:false,declarationVersion:'kyc-review-consent-v1'});
export class KycError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
export function cleanProfile(raw:any):Profile{
 if(!raw||typeof raw!=='object'||!raw.values||typeof raw.values!=='object')throw new KycError('资料格式无效');
 const out=emptyProfile();
 for(const f of fields){const v=raw.values[f.id];if(v!==undefined&&typeof v!=='string')throw new KycError(f.label+'格式无效');let text=(v||'').trim();if(text.length>240)throw new KycError(f.label+'过长');if(f.kind==='phone')text=text.replace(/[\s()-]/g,'');if(text&&f.options&&!f.options.some(x=>x.value===text))throw new KycError(f.label+'选项无效');if(text&&f.kind==='phone'&&!/^\+[1-9]\d{7,14}$/.test(text))throw new KycError(f.label+'需使用国际号码格式');out.values[f.id]=text;}
 const district=out.values.district;if(district&&!regions.find(r=>r.value===out.values.province)?.districts.some(d=>d.value===district))throw new KycError('区县与省份不匹配');
 for(const slot of slots){const ref=raw.files?.[slot.id];if(ref){if(typeof ref.id!=='string'||!/^[a-f0-9-]{36}$/.test(ref.id))throw new KycError('附件编号无效');out.files[slot.id]={id:ref.id,slot:slot.id,name:'',type:'',size:0,sha256:''};}}
 out.consent=raw.consent===true;
 if(raw.location){const {lat,lon,accuracy,capturedAt}=raw.location;if(!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lon)||lon< -180||lon>180||!Number.isFinite(accuracy)||accuracy<0||typeof capturedAt!=='string'||!Number.isFinite(Date.parse(capturedAt)))throw new KycError('定位格式无效');out.location={lat,lon,accuracy,capturedAt};}
 return out;
}
export function missing(profile:Profile):string[]{
 const problems=fields.filter(f=>f.required&&!profile.values[f.id]).map(f=>f.label);
 for(const slot of slots)if(slot.required&&!profile.files[slot.id])problems.push(slot.label);
 if(!profile.consent)problems.push('资料提交与人工审核授权');
 for(const n of [3])if(['Name','Phone','Relation'].some(k=>profile.values[`contact${n}${k}`])&&!['Name','Phone','Relation'].every(k=>profile.values[`contact${n}${k}`]))problems.push(`联系人 ${n} 请完整填写姓名、电话和关系，或全部留空`);
 if(Boolean(profile.values.supervisorName)!==Boolean(profile.values.supervisorPhone))problems.push('上司姓名与电话需一并填写');
 const phones=[1,2,3].map(n=>profile.values[`contact${n}Phone`]).filter(Boolean);if(new Set(phones).size!==phones.length)problems.push('紧急联系人电话不能重复');
 return problems;
}
export function completeness(p:Profile,verifiedPhone:boolean){
 const rows:{label:string;points:number;maximum:number;additional:boolean;source:string}[]=[];
 const add=(label:string,maximum:number,ok:boolean,source:string,additional=false)=>rows.push({label,maximum,points:ok?maximum:0,source,additional});
 add('姓名',5,!!p.values.surname&&!!p.values.givenName,'F2:F3');
 for(const key of ['gender','education','marital']){const f=fields.find(f=>f.id===key)!;add(f.label,5,!!p.values[key],f.source)}
 add('完整住址',5,!!p.values.province&&!!p.values.district&&!!p.values.address,'F9:F10');
 for(const n of [1,2,3])for(const part of ['Name','Phone'])add(`联系人 ${n} ${part==='Name'?'姓名':'电话'}`,5,!!p.values[`contact${n}${part}`],`F${(part==='Name'?12:13)+n*2}`,n===3);
 for(const key of ['workType','company','industry','position','income','tenure','supervisorName','supervisorPhone']){const f=fields.find(f=>f.id===key)!;add(f.label,5,!!p.values[key],f.source,key.startsWith('supervisor'))}
 for(const slot of slots)add(slot.label,slot.points,!!p.files[slot.id],slot.source,!slot.required);
 add('资料授权',5,p.consent,'F45');add('Telegram 手机号验证',5,verifiedPhone,'F47');add('Telegram 账号验证（未接入）',5,false,'F48');add('自主授权定位（设备报告，非核验）',5,!!p.location,'F49');
 return {base:rows.filter(r=>!r.additional).reduce((s,r)=>s+r.points,0),baseMaximum:120,additional:rows.filter(r=>r.additional).reduce((s,r)=>s+r.points,0),additionalMaximum:85,rows};
}
export function validateReview(status:KycStatus,decision:string,checklist:Record<string,boolean>,reason:string,profile:Profile){
 if(status!=='submitted')throw new KycError('只有待审核资料可以处理，请刷新',409);
 if(!['approved','needs_info','rejected'].includes(decision))throw new KycError('审核决定无效');
 if(!reason.trim()||reason.trim().length>1000)throw new KycError('请填写 1–1000 字审核意见');
 if(decision==='approved'&&(missing(profile).length||sections.some(s=>checklist[s.id]!==true)))throw new KycError('通过前必须完成全部必填资料及逐项核对');
}
export function fileType(bytes:Uint8Array,slot:Slot){
 let type='';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)type='image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))type='image/png';
 if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')type='application/pdf';
 if(!type||(['selfie','signature','vehiclePhoto'].includes(slot)&&type==='application/pdf'))throw new KycError('请选择有效的 JPG / PNG 图片；证明材料也支持 PDF');
 return type;
}
