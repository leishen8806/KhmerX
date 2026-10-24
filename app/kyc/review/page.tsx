import {requireChatGPTUser} from '../../chatgpt-auth';
import KycClient from '../client';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string|string[]}>}){
 await requireChatGPTUser('/kyc/review');
 const {id}=await searchParams;
 if(typeof id!=='string'||!id.trim())redirect('/team/kyc?view='+encodeURIComponent('KYC 审核队列'));
 return <KycClient review/>;
}
