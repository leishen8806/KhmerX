import {db,staff,audit,requireMfaStepUp} from '@/lib/team/server';
import {input,json} from '@/lib/h5-auth';
import {validatePricing,type Pricing} from '@/lib/pricing';
import {route} from '@/lib/http/route';
import {ApiError} from '@/lib/http/api-error';
export const dynamic='force-dynamic';
const text=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const rolesWrite=['admin','ops'];
function configOf(p:any):{minCents:number;maxCents:number;terms:number[];pricing:Pricing}{
 const minCents=Math.round(Number(p.minCents)),maxCents=Math.round(Number(p.maxCents));
 const terms:number[]=Array.isArray(p.terms)?(p.terms.map((x:any)=>Number(x)).filter((x:number)=>Number.isInteger(x)&&x>0&&x<=365) as number[]):[];
 if(!Number.isInteger(minCents)||!Number.isInteger(maxCents)||minCents<=0||maxCents<minCents||maxCents>100000000||!terms.length)throw new ApiError(400,'VALIDATION_FAILED','请填写有效的金额范围和期限');
 let pricing:Pricing;
 try{pricing=validatePricing({...p.pricing,version:Number(p.pricing?.version||0),feeModel:'single'})}catch(e){throw new ApiError(400,'VALIDATION_FAILED',e instanceof Error?e.message:'定价配置无效')}
 return {minCents,maxCents,terms:Array.from(new Set<number>(terms)).sort((a,b)=>a-b),pricing};
}
async function context(){const s=await staff();if(!s)throw new ApiError(403,'FORBIDDEN','请先选择公司');return {...s,userId:s.user.userId}}
export const GET=route({handler:async()=>{
 const s=await context();
 if(!rolesWrite.includes(s.member.role)&&s.member.role!=='admin')throw new ApiError(403,'FORBIDDEN','当前岗位无权查看贷款产品');
 const rows=await db().prepare(`SELECT p.*,v.version,v.config_json,v.status AS version_status,v.change_reason,v.created_at AS version_created_at FROM loan_products p LEFT JOIN loan_product_versions v ON v.product_id=p.id AND v.version=p.current_version WHERE p.tenant_id=? ORDER BY p.updated_at DESC`).bind(s.tenant.id).all<any>();
 return json({products:rows.results.map(r=>({...r,config:r.config_json?JSON.parse(r.config_json):null,config_json:undefined}))});
}});
export const POST=route({origin:'required',handler:async(request:Request)=>{
 try{
  const p=await input(request),s:any=await context();
  const role=s.member.role;
  if(!rolesWrite.includes(role)&&role!=='admin')throw new ApiError(403,'FORBIDDEN','无权管理贷款产品');
  const now=new Date().toISOString();
  if(p.action==='product_create'){
   if(!rolesWrite.includes(role))throw new ApiError(403,'FORBIDDEN','仅管理员或运营人员可创建产品');
   const code=text(p.code,40);if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(code))throw new ApiError(400,'VALIDATION_FAILED','产品代码需为 3–40 位小写字母、数字或短横线');
   const nameZh=text(p.nameZh,80),nameEn=text(p.nameEn,80),nameKm=text(p.nameKm,120),reason=text(p.reason,300);if(!nameZh||!nameEn||!nameKm||!reason)throw new ApiError(400,'VALIDATION_FAILED','请填写三语名称和变更原因');
   const c=configOf(p);const id=crypto.randomUUID();
   await db().batch([db().prepare('INSERT INTO loan_products(id,tenant_id,code,name_zh,name_en,name_km,product_type,currency,min_cents,max_cents,terms_json,status,current_version,created_by,created_at,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,s.tenant.id,code,nameZh,nameEn,nameKm,'short_term','USD',c.minCents,c.maxCents,JSON.stringify(c.terms),'draft',1,s.userId,now,s.userId,now),db().prepare('INSERT INTO loan_product_versions(id,product_id,tenant_id,version,config_json,status,change_reason,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,s.tenant.id,1,JSON.stringify(c),'draft',reason,s.userId,now),audit(s.tenant.id,s.userId,'loan_product_create',{id,code,version:1,reason})]);
   return json({ok:true,id},201);
  }
  const productId=text(p.productId,80);if(!productId)throw new ApiError(400,'VALIDATION_FAILED','缺少产品');
  const product=await db().prepare('SELECT * FROM loan_products WHERE id=? AND tenant_id=?').bind(productId,s.tenant.id).first<any>();if(!product)throw new ApiError(404,'NOT_FOUND','产品不存在');
  if(p.action==='product_submit_review'){
   if(!rolesWrite.includes(role))throw new ApiError(403,'FORBIDDEN','无权提交审核');
   if(product.status!=='draft')throw new ApiError(409,'CONFLICT','仅草稿可提交审核');
   await db().batch([db().prepare("UPDATE loan_products SET status='review',updated_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status='draft'").bind(s.userId,now,productId,s.tenant.id),db().prepare("UPDATE loan_product_versions SET status='review' WHERE product_id=? AND tenant_id=? AND version=? AND status='draft'").bind(productId,s.tenant.id,product.current_version),audit(s.tenant.id,s.userId,'loan_product_submit_review',{productId,version:product.current_version})]);
   return json({ok:true});
  }
  if(p.action==='product_review'){
   if(role!=='admin')throw new ApiError(403,'FORBIDDEN','仅公司管理员可审核产品');
   await requireMfaStepUp(s,p.code);
   const decision=p.decision==='approve'?'approve':p.decision==='reject'?'reject':'';const reason=text(p.reason,300);if(!decision||!reason)throw new ApiError(400,'VALIDATION_FAILED','请选择审核结果并填写原因');
   const v=await db().prepare("SELECT * FROM loan_product_versions WHERE product_id=? AND tenant_id=? AND version=? AND status='review'").bind(productId,s.tenant.id,product.current_version).first<any>();if(!v)throw new ApiError(404,'NOT_FOUND','当前没有待审核版本');
   if(v.created_by===s.userId)throw new ApiError(409,'CONFLICT','不能审核自己提交的产品版本');
   const next=decision==='approve'?'active':'draft';
   await db().batch([db().prepare('INSERT INTO loan_product_reviews(id,product_id,version,tenant_id,decision,reason,reviewer_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),productId,v.version,s.tenant.id,decision,reason,s.userId,now),db().prepare('UPDATE loan_product_versions SET status=?,reviewed_by=?,reviewed_at=?,published_at=? WHERE id=?').bind(next,s.userId,now,decision==='approve'?now:null,v.id),db().prepare('UPDATE loan_products SET status=?,updated_by=?,updated_at=? WHERE id=? AND tenant_id=?').bind(next,s.userId,now,productId,s.tenant.id),audit(s.tenant.id,s.userId,'loan_product_review',{productId,version:v.version,decision,reason})]);
   return json({ok:true});
  }
  if(p.action==='product_retire'){
   if(role!=='admin')throw new ApiError(403,'FORBIDDEN','仅公司管理员可下线产品');
   await requireMfaStepUp(s,p.code);
   if(product.status!=='active')throw new ApiError(409,'CONFLICT','仅已生效产品可下线');
   await db().batch([db().prepare("UPDATE loan_products SET status='retired',updated_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status='active'").bind(s.userId,now,productId,s.tenant.id),db().prepare("UPDATE loan_product_versions SET status='retired' WHERE product_id=? AND tenant_id=? AND version=?").bind(productId,s.tenant.id,product.current_version),audit(s.tenant.id,s.userId,'loan_product_retire',{productId,version:product.current_version})]);
   return json({ok:true});
  }
  throw new ApiError(400,'VALIDATION_FAILED','操作无效');
 }catch(e){
  console.error('loan_product_operation_failed',e instanceof Error?{name:e.name,message:e.message,stack:e.stack}:e);
  throw e;
 }
}});
