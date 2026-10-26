import type {Locale} from '../i18n';
export function contactRelationOwner(id:string,value:string,values:Record<string,string>){return [1,2,3].find(n=>`contact${n}Relation`!==id&&values[`contact${n}Relation`]===value)}
export function occupiedRelationText(owner:number,locale:Locale){return locale==='zh'?`已被联系人 ${owner} 使用`:locale==='km'?`បានប្រើដោយទំនាក់ទំនងទី ${owner}`:`Used by contact ${owner}`}
export function clearRelationText(locale:Locale){return locale==='zh'?'清除关系':locale==='km'?'សម្អាតទំនាក់ទំនង':'Clear relationship'}
