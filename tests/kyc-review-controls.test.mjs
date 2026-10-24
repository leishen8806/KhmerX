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
 const mocks={react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/kyc/core':core,'@/lib/kyc/ui-copy':{kycText:s=>s},...extra};
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
