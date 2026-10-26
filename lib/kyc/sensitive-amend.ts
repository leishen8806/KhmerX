import {KycError} from './core';
import {sensitiveFields,maskSensitive} from './staff-projection';
import {verifyRevealToken,type RevealScope} from './reveal-token';

export async function mergeSensitiveAmend(original:Record<string,string>,values:Record<string,unknown>,metadata:unknown,scope:Omit<RevealScope,'field'>){
 const merged={...original,...values};
 const marks=metadata&&typeof metadata==='object'?metadata as Record<string,unknown>:{};
 for(const field of sensitiveFields){
  const raw=values[field],value=typeof raw==='string'?raw.trim():raw,mark=marks[field] as {masked?:unknown;dirty?:unknown;revealToken?:unknown}|undefined;
  if(value===undefined||mark?.masked===true||(typeof value==='object'&&value!==null&&(value as {masked?:unknown}).masked===true)||value===maskSensitive(original[field])||(typeof value==='string'&&/^[*•]{4}/.test(value))||value===original[field]){merged[field]=original[field]??'';continue;}
  if(typeof value!=='string'||mark?.dirty!==true||mark.masked!==false)throw new KycError('请重新显示敏感字段后再修改',403);
  await verifyRevealToken(mark.revealToken,{...scope,field});
 }
 return merged;
}
