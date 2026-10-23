import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function reviewer(){
 let cursor=0,tree;const state=[],effects=[],requests=[];
 const profile=core.emptyProfile();profile.consent=true;
 for(const f of core.fields)profile.values[f.id]=f.options?.[0]?.value||'SYNTHETIC QA';
 const record={id:'synthetic-review',revision:1,status:'submitted',profile,phoneVerified:true,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef:()=>({current:null}),useEffect(fn,deps){const i=cursor++;if(!state[i]){state[i]=deps||[];effects.push(fn)}}};
 const jsx=(type,props)=>({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},
  'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>null},
  '@/lib/i18n':{useI18n:()=>({locale:'km'}),legacyText:s=>s},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{},'@/lib/api-client':{async apiFetch(url,init={}){requests.push({url,...init});if(init.method==='POST')throw Error('Profile not found: missing id');return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 const context=vm.createContext({URLSearchParams,window:{location:{search:'?id=synthetic-review'},addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},console});
 const js=ts.transpileModule(readFileSync('app/kyc/client.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});
 function render(){cursor=0;tree=exports.default({review:true});return tree}
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 render();effects.splice(0).forEach(fn=>fn());
 return {requests,render,async ready(){await new Promise(r=>setImmediate(r));render()},nav:()=>nodes(tree).filter(n=>n.props?.className==='kyc-step-button'),next:()=>nodes(tree).find(n=>n.props?.className==='kyc-next-button'),active:()=>nodes(tree).find(n=>n.props?.['aria-current']==='step')};
}

test('reviewer can click all seven sections without any save request',async()=>{
 const h=reviewer();await h.ready();assert.equal(h.nav().length,7);
 for(let i=0;i<7;i++){const button=h.nav()[i];assert(!button.props.disabled,`section ${i+1} is locked`);button.props.onClick();h.render();assert.equal(h.active().props.children[0].props.children,i+1)}
 assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});

test('review Next visits all seven sections without validating or saving customer data',async()=>{
 const h=reviewer();await h.ready();
 for(let i=1;i<7;i++){await h.next().props.onClick();await h.ready();assert.equal(h.active().props.children[0].props.children,i+1,JSON.stringify(h.requests))}
 assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});
