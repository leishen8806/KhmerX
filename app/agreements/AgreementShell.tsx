import Link from 'next/link';
import type {ReactNode} from 'react';
import {MiniNavLink} from '@/components/mini-shell';
import styles from './agreement-shell.module.css';

type AgreementShellProps = {
  children: ReactNode;
  title: string;
  source?: string;
  version?: string;
  backHref?: string;
  backLabel?: string;
  mini?: boolean;
};

export function AgreementShell({children,title,source,version,backHref='/kyc',backLabel='返回 KYC',mini=false}:AgreementShellProps){
 const Navigation=mini?MiniNavLink:Link;
 return <main className={`agreement-shell ${styles.shell}`}>
  <header className="kyc-header">
   <a className="brand" href="/h5"><img className={`brand-logo ${styles.logo}`} src="/brand/khmerx-icon-v2.png" alt="KhmerX"/><span>KhmerX</span><small>PAYEASE</small></a>
   <Navigation className="text-link" href={backHref}>{backLabel}</Navigation>
  </header>
  <article className={`agreement-article ${styles.article}`}>
   <h1>{title}</h1>
   {children}
   <footer className={`agreement-footer ${styles.footer}`}>
    {source&&<p>来源：<span data-i18n-skip="true">{source}</span></p>}
    {version&&<p>协议版本：<span data-i18n-skip="true">{version}</span></p>}
    <Navigation className="text-link" href={backHref}>{backLabel}</Navigation>
    <p>{title}页面内容仅用于流程查看。</p>
   </footer>
  </article>
 </main>;
}
