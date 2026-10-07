import type {ReactNode} from 'react';
import Script from 'next/script';
import H5Login from './login';

export default function H5Layout({children}:{children:ReactNode}){
 return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"/><Script id="legacy-greeting-patch" strategy="afterInteractive">{`(()=>{const run=()=>{const root=document.querySelector('.mini-app');if(!root)return;const user=window.Telegram?.WebApp?.initDataUnsafe?.user;const name=(user?.first_name||'').trim()||'Telegram';root.querySelectorAll('p').forEach((el)=>{if(el.textContent==='你好，{name}')el.textContent='你好，'+name});};run();new MutationObserver(run).observe(document.documentElement,{subtree:true,childList:true,characterData:true});})();`}</Script>{children}<H5Login/></>;
}
