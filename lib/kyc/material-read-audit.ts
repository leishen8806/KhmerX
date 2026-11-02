import {slots,type Slot} from './core.ts';
import {auditInsertSql} from '@/lib/team/audit-writer';
export type MaterialReadAction='thumbnail'|'preview'|'download'|'read';
export type MaterialReadAuditContext={tenantId:string;actorId:string;caseId:string;revision:number;slot:Slot;fileId:string;action:MaterialReadAction;requestId:string};
type AuditDb={prepare:(sql:string)=>{bind:(...args:unknown[])=>{run:()=>Promise<{meta?:{changes?:number}}>}}};
const ACTIONS=new Set<MaterialReadAction>(['thumbnail','preview','download','read']);
const SLOT_IDS=new Set(slots.map(slot=>slot.id));
function validate(context:MaterialReadAuditContext,nowMs:number){
 if(!context||typeof context!=='object'||typeof context.tenantId!=='string'||!context.tenantId||typeof context.actorId!=='string'||!context.actorId||typeof context.caseId!=='string'||!context.caseId||typeof context.fileId!=='string'||!context.fileId||typeof context.requestId!=='string'||!context.requestId||!Number.isInteger(context.revision)||context.revision<1||!SLOT_IDS.has(context.slot)||!ACTIONS.has(context.action)||!Number.isFinite(nowMs))throw new TypeError('invalid material read audit context');
}
function detailJson(context:MaterialReadAuditContext){return JSON.stringify({caseId:context.caseId,revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,requestId:context.requestId});}
function keyJson(context:MaterialReadAuditContext,bucket:number){return JSON.stringify({tenantId:context.tenantId,actorId:context.actorId,caseId:context.caseId,revision:context.revision,slot:context.slot,fileId:context.fileId,action:context.action,bucket});}
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}

/** Append one redacted material-read audit event per actor/material/action/30-second bucket. */
export async function auditMaterialRead(context:MaterialReadAuditContext,nowMs:number,db:AuditDb){
 validate(context,nowMs);const bucket=Math.floor(nowMs/30_000)*30_000,json=detailJson(context),createdAt=new Date(nowMs).toISOString();
 const id=await sha256(keyJson(context,bucket));
 const result=await auditInsertSql(db,context.tenantId,context.actorId,'kyc_material_read',JSON.parse(json),id,'1=1',createdAt).run();
 return {id,createdAt,bucket,inserted:Number(result.meta?.changes||0)===1};
}
