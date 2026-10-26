import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
function harness(overrides={}){
 assert(existsSync('components/kyc-review-actions.tsx'),'review actions component exists');
 let cursor=0,tree,focus=0,calls=0;const state=[],effects=[],dialog={open:false,showModal(){this.open=true},close(){this.open=false}},props={record:{id:'CASE',revision:3},checks:Object.fromEntries(core.sections.map(s=>[s.id,true])),reason:'Original',decision:'approved',disabled:false,locale:'zh',onReason:value=>props.reason=value,onDecide:()=>calls++,...overrides};
 const hooks={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=v]},useRef(){const i=cursor++;return state[i]||=( {current:dialog})},useEffect(fn,deps){const i=cursor++;if(!state[i]||deps.some((v,j)=>v!==state[i][j])){state[i]=deps;effects.push(fn)}}};
 const jsx=(type,props)=>({type,props}),exports={};const code=ts.transpileModule(readFileSync('components/kyc-review-actions.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+'\n})',{})(exports,n=>n==='react'?hooks:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='@/lib/kyc/core'?core:n==='@/lib/kyc/ui-copy'?{kycText:s=>s}:{});
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
 const render=()=>{cursor=0;tree=exports.ReviewActions(props);effects.splice(0).forEach(fn=>fn());return nodes(tree)};
 return {props,dialog,render,get calls(){return calls},get focus(){return focus},trigger(){render().find(n=>n.props?.['data-action']==='decide').props.onClick({currentTarget:{focus(){focus++}}})}};
}
test('approval opens a seven-check summary without deciding; confirmation alone decides',()=>{
 const h=harness();h.trigger();assert.equal(h.calls,0);const nodes=h.render();assert(h.dialog.open);assert.equal(nodes.filter(n=>n.props?.['data-summary-check']).length,7);assert(JSON.stringify(nodes).includes('CASE'));assert(JSON.stringify(nodes).includes('Original'));
 nodes.find(n=>n.props?.['data-confirm-review']).props.onClick();assert.equal(h.calls,1);
});
test('Escape or cancel closes approval and returns focus without deciding',()=>{
 const h=harness();h.trigger();h.render().find(n=>n.type==='dialog').props.onCancel({preventDefault(){}});assert.equal(h.calls,0);assert.equal(h.focus,1);assert.equal(h.dialog.open,false);
});
test('phrases append only after click; overflow keeps original reason; other decisions do not confirm',()=>{
 const h=harness({decision:'needs_info'});let nodes=h.render();assert.equal(h.props.reason,'Original');nodes.find(n=>n.props?.['data-phrase']).props.onClick();assert(h.props.reason.startsWith('Original\n'));h.trigger();assert.equal(h.calls,1);
 h.props.reason='x'.repeat(1000);nodes=h.render();nodes.find(n=>n.props?.['data-phrase']).props.onClick();assert.equal(h.props.reason.length,1000);assert(h.render().some(n=>n.props?.['data-phrase-error']));
});
test('empty note can be filled by a phrase even while the decision is disabled',()=>{
 const h=harness({reason:'',disabled:true});const phrase=h.render().find(n=>n.props?.['data-phrase']);assert.equal(phrase.props.disabled,false);phrase.props.onClick();assert(h.props.reason.length>0);
});
