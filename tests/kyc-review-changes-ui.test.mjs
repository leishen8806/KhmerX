import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import * as core from '../lib/kyc/core.ts';import * as requests from '../lib/kyc/requests.ts';
function load(file,mocks){const out={};vm.runInNewContext('(function(exports,require){'+ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText+'\n})',{})(out,n=>{assert(n in mocks,n);return mocks[n];});return out;}
const api=existsSync('lib/kyc/review-changes-ui.ts')?load('lib/kyc/review-changes-ui.ts',{'@/lib/kyc/core':core,'@/lib/kyc/requests':requests}):{};
const diff={caseId:'a',currentRevision:4,baselineRevision:2,fields:[{id:'surname',oldValue:'OLD',newValue:'NEW'},{id:'bankAccount',oldValue:'****45',newValue:'****65'}],materials:[{slot:'idFront',oldFileId:'old',newFileId:'new'}]};
test('real diff maps fields/materials to sections and supplement targets without inventing unavailable baselines',()=>{
 assert.equal(typeof api.changedSections,'function');assert.deepEqual(Array.from(api.changedSections(diff)),['identity','bank']);
 for(const [target,want]of [['field:surname','changed'],['slot:idFront','changed'],['section:identity','changed'],['field:givenName','pending'],['section:consent','unknown'],['field:unknown','unknown']])assert.equal(api.requestChangeState(target,diff),want);
 assert.equal(api.requestChangeState('field:surname',{...diff,baselineRevision:null}),'unknown');assert.equal(api.requestChangeState('field:surname',null),'unknown');
});
test('defensive sensitive display does not reveal raw numeric/short values or remask approved opaque suffixes',()=>{
 assert.equal(typeof api.safeChangeValue,'function');assert.equal(api.safeChangeValue('documentNumber','12'),'****');assert.equal(api.safeChangeValue('bankAccount','12345678'),'****78');assert.equal(api.safeChangeValue('bankAccount','****45'),'****45');assert.equal(api.safeChangeValue('surname','客户原文'),'客户原文');
});
function mount({audit=false,transport=async()=>({data:diff})}={}){
 assert(existsSync('components/kyc-review-changes.tsx'),'changes component exists');let cursor=0,tree,props={caseId:'a',revision:4,locale:'zh',audit,requests:[{target:'field:surname',reasonCode:'other',note:''},{target:'field:givenName',reasonCode:'other',note:''}]};const state=[],records=[],effects=[];
 const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useEffect(fn,deps){const i=cursor++,old=records[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();records[i]={deps};effects.push(()=>records[i].cleanup=fn());}}};
 const jsx=(type,props)=>({type,props}),componentModule=load('components/kyc-review-changes.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/api-client':{apiFetch:transport,apiUrl:p=>p},'@/lib/kyc/core':core,'@/lib/kyc/review-changes-ui':api,'@/lib/kyc/ui-copy':{kycText:s=>s},'./kyc-review-changes.css':{}});
 const render=(next=props)=>{props=next;cursor=0;tree=componentModule.ReviewChanges(props);effects.splice(0).forEach(fn=>fn());return tree;},nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[],text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'');render();
 return {render,props,nodes:()=>nodes(tree),text:()=>text(tree),async ready(){await new Promise(r=>setImmediate(r));render();}};
}
test('summary displays only returned changes, old/new controlled thumbnails, and baseline-derived supplement states',async()=>{
 const h=mount();await h.ready();assert(h.text().includes('OLD'));assert(h.text().includes('NEW'));assert(h.text().includes('****45'));assert(h.text().includes('已补充'));assert(h.text().includes('未处理'));const images=h.nodes().filter(n=>n.type==='img');assert.equal(images.length,2);assert(images.every(n=>n.props.src.startsWith('/api/kyc/files?review=1&id=')));
 const audit=mount({audit:true,transport:async()=>({data:{...diff,fields:[{id:'surname'}],materials:[{slot:'idFront'}]}})});await audit.ready();assert(!audit.text().includes('OLD'));assert(!audit.nodes().some(n=>n.type==='img'||n.type==='a'));
});
test('no baseline and failures stay explicit; late prior-case responses are discarded',async()=>{
 const empty=mount({transport:async()=>({data:{...diff,baselineRevision:null,fields:[],materials:[]}})});await empty.ready();assert(empty.text().includes('没有审核基线'));assert(!empty.text().includes('未处理'));
 const failed=mount({transport:async()=>{throw Error('raw secret');}});await failed.ready();assert(failed.text().includes('无法加载变更'));assert(!failed.text().includes('raw secret'));
 let resolve;const pending=new Promise(r=>resolve=r),late=mount({transport:()=>pending});late.render({...late.props,caseId:'b'});resolve({data:diff});await late.ready();assert(!late.text().includes('OLD'));
});
