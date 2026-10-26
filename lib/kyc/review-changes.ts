import {fields,slots,type Profile} from '@/lib/kyc/core';

export type FieldChange={id:string;oldValue?:string;newValue?:string};
export type MaterialChange={slot:string;oldFileId?:string|null;newFileId?:string|null};
const text=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value):'';
const masked=(value:string)=>!value?'':value.length<=4?'****':'****'+value.slice(value.length<=8?-2:-4);

/** Only schema fields and non-signature materials belong in the review diff. */
export function reviewChanges(before:Profile|null,after:Profile,role:string):{fields:FieldChange[];materials:MaterialChange[]}{
 const result:{fields:FieldChange[];materials:MaterialChange[]}={fields:[],materials:[]};
 if(!before)return result;
 for(const field of fields){
  const oldValue=text(before.values[field.id]),newValue=text(after.values[field.id]);
  if(oldValue===newValue)continue;
  const sensitive=field.id==='documentNumber'||field.id==='bankAccount';
  result.fields.push(role==='audit'?{id:field.id}:{id:field.id,oldValue:sensitive?masked(oldValue):oldValue,newValue:sensitive?masked(newValue):newValue});
 }
 for(const slot of slots){
  if(slot.id==='signature')continue;
  const oldFileId=text(before.files[slot.id]?.id)||null,newFileId=text(after.files[slot.id]?.id)||null;
  if(oldFileId!==newFileId)result.materials.push(role==='audit'?{slot:slot.id}:{slot:slot.id,oldFileId,newFileId});
 }
 return result;
}
