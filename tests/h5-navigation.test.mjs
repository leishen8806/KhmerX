import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual authentication component with a small hook/route harness.
// No server, real credentials, or Telegram messages are needed.
function client(fetch,initData=''){
 let path='/h5',cursor=0,changed=false;
 const slots=[],effects=[],listeners={},routes=[];
 const depsEqual=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,v=>{const next=typeof v==='function'?v(slots[i].value):v;if(!Object.is(next,slots[i].value)){slots[i].value=next;changed=true}}]},
  useCallback(fn,deps){const i=cursor++;if(!depsEqual(slots[i]?.deps,deps))slots[i]={value:fn,deps};return slots[i].value},
  useEffect(fn,deps){const i=cursor++;if(!depsEqual(slots[i]?.deps,deps)){effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()}})}},
 };
 const jsx=(type,props,key)=>({type,props,key});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/navigation':{usePathname:()=>path,useSearchParams:()=>new URLSearchParams(),useRouter:()=>({push:p=>routes.push(p),replace:p=>routes.push(p)})},'@/components/ui/button':{Button:'Button'},'@/components/ui/input':{Input:'Input'},'@/components/password-recovery':{PasswordRecovery:'Recovery'},'@/components/mini-client':{MiniClient:'MiniClient'},'@/components/mini-shell':{MiniNavigationProvider:'MiniNavigationProvider'},'@/components/mini-route-loading':{MiniRouteLoading:'Loading'},'@/lib/api-client':{apiFetch:async(url,init)=>{const result=await fetch(url,init);const data=await result.json();if(!result.ok)throw Object.assign(Error(data.error||'request failed'),{status:result.status,code:data.code});return {data,response:result,requestId:data.requestId}}}};
 mocks['@/lib/error-messages']={messageForError:({code})=>code};
 mocks['@/components/auth-locale']={AuthLocaleBridge:()=>null};
 mocks['@/lib/i18n']={messages:{en:{authTelegramUnavailable:'Telegram login is temporarily unavailable. Close and reopen the Mini App.',authTelegramChecking:'The server is verifying your Telegram identity. Close and reopen the Mini App.',authTitleRegister:'Register / log in'},km:{},zh:{}}};
 const exports={};
 const source=readFileSync(new URL('../app/h5/login.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>{assert(name in mocks,name);return mocks[name]},fetch,URL,URLSearchParams,window:{location:{origin:'https://payease.khmerx.org',hash:'',search:'',reload(){}},Telegram:{WebApp:{initData}},addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}}});
 const render=()=>{let tree;for(let n=0;n<10;n++){changed=false;cursor=0;tree=exports.default();while(effects.length)effects.shift()();if(!changed)return tree}throw Error('Render loop')};
 return {render,async settle(){await new Promise(resolve=>setImmediate(resolve));return render()},navigate(p){path=p;return render()},focus(){listeners.focus()},routes};
}
const policy={phoneVerification:false,passwordSetup:false};
const session={phoneMasked:'+120 •••• 0174',mode:'telegram',expiresAt:Date.now()+60000};
const auth=(s=session)=>({session:s,policy,mode:'telegram',company:'Synthetic company'});
const response=d=>Promise.resolve(Response.json(d));

test('authenticated menu and button routes retain login state without bootstrapping again',async()=>{
 const calls=[];const c=client(url=>{calls.push(url);return response(auth())});
 assert.equal(c.render().type,'Loading');
 const workspace=tree=>tree.type==='MiniNavigationProvider'?tree.props.children:tree;
 assert.equal(workspace(await c.settle()).type,'MiniClient');
 for(const screen of ['records','me','kyc','apply','bill','sign','status','repay','withdraw','contract']){
  const tree=workspace(c.navigate('/h5/'+screen));assert.equal(tree.type,'MiniClient');assert.equal(tree.props.screen,screen);
 }
 assert.deepEqual(calls,['/api/h5/auth']);
});

test('mini navigation switches screen state without changing the browser route',async()=>{
 const c=client(()=>response(auth()));
 c.render();
 const tree=await c.settle();
 assert.equal(tree.type,'MiniNavigationProvider');
 assert.equal(tree.props.children.props.screen,'home');
 tree.props.navigate('/h5/me');
 const next=c.render();
 assert.equal(next.type,'MiniNavigationProvider');
 assert.equal(next.props.children.props.screen,'me');
 assert.equal(c.routes.length,0);
});

test('slow Telegram verification keeps loading visible until the workspace is ready',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const calls=[];
 const c=client(url=>{calls.push(url);return url.endsWith('/telegram')?pending:response(auth(null))},'synthetic-signed-payload');
 assert.equal(c.render().type,'Loading');
 assert.equal((await c.settle()).type,'Loading');
 finish(Response.json(auth()));assert.equal((await c.settle()).props.children.type,'MiniClient');
 assert.deepEqual(calls,['/api/h5/auth','/api/h5/auth/telegram']);
});

test('failed Telegram verification stays on its error view and never opens the workspace',async()=>{
 const c=client(url=>url.endsWith('/telegram')?Promise.resolve(Response.json({error:'Invalid signature'},{status:401})):response(auth(null)),'synthetic-invalid-payload');
 c.render();const tree=await c.settle();assert.equal(tree.type,'main');assert.match(JSON.stringify(tree),/Telegram login is temporarily unavailable/);assert.doesNotMatch(JSON.stringify(tree),/MiniClient/);
});

test('session expiry on focus removes the workspace and returns to login',async()=>{
 let active=true;const c=client(()=>response(auth(active?session:null)));
 c.render();assert.equal((await c.settle()).props.children.type,'MiniClient');active=false;c.focus();
 const tree=await c.settle();assert.equal(tree.type,'main');assert.match(JSON.stringify(tree),/Register \/ log in/);
});
