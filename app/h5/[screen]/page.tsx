import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {notFound} from 'next/navigation';
import Script from 'next/script';
import H5Login from '../login';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{screen:string}>}){const {screen}=await params;if(!['login','apply','bill','sign','status','repay','withdraw','records','me','kyc'].includes(screen))notFound();await requireChatGPTUser('/h5/'+screen);return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"/><H5Login screen={screen}/></>}
