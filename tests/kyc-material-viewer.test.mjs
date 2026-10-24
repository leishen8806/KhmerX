import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function viewer(files={},locale='zh'){
 let cursor=0,tree;const state=[];const profile={...core.emptyProfile(),files};
 const jsx=(type,props)=>({type,props});
 const mocks={react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]}},'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/kyc/core':core,'@/lib/api-client':{apiUrl:p=>'/authenticated'+p},'@/lib/i18n':{useI18n:()=>({locale}),legacyText:s=>s},'./kyc-material-viewer.css':{}};
 const js=ts.transpileModule(readFileSync('components/kyc-material-viewer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext('(function(exports,require){'+js+'\n})',{})(exports,n=>{assert(n in mocks,n);return mocks[n]});
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 function render(){cursor=0;tree=exports.KycMaterialViewer({profile});return nodes(tree)}
 render();return {render,profile,click(label){const button=nodes(tree).find(n=>n.type==='button'&&n.props.children===label);assert(button,label);button.props.onClick();return render()}};
}
const file=(id,type='image/jpeg')=>({id,type,name:'<script>untrusted</script>'});
test('empty profile and Khmer interface render without fetching or writing',()=>{
 const h=viewer({},'km');assert(h.render().some(n=>n.type==='p'&&n.props.children==='មិនមានឯកសារ'));
});
test('authenticated thumbnails select materials and reset image transformations',()=>{
 const h=viewer({idFront:file('id&unsafe'),selfie:file('selfie')});
 let nodes=h.render();assert(nodes.filter(n=>n.type==='img').every(n=>n.props.src.startsWith('/authenticated/api/kyc/files?id=')));
 assert(nodes.some(n=>n.props.src==='/authenticated/api/kyc/files?id=id%26unsafe&review=1'));
 nodes=h.click('放大');assert(nodes.some(n=>n.props.style?.transform==='scale(1.25) rotate(0deg)'));
 nodes=h.click('旋转');assert(nodes.some(n=>n.props.style?.transform==='scale(1.25) rotate(90deg)'));
 nodes.find(n=>n.type==='button'&&n.props.children?.[1]?.props?.children==='个人自拍照').props.onClick();
 nodes=h.render();assert(nodes.some(n=>n.props.style?.transform==='scale(1) rotate(0deg)'));
 nodes=h.click('证件正面与自拍并排对比');assert.equal(nodes.filter(n=>n.type==='figure').length,2);
 assert(nodes.some(n=>n.props.className==='kyc-material-previews kyc-material-compare'));
 for(let i=0;i<20;i++)nodes=h.click('放大');assert(nodes.find(n=>n.type==='button'&&n.props.children==='放大').props.disabled);
 assert(nodes.filter(n=>n.type==='a').every(n=>n.props.download===true&&!n.props.target));
});
test('PDF stays inline with an authenticated download fallback and no image controls',()=>{
 const h=viewer({incomeProof:file('pdf','application/pdf')});const nodes=h.render();
 assert.equal(nodes.find(n=>n.type==='object').props.data,'/authenticated/api/kyc/files?id=pdf&review=1');
 assert(nodes.find(n=>n.type==='button'&&n.props.children==='旋转').props.disabled);
 assert(nodes.find(n=>n.type==='a').props.download);assert(!nodes.some(n=>n.type==='button'&&n.props.children==='证件正面与自拍并排对比'));
});
