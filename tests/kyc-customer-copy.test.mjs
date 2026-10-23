import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function customer({locale='km',review=false,section='personal',status='draft',mini=false}={}){
 let cursor=0,tree;const state=[],effects=[];
 const profile=core.emptyProfile();profile.values.surname='客户原文';
 const record={id:'synthetic-customer',revision:1,status,profile,phoneVerified:false,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={createContext:v=>({value:v}),useContext:c=>c.value,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef:()=>({current:null}),useEffect(fn,deps){const i=cursor++;if(!state[i]){state[i]=deps||[];effects.push(fn)}}};
 const jsx=(type,props)=>({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>null},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{},'@/lib/api-client':{async apiFetch(){return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 const context=vm.createContext({URLSearchParams,Date,Intl,window:{localStorage:{getItem:()=>locale},location:{search:review?'?id=synthetic-customer':''},addEventListener(){},removeEventListener(){},setInterval(){},clearInterval(){}},document:{documentElement:{lang:locale},addEventListener(){},removeEventListener(){}}});
 const load=file=>{const exports={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});return exports};
 mocks['@/lib/i18n']=load('lib/i18n.tsx');mocks['@/lib/i18n'].I18nContext.value=mocks['@/lib/i18n'].i18nValue(locale);
 mocks['@/lib/error-messages']=load('lib/error-messages.ts');mocks['../i18n']=mocks['@/lib/i18n'];mocks['../error-messages']=mocks['@/lib/error-messages'];mocks['@/lib/kyc/ui-copy']=load('lib/kyc/ui-copy.ts');
 const component=load('app/kyc/client.tsx').default;
 const render=()=>{cursor=0;tree=component({review,mini,initialSection:section});return tree};
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 const text=n=>Array.isArray(n)?n.map(text).join(' '):typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?text(n.props?.children):'';
 render();effects.splice(0).forEach(fn=>fn());
 return {async ready(){await new Promise(r=>setImmediate(r));render()},render,text:()=>text(tree),nodes:()=>nodes(tree),copy:mocks['@/lib/kyc/ui-copy']};
}

const steps=['personal','identityDetails','address','idFront','idBack','selfie','contact1','contact2','contact3','employment','income','assets','bank','consent'];
test('customer H5 and mini expose no internal test or scoring metadata, reviewer retains it',async()=>{
 for(const mini of [false,true])for(const section of steps){const h=customer({locale:'zh',section,mini});await h.ready();assert.doesNotMatch(h.text(),/KESS|模拟|测试合同|权重|单元格|KYC规范/)}
 const h=customer({review:true,section:'bank'});await h.ready();assert.match(h.text(),/KESS/);assert.match(h.text(),/权重/);
});
test('all customer sections render localized UI and attributes while input values stay original',async()=>{
 for(const mini of [false,true])for(const locale of ['en','km'])for(const section of steps){const h=customer({locale,section,mini});await h.ready();assert.doesNotMatch(h.text(),/[\u4e00-\u9fff]/,locale+':'+section);for(const n of h.nodes())for(const key of ['aria-label','title','placeholder'])if(typeof n.props?.[key]==='string')assert.doesNotMatch(n.props[key],/[\u4e00-\u9fff]/,key+':'+section);if(section==='personal')assert(h.nodes().some(n=>n.props?.value==='客户原文'))}
});
test('upload retry, size limits, geographic labels and safe errors use the selected locale',()=>{
 for(const locale of ['zh','en','km']){const {copy}=customer({locale,mini:true});for(const text of ['正在重试（第 2 次）','单份材料不能超过 10 MB','设备报告 11.00000, 104.00000（精度约 20 米）']){const value=copy.kycText(text,locale);if(locale!=='zh')assert.doesNotMatch(value,/[\u4e00-\u9fff]/);assert.match(value,/2|10|11\.00000/)}assert(!copy.kycError(Error('private stack or SQL'),locale).includes('private stack'));assert(copy.kycError({code:'AUTH_REQUIRED'},locale));}
 const {copy}=customer({mini:true});assert.equal(copy.kycText('Agriculture/Forestry/Fishery / កសិកម្ម/រុក្ខាប្រម៉ាញ់/នេសាទ','km'),'កសិកម្ម/រុក្ខាប្រម៉ាញ់/នេសាទ');assert.equal(copy.kycText('金边/Phnom Penh','en'),'Phnom Penh');
});
test('customer validation errors and timestamps follow locale',async()=>{
 for(const locale of ['en','km','zh']){const h=customer({locale});await h.ready();await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();h.render();const alert=h.nodes().find(n=>n.props?.role==='alert');assert(alert);if(locale!=='zh')assert.doesNotMatch(JSON.stringify(alert.props.children),/[\u4e00-\u9fff]/);assert(h.text().includes(new Date('2026-10-23T00:00:00Z').toLocaleString({zh:'zh-CN',en:'en-GB',km:'km-KH'}[locale],{timeZone:'Asia/Phnom_Penh'})))}
});
