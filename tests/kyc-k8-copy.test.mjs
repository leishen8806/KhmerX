import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import React from 'react';import * as jsx from 'react/jsx-runtime';import {renderToStaticMarkup} from 'react-dom/server';import * as core from '../lib/kyc/core.ts';import * as requests from '../lib/kyc/requests.ts';
const cache={react:React,'react/jsx-runtime':jsx,'@/lib/kyc/core':core,'@/lib/kyc/requests':requests,'@/lib/api-client':{apiUrl:p=>p}};
function load(file){const out={};vm.runInNewContext('(function(exports,require){'+ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText+'})')(out,n=>{if(n.endsWith('.css'))return {};if(n==='../i18n')n='@/lib/i18n';if(n==='../error-messages')n='@/lib/error-messages';if(!(n in cache)){const file=n==='@/lib/i18n'?'lib/i18n.tsx':n.slice(2)+(n.startsWith('@/components/')?'.tsx':'.ts');cache[n]=load(file)}return cache[n]});return out;}
const {KycReview}=load('components/kyc-review.tsx'),{RequestEditor}=load('components/kyc-supplement.tsx');
const {KycMaterialViewer}=load('components/kyc-material-viewer.tsx');
test('review history localizes known actions, keeps unknown actions and customer originals',()=>{
 const actions=['save','submit','review:approved','review:needs_info','review:rejected','review:amend','review.approved','review.needs_info','review.rejected','amend','future.action'];
 const expected={zh:['保存草稿','提交人工审核','审核通过','退回补件','审核拒绝','代客户修改'],en:['Draft saved','Submitted for review','Review approved','More information requested','Review rejected','Amended for customer'],km:['បានរក្សាទុកសេចក្តីព្រាង','បានដាក់ស្នើឱ្យពិនិត្យ','ការពិនិត្យបានអនុម័ត','បានស្នើព័ត៌មានបន្ថែម','ការពិនិត្យត្រូវបានបដិសេធ','បានកែប្រែជំនួសអតិថិជន']};
 for(const locale of ['zh','en','km']){
  const record={id:'SYNTHETIC',revision:12,status:'submitted',profile:core.emptyProfile(),phoneVerified:true,history:actions.map((action,i)=>({revision:i+1,action,created_at:'2026-10-26T00:00:00Z',review:{reason:'客户原文'},actor:'原始Actor'}))};
  const html=renderToStaticMarkup(React.createElement(KycReview,{record,locale,checks:{},reason:'',decision:'approved',busy:false,onCheck(){},onReason(){},onDecision(){},onDecide(){},onAmend(){}}));
  for(const value of expected[locale])assert(html.includes(value),locale+': '+value);
  for(const action of actions.slice(0,-1))assert(!html.includes(' · '+action+' · '),locale+': raw '+action);
  assert(html.includes('future.action'));assert(html.includes('客户原文'));assert(html.includes('原始Actor'));
  if(locale==='km'){assert(html.includes('ត្រឡប់ទៅផ្ទាំងការងារ'));assert(!html.includes('ត្រឡប់ទៅ workspace'));}
 }
});
test('populated vehicle and housing material controls use localized static labels in en/km',()=>{
 for(const locale of ['en','km'])for(const slot of ['vehicleInvoice','vehicleContract','vehiclePhoto','rentContract','propertyCertificate']){
  const profile=core.emptyProfile();profile.values.vehicle='汽车';profile.values.housing=slot==='rentContract'?'租房':'个人房产';profile.files[slot]={id:'SYNTHETIC-'+slot,slot,type:'image/png',size:1};
  const html=renderToStaticMarkup(React.createElement(KycMaterialViewer,{profile,locale}));assert(html.includes('SYNTHETIC-'+slot));assert(!/[\u3400-\u9fff]/.test(html),locale+': '+slot);
 }
});
test('review consent, audit redaction and structured reasons have no static Chinese in en/km; customer originals stay exact',()=>{
 for(const locale of ['en','km'])for(const audit of [false,true]){
  const profile=core.emptyProfile();profile.values.surname='客户原文';const record={id:'SYNTHETIC',revision:4,status:'submitted',profile,phoneVerified:true,...(audit?{canReview:false,scope:'审计只读摘要'}:{})};
  const html=renderToStaticMarkup(React.createElement(KycReview,{record,locale,checks:{},reason:'客户意见原文',decision:'needs_info',busy:false,requests:[{target:'section:consent',reasonCode:'',note:''}],onRequest(){},onCheck(){},onReason(){},onDecision(){},onDecide(){},onAmend(){}}));
  assert(!/[\u3400-\u9fff]/.test(html.replaceAll('客户原文','').replaceAll('客户意见原文','')),locale+': '+html.match(/[\u3400-\u9fff]+/g));
  if(!audit)assert(html.includes('客户原文'));else assert(!html.includes('客户原文'));
  const editor=renderToStaticMarkup(React.createElement(RequestEditor,{target:'field:surname',request:{target:'field:surname',reasonCode:'other',note:'原文说明'},locale,disabled:false,onChange(){}}));assert(editor.includes('原文说明'));assert(!/[\u3400-\u9fff]/.test(editor.replaceAll('原文说明','')));
 }
});
