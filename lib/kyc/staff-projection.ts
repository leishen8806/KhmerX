import type {Profile} from './core';
export const sensitiveFields=['documentNumber','bankAccount'] as const;
export type SensitiveField=typeof sensitiveFields[number];
export const maskSensitive=(input:unknown)=>{const value=String(input??'');return !value?'':value.length<=4?'****':'****'+value.slice(value.length<=8?-2:-4);};
export function projectStaffProfile(profile:Profile,role:string){
 const values={...profile.values};for(const field of sensitiveFields)values[field]=maskSensitive(values[field]);
 return {profile:{...profile,values:role==='audit'?{}:values,files:role==='audit'?{}:{...profile.files}},sensitiveFields:{documentNumber:{masked:true as const},bankAccount:{masked:true as const}}};
}
