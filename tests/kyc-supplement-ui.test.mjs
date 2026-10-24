import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as requests from '../lib/kyc/requests.ts';
import {supplementStep,supplementChanged} from '../lib/kyc/supplement-ui.ts';
import {emptyProfile} from '../lib/kyc/core.ts';
test('structured targets map to exact customer steps; legacy uses checklist only',()=>{
 for(const [target,step] of [['field:marital','identityDetails'],['field:district','address'],['field:contact2Phone','contact2'],['slot:idBack','idBack'],['slot:incomeProof','income'],['section:bank','bank']])assert.equal(supplementStep([{target}]),step);
 assert.equal(supplementStep(undefined,{contacts:true}),'contact1');assert.equal(supplementStep(),'personal');
});
test('section/file change hints do not claim correctness and reverse when reverted',()=>{
 const old=emptyProfile(),p=emptyProfile();p.values.contact1Name='CHANGED';assert(supplementChanged('section:contacts',p,old));delete p.values.contact1Name;assert(!supplementChanged('section:contacts',p,old));p.files.idFront={id:'new'};assert(supplementChanged('slot:idFront',p,old));assert(!supplementChanged('slot:selfie',p,old));
});
test('request editor emits exact code/note/target and removes only its target',()=>{
 const out={},jsx=(type,props)=>({type,props}),code=ts.transpileModule(readFileSync('components/kyc-supplement.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+'\n})',{})(out,n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='@/lib/kyc/requests'?requests:n==='@/lib/kyc/ui-copy'?{kycText:s=>s}:{});
 const changes=[],base={target:'slot:idFront',locale:'zh',disabled:false,onChange:r=>changes.push(r)},nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
 let tree=nodes(out.RequestEditor(base));tree.find(n=>n.type==='input').props.onChange({target:{checked:true}});assert.deepEqual(JSON.parse(JSON.stringify(changes[0])),{target:'slot:idFront',reasonCode:'other',note:''});
 tree=nodes(out.RequestEditor({...base,request:changes[0]}));tree.find(n=>n.type==='select').props.onChange({target:{value:'blurred'}});assert.equal(changes[1].reasonCode,'blurred');tree.find(n=>n.type==='textarea').props.onChange({target:{value:'原文 NOTE'}});assert.equal(changes[2].note,'原文 NOTE');tree.find(n=>n.type==='input').props.onChange({target:{checked:false}});assert.equal(changes[3],undefined);
});
