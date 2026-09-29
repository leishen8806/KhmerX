import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {loanTerms} from '@/lib/agreements/loan-terms';
export const dynamic='force-dynamic';
export const metadata={title:'借款协议 · PayEase'};
export default async function LoanAgreement(){
 await requireChatGPTUser('/agreements/loan');
 const headings=loanTerms.blocks.filter(b=>b.type==='heading');let section=0;
 return <main className="agreement-shell"><header className="kyc-header"><a className="brand" href="/h5"><img className="brand-logo" src="/brand/khmerx-icon.png" alt="KhmerX" width={72} height={72}/><span>KhmerX</span><small>PAYEASE</small></a><a className="text-link" href="/kyc">返回资料填写</a></header>
 <article className="agreement-article"><p className="eyebrow">PAYEASE / 借款协议</p><h1>借款协议</h1><p className="agreement-subtitle">{loanTerms.blocks.find(b=>b.type==='title')?.text}</p>
 <aside className="sample"><strong>测试环境 · 协议阅读</strong><p>以下为《借款条款-中文版》原文。原文所述“特别典当票据”未包含在本页面内。当前为测试资金流程，阅读与勾选仅用于流程验收，不产生真实借贷合同。</p></aside>
 <nav className="agreement-toc" aria-label="协议目录"><h2>条款目录</h2>{headings.map((b,i)=><a key={i} href={'#clause-'+(i+1)}>{b.text}</a>)}</nav>
 <div className="agreement-body">{loanTerms.blocks.filter(b=>b.type!=='title').map((b,i)=>b.type==='heading'?<h2 id={'clause-'+(++section)} key={i}>{b.text}</h2>:<p key={i}>{b.text}</p>)}</div>
 <footer className="agreement-footer"><p>来源：{loanTerms.source}</p><p>协议版本：{loanTerms.version}</p><a className="text-link" href="/kyc">返回资料填写</a><p>从资料页打开本协议时，可切回原页面继续填写。</p></footer></article></main>
}
