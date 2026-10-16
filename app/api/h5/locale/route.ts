import {customer,input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';

export async function POST(request:Request){
 try{
  sameOrigin(request);
  const {ownerId,r,session}=await customer(request),body=await input(request);
  if(!['en','km','zh'].includes(body.locale))throw new AuthError('语言选项无效');
  await r.db.prepare('UPDATE h5_accounts SET locale=? WHERE owner=? AND customer_id=?').bind(body.locale,ownerId,session.customerId).run();
  return json({ok:true,locale:body.locale});
 }catch(e){return failure(e,request)}
}
