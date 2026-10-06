import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{screen:string}>}){const {screen}=await params;if(!['login','apply','bill','sign','status','repay','withdraw','records','me','kyc','contract'].includes(screen))notFound();await requireChatGPTUser('/h5/'+screen);return null}
