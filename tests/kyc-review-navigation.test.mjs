import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
import {DraftSaver} from '../lib/kyc/draft-save.ts';

function reviewer(lang='km',postSucceeds=false,query=''){
 let cursor=0,tree;const state=[],effects=[],requests=[];
 const profile=core.emptyProfile();profile.consent=true;
 for(const f of core.fields)profile.values[f.id]=f.options?.[0]?.value||'SYNTHETIC QA';
 const record={id:'synthetic-review',revision:1,status:'submitted',profile,phoneVerified:true,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]},useEffect(fn,deps){const i=cursor++;if(!state[i]){state[i]=deps||[];effects.push(fn)}}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},
  'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/draft-save':{DraftSaver},'@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>null},
  '@/lib/i18n':{useI18n:()=>({locale:'km'}),legacyText:s=>s},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{},'@/lib/kyc/upload':{},'@/lib/api-client':{apiUrl:p=>p,async apiFetch(url,init={}){requests.push({url,...init});if(init.method==='POST'&&!postSucceeds)throw Error('Profile not found: missing id');return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 const context=vm.createContext({URLSearchParams,window:{setTimeout,localStorage:{getItem:()=>null},location:{search:'?id=synthetic-review&lang='+lang+query},addEventListener(){},removeEventListener(){}},document:{getElementById:()=>null,documentElement:{lang:'en'},addEventListener(){},removeEventListener(){}},console});
 // Exercise the real locale helper introduced by K1B while preserving the
 // reviewer navigation test's narrow platform/network doubles.
 const copyJs=ts.transpileModule(readFileSync('lib/kyc/ui-copy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const copy={};vm.runInContext('(function(exports,require){'+copyJs+'\n})',context)(copy,n=>n==='../i18n'?mocks['@/lib/i18n']:{messageForError(){throw Error('review navigation must not format a customer error')}});
 mocks['@/lib/kyc/ui-copy']=copy;
 const checks={},checksJs=ts.transpileModule(readFileSync('components/kyc-customer-checks.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+checksJs+'\n})',context)(checks,n=>n==='./kyc-customer-checks.css'?{}:mocks[n]);mocks['@/components/kyc-customer-checks']=checks;
 const overview={},overviewJs=ts.transpileModule(readFileSync('components/kyc-customer-overview.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+overviewJs+'\n})',context)(overview,n=>n==='./kyc-customer-overview.css'?{}:mocks[n]);mocks['@/components/kyc-customer-overview']=overview;
 const viewerExports={},viewerJs=ts.transpileModule(readFileSync('components/kyc-material-viewer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+viewerJs+'\n})',context)(viewerExports,n=>n==='./kyc-material-viewer.css'?{}:mocks[n]);mocks['@/components/kyc-material-viewer']=viewerExports;
 const supplementLoad=file=>{const out={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(out,n=>mocks[n]);return out};mocks['./core.ts']=core;mocks['@/lib/kyc/requests']=supplementLoad('lib/kyc/requests.ts');mocks['./requests.ts']=mocks['@/lib/kyc/requests'];mocks['@/lib/kyc/supplement-ui']=supplementLoad('lib/kyc/supplement-ui.ts');mocks['./kyc-supplement.css']={};mocks['@/components/kyc-supplement']=supplementLoad('components/kyc-supplement.tsx');
 mocks['@/components/kyc-review-controls']=supplementLoad('components/kyc-review-controls.tsx');
 mocks['./kyc-review-actions.css']={};mocks['@/components/kyc-review-actions']=supplementLoad('components/kyc-review-actions.tsx');mocks['@/lib/kyc/review-next']=supplementLoad('lib/kyc/review-next.ts');
 const reviewExports={};const reviewJs=ts.transpileModule(readFileSync('components/kyc-review.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+reviewJs+'\n})',context)(reviewExports,n=>n==='./kyc-review.css'?{}:mocks[n]);mocks['@/components/kyc-review']=reviewExports;
 const js=ts.transpileModule(readFileSync('app/kyc/client.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});
 function render(){cursor=0;tree=exports.default({review:true});return tree}
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 render();effects.splice(0).forEach(fn=>fn());
 return {decision:()=>nodes(tree).find(n=>n.type==='select')?.props.value,requests,render,nodes:()=>nodes(tree),async ready(){await new Promise(r=>setImmediate(r));render()},async settle(){await new Promise(r=>setImmediate(r));render()},locale:()=>tree.props.lang,nav:()=>nodes(tree).filter(n=>n.type==='a'&&n.props?.href?.startsWith('#kyc-review-')),next:()=>nodes(tree).find(n=>n.props?.className==='kyc-next-button'),active:()=>nodes(tree).find(n=>n.props?.['aria-current']==='step')};
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
test('legacy approved URL never preselects an approval decision',async()=>{const h=reviewer('zh',false,'&decision=approved');await h.ready();assert.equal(h.decision(),'needs_info')});
test('supplement requests are posted only with a needs-info decision',async()=>{
 const descendants=n=>Array.isArray(n)?n.flatMap(descendants):n&&typeof n==='object'?[n,...descendants(n.props?.children)]:[];
 const prepare=async decision=>{const h=reviewer('zh',true);await h.ready();let editor=h.nodes().find(n=>n.props?.['data-target']==='field:surname');descendants(editor).find(n=>n.type==='input').props.onChange({target:{checked:true}});h.render();editor=h.nodes().find(n=>n.props?.['data-target']==='field:surname');descendants(editor).find(n=>n.type==='select').props.onChange({target:{value:'blurred'}});h.render();
  const result=h.nodes().find(n=>n.type==='select'&&descendants(n).some(x=>x.type==='option'&&x.props.value==='approved'));result.props.onChange({target:{value:decision}});h.nodes().find(n=>n.type==='textarea'&&n.props.maxLength===1000).props.onChange({target:{value:'Synthetic review reason'}});h.render();
  if(decision==='approved')for(const label of h.nodes().filter(n=>n.props?.className==='kyc-review-check'))descendants(label).find(n=>n.type==='input').props.onChange({target:{checked:true}});
  h.render();h.nodes().find(n=>n.props?.['data-action']==='decide').props.onClick({currentTarget:{focus(){}}});if(decision==='approved'){assert.equal(h.requests.filter(r=>r.method==='POST').length,0);h.render();h.nodes().find(n=>n.props?.['data-confirm-review']).props.onClick()}await h.settle();return JSON.parse(h.requests.findLast(r=>r.method==='POST').body)};
 const selected={target:'field:surname',reasonCode:'blurred',note:''};
 assert.deepEqual((await prepare('needs_info')).requests,[selected]);
 for(const decision of ['approved','rejected'])assert.equal(Object.hasOwn(await prepare(decision),'requests'),false);
 const empty=reviewer('zh',true);await empty.ready();empty.nodes().find(n=>n.type==='textarea'&&n.props.maxLength===1000).props.onChange({target:{value:'Synthetic review reason'}});empty.render();empty.nodes().find(n=>n.props?.['data-action']==='decide').props.onClick();await empty.settle();assert.equal(Object.hasOwn(JSON.parse(empty.requests.findLast(r=>r.method==='POST').body),'requests'),false);
});
