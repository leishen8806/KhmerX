import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
test('actual submitted Mini screen shows truthful timeline instead of an unsupported 24-hour SLA',async()=>{
 let cursor=0;const state=[],effects=[];
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const hooks={useCallback:f=>f,useRef:()=>({current:false}),useEffect(fn){effects.push(fn)},useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=v]}};
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/kyc/core':core,'@/lib/kyc/ui-copy':{kycText:s=>s},'@/lib/api-client':{apiUrl:p=>p,apiFetch:async()=>({data:{state:{loans:[]},kyc:{status:'submitted'}}})},'./mini-shell':{MiniShell:'MiniShell',useMiniNavigation:()=>null},'./customer-journey':{kycPresentation:()=>({})},'@/lib/i18n':{},'./kyc-customer-overview.css':{}};
 const context=vm.createContext({Map,URLSearchParams,setInterval:()=>0,clearInterval(){},window:{location:{search:'?lang=zh'},localStorage:{getItem:()=>null},addEventListener(){},removeEventListener(){}},document:{hidden:false}});
 const load=file=>{const exports={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>mocks[n]||{});return exports};
 mocks['@/components/kyc-customer-overview']=load('components/kyc-customer-overview.tsx');const component=load('components/mini-client.tsx').MiniClient;
 const render=()=>{cursor=0;return component({screen:'kyc',phone:'synthetic',busy:false})};render();effects.splice(0).forEach(fn=>fn());await new Promise(r=>setImmediate(r));const tree=render(),text=JSON.stringify(tree);
 assert(text.includes('kyc-customer-timeline'));assert(text.includes('预计处理时间暂未提供'));assert(!text.includes('24 小时'));
});
