import {reviewer,getCase,payload,KycError,boundedBody} from './server';
import {audit,guardKyc} from '@/lib/team/server';
import {requireOrigin} from '@/lib/http/route';
import {requestIdOf,resolveRequestId} from '@/lib/http/request-id';
import {sensitiveFields,type SensitiveField} from './staff-projection';
import {mintRevealToken,type RevealScope} from './reveal-token';

const recent=new Map<string,{promise:Promise<void>;expiresAt:number}>();
async function audited(scope:RevealScope,requestId:string){
 const now=Date.now();for(const [key,item] of recent)if(item.expiresAt<=now)recent.delete(key);
 const key=JSON.stringify([scope.tenant,scope.actor,scope.caseId,scope.revision,scope.field]);let entry=recent.get(key);
 if(!entry){
  if(recent.size>=1000)recent.delete(recent.keys().next().value!);
  const promise=Promise.resolve().then(async()=>{await audit(scope.tenant,scope.actor,'kyc_sensitive_reveal',{caseId:scope.caseId,revision:scope.revision,field:scope.field,requestId}).run();});
  entry={promise,expiresAt:now+30000};recent.set(key,entry);
 }
 try{await entry.promise;}catch{if(recent.get(key)===entry)recent.delete(key);throw new KycError('敏感资料访问审计暂不可用',500);}
}
export async function revealKycValue(request:Request){
 requireOrigin(request);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new KycError('请求格式无效',415);
 let input:Record<string,unknown>;
 try{input=JSON.parse(new TextDecoder().decode(await boundedBody(request,4096)));}catch(error){if(error instanceof KycError)throw error;throw new KycError('请求格式无效',400);}
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.id!=='string'||!input.id.trim()||input.id.length>200||!Number.isSafeInteger(input.revision)||(input.revision as number)<0||!sensitiveFields.includes(input.field as SensitiveField))throw new KycError('请求参数无效',400);
 const user=await reviewer();if(!user.team||user.team.member.role==='audit')throw new KycError('无权显示敏感资料',403);
 const row=await getCase(user.userId,input.id);await guardKyc(user.userId,row.customer_id);
 if(row.revision!==input.revision)throw new KycError('资料已更新，请重新读取后审核',409);
 const field=input.field as SensitiveField;let value:string;
 try{value=String((await payload(row)).profile.values[field]??'');}catch{throw new KycError('敏感资料暂不可用',500);}
 const scope={tenant:user.userId,actor:user.actorId,caseId:row.id,revision:row.revision,field};
 await audited(scope,requestIdOf(request)??resolveRequestId(request));
 return {field,value,revealToken:await mintRevealToken(scope)};
}
