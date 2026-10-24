import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
function view(overrides={}){
 const changes=[],profile=core.emptyProfile();profile.values.surname='原文 CUSTOMER';
 const props={record:{id:'synthetic',revision:3,status:'submitted',profile,phoneVerified:true},checks:{},reason:'synthetic reason',decision:'approved',busy:false,onCheck:(id,value)=>changes.push([id,value]),onDecision(){},onReason(){},onDecide(){changes.push('decide')},onAmend(){changes.push('amend')},...overrides};
 const jsx=(type,props)=>({type,props}),exports={};
 const code=ts.transpileModule(readFileSync('components/kyc-review.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+'\n})',{URLSearchParams,window:{location:{search:''}},Date})(exports,n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='@/lib/kyc/core'?core:n==='@/lib/api-client'?{apiUrl:p=>p}:n==='@/lib/i18n'?{useI18n:()=>({locale:'zh'})}:n==='@/lib/kyc/ui-copy'?{kycText:s=>s,kycDate:s=>s}:{});
 const tree=exports.KycReview(props),nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];return {nodes:nodes(tree),changes};
}
test('review shows seven open cards and anchors with per-section checklist; never edits customer fields',()=>{
 const h=view(),cards=h.nodes.filter(n=>n.type==='details'&&n.props.id?.startsWith('kyc-review-'));assert.equal(cards.length,7);assert(cards.every(n=>n.props.open));assert.equal(h.nodes.filter(n=>n.type==='a'&&n.props.href?.startsWith('#kyc-review-')).length,7);assert(!h.nodes.some(n=>n.type==='input'&&n.props.type==='text'));const check=h.nodes.find(n=>n.type==='input'&&n.props.type==='checkbox');check.props.onChange({target:{checked:true}});assert.deepEqual(h.changes,[[core.sections[0].id,true]]);
});
test('approval needs every check; read-only users cannot decide or amend',()=>{
 assert.equal(view().nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,true);
 const checked=Object.fromEntries(core.sections.map(s=>[s.id,true])),h=view({checks:checked});h.nodes.find(n=>n.props?.['data-action']==='decide').props.onClick();assert.deepEqual(h.changes,['decide']);
 const ro=view({record:{id:'synthetic',revision:1,status:'submitted',profile:core.emptyProfile(),canReview:false}});assert(!ro.nodes.some(n=>n.props?.['data-action']==='decide'||n.props?.['data-action']==='amend'));
});
