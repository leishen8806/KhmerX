import {findCase} from '@/lib/kyc/server';
import {pricingFor} from '@/lib/team/server';
import {customer,input,json,failure} from '@/lib/h5-auth';
import {readState,mutate} from '@/lib/store';
import {KycError} from '@/lib/kyc/core';
import {customerState} from '@/lib/domain';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {ownerId,session}=await customer(request),data=await readState(ownerId);return json({...data,kyc:await findCase(ownerId,session.customerId).then(k=>k?{status:k.status}:null),pricing:ownerId.startsWith('t_')?await pricingFor(ownerId):null,state:customerState(data.state,session.customerId)})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const {ownerId,session}=await customer(request),p=await input(request);try{if(['repay','withdraw'].includes(p.action))throw new KycError('还款或提现需通过机构审核及受支持的支付渠道处理',403,'CUSTOMER_SETTLEMENT_FORBIDDEN');const data=await mutate(ownerId,p,{id:session.customerId,phoneMasked:session.phoneMasked,channel:session.mode==='telegram'?'TG':'H5'});return json({...data,kyc:await findCase(ownerId,session.customerId).then(k=>k?{status:k.status}:null),pricing:ownerId.startsWith('t_')?await pricingFor(ownerId):null,state:customerState(data.state,session.customerId)})}catch(e){if(e instanceof KycError)return json({error:e.message,code:e.code},e.status);return json({error:'操作未完成，请确认申请归属、当前状态与填写内容后重试'},400)}}catch(e){return failure(e)}}
