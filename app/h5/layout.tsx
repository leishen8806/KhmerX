import type {ReactNode} from 'react';
import Script from 'next/script';
import H5Login from './login';

export default function H5Layout({children}:{children:ReactNode}){
 return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive"/>{children}<H5Login/></>;
}
