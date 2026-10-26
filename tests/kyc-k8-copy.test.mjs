import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import React from 'react';import * as jsx from 'react/jsx-runtime';import {renderToStaticMarkup} from 'react-dom/server';import * as core from '../lib/kyc/core.ts';import * as requests from '../lib/kyc/requests.ts';
const cache={react:React,'react/jsx-runtime':jsx,'@/lib/kyc/core':core,'@/lib/kyc/requests':requests,'@/lib/api-client':{apiUrl:p=>p}};
function load(file){const out={};vm.runInNewContext('(function(exports,require){'+ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText+'})')(out,n=>{if(n.endsWith('.css'))return {};if(n==='../i18n')n='@/lib/i18n';if(n==='../error-messages')n='@/lib/error-messages';if(!(n in cache)){const file=n==='@/lib/i18n'?'lib/i18n.tsx':n.slice(2)+(n.startsWith('@/components/')?'.tsx':'.ts');cache[n]=load(file)}return cache[n]});return out;}
const {KycReview}=load('components/kyc-review.tsx'),{RequestEditor}=load('components/kyc-supplement.tsx');
test('review consent, audit redaction and structured reasons have no static Chinese in en/km; customer originals stay exact',()=>{
 for(const locale of ['en','km'])for(const audit of [false,true]){
  const profile=core.emptyProfile();profile.values.surname='客户原文';const record={id:'SYNTHETIC',revision:4,status:'submitted',profile,phoneVerified:true,...(audit?{canReview:false,scope:'审计只读摘要'}:{})};
  const html=renderToStaticMarkup(React.createElement(KycReview,{record,locale,checks:{},reason:'客户意见原文',decision:'needs_info',busy:false,requests:[{target:'section:consent',reasonCode:'',note:''}],onRequest(){},onCheck(){},onReason(){},onDecision(){},onDecide(){},onAmend(){}}));
  assert(!/[\u3400-\u9fff]/.test(html.replaceAll('客户原文','').replaceAll('客户意见原文','')),locale+': '+html.match(/[\u3400-\u9fff]+/g));
  if(!audit)assert(html.includes('客户原文'));else assert(!html.includes('客户原文'));
  const editor=renderToStaticMarkup(React.createElement(RequestEditor,{target:'field:surname',request:{target:'field:surname',reasonCode:'other',note:'原文说明'},locale,disabled:false,onChange(){}}));assert(editor.includes('原文说明'));assert(!/[\u3400-\u9fff]/.test(editor.replaceAll('原文说明','')));
 }
});
