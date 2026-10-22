import {customer,input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';

export async function POST(request:Request){
 try{
  sameOrigin(request);
  const {ownerId,r,session}=await customer(request),body=await input(request);
  if(!['en','km','zh'].includes(body.locale))throw new AuthError('语言选项无效');
  if(ownerId.startsWith('t_')){
   const company=await r.db.prepare('SELECT client_en_enabled,client_km_enabled,client_zh_enabled FROM team_companies WHERE id=? AND active=1').bind(ownerId).first<any>();
   const enabled=body.locale==='en'?company?.client_en_enabled:body.locale==='km'?company?.client_km_enabled:company?.client_zh_enabled;
   if(!company||Number(enabled)!==1)throw new AuthError('该语言尚未由公司启用',400,undefined,'LOCALE_DISABLED');
  }
  await r.db.prepare('UPDATE h5_accounts SET locale=? WHERE owner=? AND customer_id=?').bind(body.locale,ownerId,session.customerId).run();
  return json({ok:true,locale:body.locale});
 }catch(e){return failure(e,request)}
}
