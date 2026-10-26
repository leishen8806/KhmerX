import * as queueCopy from '../lib/kyc/queue-copy.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'');
function mount(file,name,props,extra={}){
 let cursor=0,tree;const state=[],effects=[],out={};
 const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useEffect(fn){effects.push(fn)}};
 const jsx=(type,props)=>({type,props});
 const mocks={'@/components/ui/button':{Button:'button'},'@/lib/kyc/queue-copy':queueCopy,'@/lib/admin-i18n':{useAdminLocale:()=>({locale:'zh'})},react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/kyc/core':core,'@/lib/kyc/ui-copy':{kycText:s=>s},...extra};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+(name==='OrderFollowups'?'\nexports.OrderFollowups=OrderFollowups;':'')+'\n})',{})(out,n=>mocks[n]||{});
 const render=(next=props)=>{props=next;cursor=0;tree=out[name](props);return tree};render();
 return {render,nodes:()=>nodes(tree),text:()=>text(tree),async ready(){effects.splice(0).forEach(fn=>fn());await new Promise(r=>setImmediate(r));render()}};
}
test('sensitive values require explicit reveal and can be hidden again',()=>{
 const h=mount('components/kyc-review-controls.tsx','SensitiveValue',{value:'0123456789',label:'银行账号',locale:'zh'});
 assert(!h.text().includes('0123456789'));assert(h.text().includes('6789'));
 h.nodes().find(n=>n.type==='button').props.onClick();h.render();assert(h.text().includes('0123456789'));
 h.nodes().find(n=>n.type==='button').props.onClick();h.render();assert(!h.text().includes('0123456789'));
});
test('show and hide controls are localized in English and Khmer',()=>{
 for(const [locale,show,hide] of [['en','Show','Hide'],['km','បង្ហាញ','លាក់']]){
  const h=mount('components/kyc-review-controls.tsx','SensitiveValue',{value:'0123456789',label:'Account',locale});
  assert(h.text().includes(show));h.nodes().find(n=>n.type==='button').props.onClick();h.render();assert(h.text().includes(hide));
 }
});
test('revealed values hide when the reviewed case or revision changes',()=>{
 const props={value:'0123456789',label:'Account',locale:'en',scope:'case-a:1'};
 const h=mount('components/kyc-review-controls.tsx','SensitiveValue',props);
 h.nodes().find(n=>n.type==='button').props.onClick();h.render();assert(h.text().includes(props.value));
 h.render({...props,scope:'case-b:1'});assert(!h.text().includes(props.value));
 h.nodes().find(n=>n.type==='button').props.onClick();h.render({...props,scope:'case-b:1'});assert(h.text().includes(props.value));
 h.render({...props,scope:'case-b:2'});assert(!h.text().includes(props.value));
});
test('amendment shows differences and requires fresh confirmation after each change',()=>{
 let saves=0;const original={surname:'OLD',bankAccount:'12345678'},values={...original,surname:'NEW'};
 const props={original,values,reason:'Customer authorized correction',busy:false,onSave:()=>saves++};
 const h=mount('components/kyc-review-controls.tsx','AmendConfirmation',props);
 assert(h.text().includes('OLD'));assert(h.text().includes('NEW'));assert(!h.text().includes('12345678'));
 const save=()=>h.nodes().find(n=>n.props?.['data-action']==='save-amend');assert(save().props.disabled);
 h.nodes().find(n=>n.type==='input').props.onChange({target:{checked:true}});h.render();assert(!save().props.disabled);save().props.onClick();assert.equal(saves,1);
 h.render({...props,values:{...values,surname:'NEWER'}});assert(save().props.disabled);
 h.render({...props,values:original});assert(save().props.disabled);
});
test('followup links to neutral review detail without preselecting approval',async()=>{
 const h=mount('components/kyc-orders.tsx','OrderFollowups',{id:'case 1'},{'@/lib/api-client':{apiFetch:async()=>({data:{order:{id:'case 1',status:'submitted'},records:[{id:'note',status:'resolved',created_at:'2026-10-24',actor:'staff',note:'Done'}],loans:[],canReview:true,canNote:false}})}});
 await h.ready();const link=h.nodes().find(n=>n.type==='a');assert.equal(link.props.href,'/kyc/review?id=case%201');assert(!text(link).includes('确认审核通过'));
});
test('follow-up controls and statuses localize while customer note text remains unchanged',async()=>{
 for(const locale of ['en','km']){
  const h=mount('components/kyc-orders.tsx','OrderFollowups',{id:'case 1'},{'@/lib/admin-i18n':{useAdminLocale:()=>({locale})},'@/lib/api-client':{apiFetch:async()=>({data:{order:{id:'case 1',customer_id:'customer',status:'submitted'},records:[{id:'note',status:'pending',created_at:'2026-10-24',actor:'staff',note:'客户原文不翻译'}],loans:[],canReview:true,canNote:true}})}});await h.ready();
  assert(h.text().includes('客户原文不翻译'));assert(!/[\u3400-\u9fff]/.test(h.text().replace('客户原文不翻译','')));assert(h.nodes().filter(n=>n.type==='option').every(n=>!/[\u3400-\u9fff]/.test(n.props.children)));
 }
});
test('follow-up distinguishes load and save failures without exposing raw server errors in every locale',async()=>{
 for(const [locale,loadError,saveError] of [['zh','无法加载，请重试','保存失败，请重试'],['en','Unable to load. Please retry.','Unable to save. Please retry.'],['km','មិនអាចផ្ទុកបានទេ។ សូមព្យាយាមម្តងទៀត។','មិនអាចរក្សាទុកបានទេ។ សូមព្យាយាមម្តងទៀត។']]){
  let failGet=true;
  const h=mount('components/kyc-orders.tsx','OrderFollowups',{id:'CASE-001'},{'@/lib/client-id':{clientRequestId:()=> 'synthetic'},'@/lib/admin-i18n':{useAdminLocale:()=>({locale})},'@/lib/api-client':{apiFetch:async(_url,options)=>{if(failGet||options?.method==='POST')throw Error('RAW SECRET');return {data:{order:{id:'CASE-001',customer_id:'USER-001',status:'submitted'},account:null,records:[],loans:[],canReview:true,canNote:true}}}}});
  await h.ready();assert(h.text().includes(loadError));assert(!h.text().includes('RAW SECRET'));
  failGet=false;await h.nodes().find(n=>n.type==='button').props.onClick();await new Promise(r=>setImmediate(r));h.render();
  h.nodes().find(n=>n.type==='textarea').props.onChange({target:{value:'Synthetic note'}});h.render();
  await h.nodes().find(n=>n.type==='button'&&!n.props.disabled).props.onClick();await new Promise(r=>setImmediate(r));h.render();assert(h.text().includes(saveError),locale);assert(!h.text().includes(loadError));assert(!h.text().includes('RAW SECRET'));
 }
});
