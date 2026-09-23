import {requireChatGPTUser} from '../chatgpt-auth';
import Script from 'next/script';
import H5Login from './login';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/h5');return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"/><H5Login/></>}
