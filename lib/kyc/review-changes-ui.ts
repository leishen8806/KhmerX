import {fields,slots} from '@/lib/kyc/core';
import {requestSection} from '@/lib/kyc/requests';
export type ReviewDiff={caseId:string;currentRevision:number;baselineRevision:number|null;fields:{id:string;oldValue?:string;newValue?:string}[];materials:{slot:string;oldFileId?:string|null;newFileId?:string|null}[]};
export function changedSections(diff:ReviewDiff|null){if(!diff||diff.baselineRevision===null)return [];const result=new Set<string>();for(const change of diff.fields){const field=fields.find(f=>f.id===change.id);if(field)result.add(field.section);}for(const change of diff.materials){const slot=slots.find(s=>s.id===change.slot&&s.id!=='signature');if(slot)result.add(slot.section);}return Array.from(result);}
export function requestChangeState(target:string,diff:ReviewDiff|null):'changed'|'pending'|'unknown'{
 if(!diff||diff.baselineRevision===null||!requestSection(target)||target==='section:consent')return 'unknown';
 const [kind,id]=target.split(':');const changed=kind==='field'?diff.fields.some(f=>f.id===id):kind==='slot'?diff.materials.some(s=>s.slot===id):changedSections(diff).includes(id);return changed?'changed':'pending';
}
export function safeChangeValue(id:string,input?:string){const value=String(input??'');if(!['documentNumber','bankAccount'].includes(id)||!value||/^\*{4}(?:.{0,4})$/.test(value))return value;return value.length<=4?'****':'****'+value.slice(value.length<=8?-2:-4);}
