import {audit,guardKyc} from '@/lib/team/server';
import {reviewer,db,getCase,payload,json,failed,KycError,type CaseRow} from '@/lib/kyc/server';
import {reviewChanges} from '@/lib/kyc/review-changes';
import {attachRequestId,requestIdOf,resolveRequestId} from '@/lib/http/request-id';

export const dynamic='force-dynamic';

async function profileOf(row:CaseRow){
 try{
  const data=await payload(row),profile=data.profile;
  if(!profile||!profile.values||typeof profile.values!=='object'||Array.isArray(profile.values)||!profile.files||typeof profile.files!=='object'||Array.isArray(profile.files))throw new Error();
  return profile;
 }catch{
  // Do not send/log the ciphertext, decrypted values, or parser error excerpts.
  throw new KycError('审核差异资料暂不可用',500);
 }
}

export async function GET(request:Request){
 const requestId=requestIdOf(request)??resolveRequestId(request);attachRequestId(request,requestId);
 try{
  const u=await reviewer(),id=new URL(request.url).searchParams.get('id');
  if(!u.team)throw new KycError('当前工作区没有合规访问审计落点',403);
  if(!id?.trim())throw new KycError('缺少资料编号',400);
  const row=await getCase(u.userId,id);
  await guardKyc(u.userId,row.customer_id);
  const baseline=await db().prepare("SELECT revision,snapshot FROM kyc_history WHERE owner=? AND case_id=? AND revision<=? AND action IN ('review:approved','review:needs_info','review:rejected') ORDER BY revision DESC,created_at DESC,id DESC LIMIT 1").bind(u.userId,id,row.revision).first<{revision:number;snapshot:string}>();
  const current=await profileOf(row),before=baseline?await profileOf({...row,payload:baseline.snapshot}):null;
  const result={caseId:row.id,currentRevision:row.revision,baselineRevision:baseline?.revision??null,...reviewChanges(before,current,u.team.member.role)};
  await audit(u.userId,u.actorId,'kyc_changes_view',{caseId:row.id,currentRevision:row.revision,baselineRevision:baseline?.revision??null,requestId}).run();
  const response=json(result);response.headers.set('Cache-Control','no-store');response.headers.set('X-Request-Id',requestId);return response;
 }catch(error){return failed(error,request);}
}
