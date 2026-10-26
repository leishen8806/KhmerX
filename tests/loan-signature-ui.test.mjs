import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function signing(confirmed=true,saved=false){
 let cursor=0,tree;const state=[],effects=[],calls=[],routes=[],images=[];
 const context2d={clearRect(){canvas.clearCalls++},beginPath(){},moveTo(){},lineTo(){},stroke(){},drawImage(){}};
 const canvas={clearCalls:0,width:600,height:220,getContext:()=>context2d,getBoundingClientRect:()=>({left:0,top:0,width:600,height:220}),setPointerCapture(){},toBlob:fn=>fn(new Blob(['SYNTHETIC PNG'],{type:'image/png'}))};
 const hooks={useRef:initial=>({current:initial===null?canvas:initial}),useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=v]},useEffect(fn,deps){const i=cursor++;if(!state[i]||deps.some((v,j)=>!Object.is(v,state[i][j]))){state[i]=deps;effects.push(fn)}}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({push:p=>routes.push(p)})},'@/components/ui/button':{Button:'Button'},'@/components/ui/checkbox':{Checkbox:'Checkbox'},'@/components/mini-shell':{useMiniNavigation:()=>null},'@/components/customer-journey':{LoanSteps:'LoanSteps'},'@/lib/client-id':{clientRequestId:()=> 'synthetic-request'},'@/lib/api-client':{async apiFetch(url,init={}){calls.push({url,...init});return {data:!init.method?{loan:{contract:saved?JSON.stringify({signatureId:'existing-signature'}):undefined,id:'synthetic-loan',amount:5000,fee:500,billConfirmedAt:confirmed?'2026-10-24':null},termsVersion:'UNCHANGED-TERMS',blocks:[{type:'paragraph',text:'ORIGINAL CONTRACT CONTENT'}]}:url==='/api/loan/sign'?{contract:{signatureId:'synthetic-signature'}}:{}}}}};
 const context=vm.createContext({URLSearchParams,Blob,window:{location:{search:'?loan=synthetic-loan'}},Image:class{set src(v){images.push(v);this.width=600;this.height=220;this.onload?.()}}});
 const load=file=>{const exports={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>n==='@/app/kyc/client'?load('app/kyc/client.tsx'):n==='@/components/loan-signature'?load('components/loan-signature.tsx'):mocks[n]||{});return exports};
 const component=load('app/loan/sign/client.tsx').default;
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
 const render=()=>{cursor=0;tree=component({});effects.splice(0).forEach(fn=>fn());return nodes(tree)};
 render();await new Promise(r=>setImmediate(r));render();return {calls,routes,images,canvas,render,nodes:()=>nodes(tree),async settle(){await new Promise(r=>setImmediate(r));render()}};
}
test('actual loan signing page keeps consent, signature upload and loan-apply contracts through shared component extraction',async()=>{
 const h=await signing();assert(JSON.stringify(h.nodes()).includes('ORIGINAL CONTRACT CONTENT'));assert(h.nodes().find(n=>n.type==='Button'&&n.props.children==='保存手写签名').props.disabled);
 h.nodes().find(n=>n.type==='Checkbox').props.onCheckedChange(true);h.render();const c=h.nodes().find(n=>n.type==='canvas');const e={currentTarget:h.canvas,clientX:20,clientY:20,pointerId:1};c.props.onPointerDown(e);c.props.onPointerMove({...e,clientX:30});c.props.onPointerUp();h.render();const cleared=h.canvas.clearCalls;h.nodes().find(n=>n.type==='Button'&&n.props.children==='清空重签').props.onClick();h.render();assert(h.canvas.clearCalls>cleared);assert(h.nodes().find(n=>n.type==='Button'&&n.props.children==='保存手写签名').props.disabled);const fresh=h.nodes().find(n=>n.type==='canvas');fresh.props.onPointerDown(e);fresh.props.onPointerMove({...e,clientX:40});fresh.props.onPointerUp();h.render();const save=h.nodes().find(n=>n.type==='Button'&&n.props.children==='保存手写签名');assert(!save.props.disabled);save.props.onClick();h.render();assert(h.nodes().find(n=>n.type==='Button'&&n.props.children==='保存手写签名').props.disabled);await h.settle();const upload=h.calls.find(c=>c.url==='/api/loan/sign'&&c.method==='POST');assert.equal(upload.headers['X-Loan-Id'],'synthetic-loan');assert.equal(upload.headers['X-Loan-Consent'],'true');assert.equal(upload.headers['X-Loan-Terms'],'UNCHANGED-TERMS');assert.equal(upload.body.type,'image/png');assert(!h.nodes().some(n=>n.type==='Button'&&n.props.children==='保存手写签名'));
 await h.nodes().find(n=>n.type==='Button'&&n.props.children==='提交贷款审批 →').props.onClick();await h.settle();const apply=JSON.parse(h.calls.find(c=>c.url==='/api/h5/state').body);assert.deepEqual(apply,{action:'apply',loanId:'synthetic-loan',requestId:'synthetic-request',billConfirmed:true});assert.deepEqual(h.routes,['/h5']);
});
test('unconfirmed fees still prevent drawing and saving after consent',async()=>{
 const h=await signing(false);h.nodes().find(n=>n.type==='Checkbox').props.onCheckedChange(true);h.render();const c=h.nodes().find(n=>n.type==='canvas');c.props.onPointerDown({currentTarget:h.canvas});assert(h.nodes().find(n=>n.type==='Button'&&n.props.children==='保存手写签名').props.disabled);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
test('existing saved signature loads its original image and remains read-only',async()=>{
 const h=await signing(true,true);assert(h.images.includes('/api/kyc/files?id=existing-signature'));assert(!h.nodes().some(n=>n.type==='Checkbox'));assert(!h.nodes().some(n=>n.type==='Button'&&n.props.children==='清空重签'));assert(!h.nodes().some(n=>n.type==='Button'&&n.props.children==='保存手写签名'));const c=h.nodes().find(n=>n.type==='canvas');c.props.onPointerDown({currentTarget:h.canvas});assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
});
