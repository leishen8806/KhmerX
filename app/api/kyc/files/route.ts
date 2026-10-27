import {context,origin,initialize,boundedBody,recordFile,fileRow,metadata,decryptFileObject,bucket,db,json,failed,KycError} from '@/lib/kyc/server';
import {auditMaterialRead,type MaterialReadAction} from '@/lib/kyc/material-read-audit';
import {authorizeMaterialRead} from '@/lib/kyc/material-read-context';
import {slots,fileType,type Slot} from '@/lib/kyc/core';
import {kycFileMaxBytes} from '@/lib/kyc/limits';
import {attachRequestId,requestIdOf,resolveRequestId} from '@/lib/http/request-id';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const started=Date.now(),requestId=requestIdOf(request)??resolveRequestId(request);attachRequestId(request,requestId);
 try{
  origin(request);const c=await context(request),row=await initialize(c.owner,c.customerId,c.verified);
  if(!['draft','needs_info'].includes(row.status))throw new KycError('资料已锁定，无法上传',409);
  const slot=request.headers.get('x-kyc-slot') as Slot;
  if(slot==='signature')throw new KycError('手写签名请在贷款申请后的签约页面完成');
  if(!slots.some(s=>s.id===slot))throw new KycError('材料类型无效');
  const bytes=await boundedBody(request,kycFileMaxBytes(request.headers.get('content-type')||''));
  if(bytes.length<16)throw new KycError('文件为空或损坏');
  return json(await recordFile(c.owner,c.customerId,slot,bytes,fileType(bytes,slot),requestId),200,{},request);
 }catch(e){return failed(e,request)}finally{console.info('[kyc-upload-request]',{requestId,durationMs:Date.now()-started})}
}
function readParams(request:Request){const url=new URL(request.url);for(const key of ['id','view','caseId','revision','review'])if(url.searchParams.getAll(key).length>1)throw new KycError('请求参数重复',400);const id=url.searchParams.get('id')||'',action=(url.searchParams.get('view')||'read') as MaterialReadAction,caseId=url.searchParams.get('caseId')||undefined,revisionRaw=url.searchParams.get('revision');let revision:number|undefined;if(revisionRaw!==null){if(!/^\d+$/.test(revisionRaw)||Number(revisionRaw)<1)throw new KycError('revision 无效',400);revision=Number(revisionRaw)}return {id,review:url.searchParams.get('review')==='1',action,caseId,revision}}
export async function GET(request:Request){try{const {id,review,action,caseId,revision}=readParams(request),requestId=requestIdOf(request)??resolveRequestId(request);if(!['thumbnail','preview','download','read'].includes(action))throw new KycError('材料读取意图无效',400);let row:Awaited<ReturnType<typeof fileRow>>;if(review){const authorized=await authorizeMaterialRead(request,{id,action,requestId,caseId,revision});row=authorized.file;try{await auditMaterialRead({tenantId:authorized.tenantId,actorId:authorized.actorId,caseId:authorized.caseId,revision:authorized.revision,slot:authorized.slot,fileId:row.id,action,requestId},Date.now(),db())}catch{throw new KycError('材料审计暂不可用，请稍后重试',503)}}else{const c=await context(request);row=await fileRow(c.owner,id,c.customerId)}const ref=await metadata(row),object=await bucket().get('kyc/'+id);if(!object)throw new KycError('材料暂不可用',404);const bytes=await decryptFileObject(new Uint8Array(await object.arrayBuffer()),row);return new Response(bytes,{headers:{'Content-Type':ref.type,'Content-Disposition':`${ref.type==='application/pdf'?'attachment':'inline'}; filename="${ref.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}})}catch(e){return failed(e,request)}}
