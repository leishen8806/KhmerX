import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function reviewer(lang='km'){
 let cursor=0,tree;const state=[],effects=[],requests=[];
 const profile=core.emptyProfile();profile.consent=true;
 for(const f of core.fields)profile.values[f.id]=f.options?.[0]?.value||'SYNTHETIC QA';
 const record={id:'synthetic-review',revision:1,status:'submitted',profile,phoneVerified:true,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef:()=>({current:null}),useEffect(fn,deps){const i=cursor++;if(!state[i]){state[i]=deps||[];effects.push(fn)}}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},
  'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>null},
  '@/lib/i18n':{useI18n:()=>({locale:'km'}),legacyText:s=>s},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{},'@/lib/kyc/upload':{},'@/lib/api-client':{apiUrl:p=>p,async apiFetch(url,init={}){requests.push({url,...init});if(init.method==='POST')throw Error('Profile not found: missing id');return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 const context=vm.createContext({URLSearchParams,window:{localStorage:{getItem:()=>null},location:{search:'?id=synthetic-review&lang='+lang},addEventListener(){},removeEventListener(){}},document:{documentElement:{lang:'en'},addEventListener(){},removeEventListener(){}},console});
 // Exercise the real locale helper introduced by K1B while preserving the
 // reviewer navigation test's narrow platform/network doubles.
 const copyJs=ts.transpileModule(readFileSync('lib/kyc/ui-copy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const copy={};vm.runInContext('(function(exports,require){'+copyJs+'\n})',context)(copy,n=>n==='../i18n'?mocks['@/lib/i18n']:{messageForError(){throw Error('review navigation must not format a customer error')}});
 mocks['@/lib/kyc/ui-copy']=copy;
 const viewerExports={},viewerJs=ts.transpileModule(readFileSync('components/kyc-material-viewer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+viewerJs+'\n})',context)(viewerExports,n=>n==='./kyc-material-viewer.css'?{}:mocks[n]);mocks['@/components/kyc-material-viewer']=viewerExports;
 const reviewExports={};const reviewJs=ts.transpileModule(readFileSync('components/kyc-review.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+reviewJs+'\n})',context)(reviewExports,n=>n==='./kyc-review.css'?{}:mocks[n]);mocks['@/components/kyc-review']=reviewExports;
 const js=ts.transpileModule(readFileSync('app/kyc/client.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});
 function render(){cursor=0;tree=exports.default({review:true});return tree}
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 render();effects.splice(0).forEach(fn=>fn());
 return {requests,render,async ready(){await new Promise(r=>setImmediate(r));render()},locale:()=>tree.props.lang,nav:()=>nodes(tree).filter(n=>n.type==='a'&&n.props?.href?.startsWith('#kyc-review-')),next:()=>nodes(tree).find(n=>n.props?.className==='kyc-next-button'),active:()=>nodes(tree).find(n=>n.props?.['aria-current']==='step')};
}

test('reviewer can access all seven anchors without any save request',async()=>{
 const h=reviewer();await h.ready();assert.equal(h.nav().length,7);
 for(let i=0;i<7;i++)assert.equal(h.nav()[i].props.href,'#kyc-review-'+core.sections[i].id);
 assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});
test('single page review needs no Next action or customer-data save',async()=>{
 const h=reviewer();await h.ready();assert.equal(h.next(),undefined);assert.equal(h.nav().length,7);assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});
test('review query language overrides the default page context',async()=>{for(const lang of ['zh','km']){const h=reviewer(lang);await h.ready();assert.equal(h.locale(),lang)}});
