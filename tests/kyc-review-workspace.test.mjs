import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
import * as requests from '../lib/kyc/requests.ts';
function view(overrides={}){
 const changes=[],profile=core.emptyProfile();profile.values.surname='原文 CUSTOMER';
 const props={record:{id:'synthetic',revision:3,status:'submitted',profile,phoneVerified:true},checks:{},reason:'synthetic reason',decision:'approved',busy:false,onCheck:(id,value)=>changes.push([id,value]),onDecision(){},onReason(){},onDecide(){changes.push('decide')},onAmend(){changes.push('amend')},...overrides};
 const jsx=(type,props)=>({type,props}),exports={};
 const code=ts.transpileModule(readFileSync('components/kyc-review.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+'\n})',{URLSearchParams,window:{location:{search:''}},Date})(exports,n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='@/lib/kyc/core'?core:n==='@/lib/kyc/requests'?requests:n==='@/lib/api-client'?{apiUrl:p=>p}:n==='@/lib/i18n'?{useI18n:()=>({locale:'zh'})}:n==='@/lib/kyc/ui-copy'?{kycText:s=>s,kycDate:s=>s}:{});
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
test('audit summary explains redaction instead of claiming customer fields or files are missing',()=>{
 const h=view({record:{id:'audit',revision:1,status:'submitted',profile:core.emptyProfile(),canReview:false,scope:'审计只读摘要；敏感资料由 KYC 审核岗位查看'}});
 const text=n=>Array.isArray(n)?n.map(text).join(''):typeof n==='string'?n:n&&typeof n==='object'?text(n.props?.children):'';
 const visible=h.nodes.filter(n=>['dd','p','span'].includes(n.type)).map(text).join(' ');
 assert.match(visible,/审计只读/);assert.match(visible,/无权查看/);assert.doesNotMatch(visible,/未提供|尚未上传|暂无材料/);
 assert(!h.nodes.some(n=>n.type==='img'||n.props?.['data-action']==='decide'||n.props?.['data-action']==='amend'));
});
test('needs-info decision requires a chosen reason and an explanation for other',()=>{
 for(const request of [{target:'slot:idFront',reasonCode:'',note:''},{target:'slot:idFront',reasonCode:'other',note:'  '}]){
  const h=view({decision:'needs_info',requests:[request]});assert.equal(h.nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,true);assert(h.nodes.some(n=>n.props?.['data-request-error']));
 }
 for(const request of [{target:'slot:idFront',reasonCode:'blurred',note:''},{target:'slot:idFront',reasonCode:'other',note:'Details'}])assert.equal(view({decision:'needs_info',requests:[request]}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,false);
});
test('decision controls appear only for submitted records',()=>{
 const record=status=>({id:'synthetic',revision:1,status,profile:core.emptyProfile(),phoneVerified:true});
 const submitted=view({record:record('submitted')}).nodes;
 assert(submitted.some(n=>n.props?.['data-action']==='decide'));assert(submitted.some(n=>n.type==='select'));assert(submitted.some(n=>n.type==='textarea'));
 for(const status of ['approved','rejected','needs_info','draft']){
  const nodes=view({record:record(status)}).nodes;
  assert(!nodes.some(n=>n.props?.['data-action']==='decide'));assert(!nodes.some(n=>n.type==='select'));assert(!nodes.some(n=>n.type==='textarea'));
 }
});
test('reason is always required while checklist is required only for approval',()=>{
 const checks=Object.fromEntries(core.sections.map(s=>[s.id,true]));
 for(const reason of ['','   '])assert.equal(view({checks,reason}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,true);
 assert.equal(view({checks,reason:'x'}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,false);
 assert.equal(view({decision:'needs_info',checks:{},reason:'x'}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,false);
});
test('approval-only records expose only approval and never amendment',()=>{
 const record=(status,approvalOnly=false)=>({id:'synthetic',revision:1,status,profile:core.emptyProfile(),phoneVerified:true,approvalOnly});
 const approval=view({record:record('submitted',true)}).nodes;
 assert.deepEqual(approval.filter(n=>n.type==='option').map(n=>n.props.value),['approved']);assert(!approval.some(n=>n.props?.['data-action']==='amend'));
 const standard=view({record:record('submitted')}).nodes;
 assert.deepEqual(standard.filter(n=>n.type==='option').map(n=>n.props.value),['needs_info','approved','rejected']);assert(standard.some(n=>n.props?.['data-action']==='amend'));
 for(const status of ['submitted','needs_info'])assert(view({record:record(status)}).nodes.some(n=>n.props?.['data-action']==='amend'));
 for(const status of ['approved','rejected'])assert(!view({record:record(status)}).nodes.some(n=>n.props?.['data-action']==='amend'));
});
test('read-only and busy review controls are disabled',()=>{
 const readOnly=view({record:{id:'synthetic',revision:1,status:'submitted',profile:core.emptyProfile(),phoneVerified:true,canReview:false}}).nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox');
 assert(readOnly.length>0);assert(readOnly.every(n=>n.props.disabled===true));
 const busy=view({busy:true}).nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox'||n.type==='select'||n.type==='textarea'||n.props?.['data-action']==='decide');
 assert(busy.length>0);assert(busy.every(n=>n.props.disabled===true));
});
test('busy alone disables an otherwise enabled approval decision',()=>{
 const checks=Object.fromEntries(core.sections.map(s=>[s.id,true]));
 assert.equal(view({checks,reason:'x',decision:'approved',busy:false}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,false);
 assert.equal(view({checks,reason:'x',decision:'approved',busy:true}).nodes.find(n=>n.props?.['data-action']==='decide').props.disabled,true);
});
