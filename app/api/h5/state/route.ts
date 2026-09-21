import {customer,input,json,failure} from '@/lib/h5-auth';
import {readState,mutate} from '@/lib/store';
import {customerState} from '@/lib/domain';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {ownerId,session}=await customer(request),data=await readState(ownerId);return json({...data,state:customerState(data.state,session.customerId)})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const {ownerId,session}=await customer(request),p=await input(request);try{const data=await mutate(ownerId,p,{id:session.customerId,phoneMasked:session.phoneMasked});return json({...data,state:customerState(data.state,session.customerId)})}catch{return json({error:'操作未完成，请确认申请归属、当前状态与填写内容后重试'},400)}}catch(e){return failure(e)}}
