import {guardKyc} from '@/lib/team/server';
import {reviewer,fileRow,findCase,KycError,type CaseRow} from './server';
import type {MaterialReadAction} from './material-read-audit';
import type {Slot} from './core';

export type MaterialReadAuthorization={file:Awaited<ReturnType<typeof fileRow>>;caseRow:CaseRow;tenantId:string;actorId:string;caseId:string;revision:number;slot:Slot;action:MaterialReadAction;requestId:string};

/** Re-checks server-side identity, ownership and reviewer assignment before auditing a material read. */
export async function authorizeMaterialRead(request:Request,options:{id:string;action:MaterialReadAction;requestId:string;caseId?:string;revision?:number}) : Promise<MaterialReadAuthorization>{
 const staff=await reviewer(),tenantId=staff.userId,actorId=staff.actorId;
 const file=await fileRow(tenantId,options.id);
 await guardKyc(tenantId,file.customer_id);
 const caseRow=await findCase(tenantId,file.customer_id);
 if(!caseRow)throw new KycError('资料不存在或不可访问',404);
 if(options.caseId&&options.caseId!==caseRow.id)throw new KycError('资料版本已变化，请刷新后查看',409);
 if(options.revision!==undefined&&options.revision!==caseRow.revision)throw new KycError('资料版本已变化，请刷新后查看',409);
 return {file,caseRow,tenantId,actorId,caseId:caseRow.id,revision:caseRow.revision,slot:file.slot,action:options.action,requestId:options.requestId};
}
