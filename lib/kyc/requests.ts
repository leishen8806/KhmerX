import {fields,slots,sections,slotVisible,KycError,type Profile,type Slot} from './core.ts';
export type KycRequest={target:string;reasonCode:string;note:string};
/** Tuple order: zh, en, km. Codes are the wire values, never translated. */
export const reasonCodes={
 blurred:['照片模糊','Photo is blurry','រូបថតមិនច្បាស់'],
 incomplete_document:['证件不完整','Document is incomplete','ឯកសារមិនពេញលេញ'],
 selfie_mismatch:['自拍与证件不符','Selfie does not match document','រូបថតខ្លួនឯងមិនត្រូវនឹងឯកសារ'],
 data_mismatch:['信息与证件不一致','Information does not match document','ព័ត៌មានមិនត្រូវនឹងឯកសារ'],
 contact_unreachable:['联系人无法接通','Contact cannot be reached','មិនអាចទាក់ទងអ្នកទំនាក់ទំនងបាន'],
 income_unclear:['收入证明不清','Income evidence is unclear','ភស្តុតាងចំណូលមិនច្បាស់'],
 other:['其他','Other','ផ្សេងទៀត'],
} as const;
const targets=new Map<string,string>([
 ...fields.map(f=>['field:'+f.id,f.section] as [string,string]),
 ...slots.filter(s=>s.id!=='signature').map(s=>['slot:'+s.id,s.section] as [string,string]),
 ...sections.map(s=>['section:'+s.id,s.id] as [string,string]),
]);
export function requestSection(target:string):string|undefined{return targets.get(target)}
export function requestReason(code:string,locale:'zh'|'en'|'km'):string{
 const text=Object.hasOwn(reasonCodes,code)?reasonCodes[code as keyof typeof reasonCodes]:reasonCodes.other;
 return text[locale==='zh'?0:locale==='en'?1:2];
}
export function parseRequests(raw:unknown,profile?:Profile):KycRequest[]|undefined{
 if(raw===undefined)return undefined;
 if(!Array.isArray(raw)||raw.length>32)throw new KycError('补件项目格式无效');
 const seen=new Set<string>();
 return raw.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['target','reasonCode','note'].includes(k)))throw new KycError('补件项目格式无效');
  const {target,reasonCode,note}=item;
  if(typeof target!=='string'||!requestSection(target)||seen.has(target)||typeof reasonCode!=='string'||!Object.hasOwn(reasonCodes,reasonCode)||typeof note!=='string'||note.length>500)throw new KycError('补件目标、原因或说明无效');
  if(reasonCode==='other'&&!note.trim())throw new KycError('其他补件原因必须填写说明');
  if(profile&&target.startsWith('slot:')&&!slotVisible(target.slice(5) as Slot,profile))throw new KycError('补件材料不适用于当前资料');
  seen.add(target);return {target,reasonCode,note:note.trim()};
 });
}
