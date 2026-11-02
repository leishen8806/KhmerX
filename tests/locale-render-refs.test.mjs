import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {ESLint} from 'eslint';

// Use the real components and dictionaries; replace only React/browser/platform APIs.
function client(kind,{saved,query='',browser='en',flags,fail=false}={}){
 let cursor=0,dirty=true,tree,walks=0,reenter=false,frameId=0;
 const slots=[],effects=[],refs=[],observers=[],frames=new Map(),cancelled=[],requests=[],events=[],urls=[],writes=[],routes=[];
 const storage=new Map(saved===undefined?[]:[[kind==='auth'?'payease-auth-language':'payease-language',saved]]);
 const text={textContent:kind==='auth'?'密码登录':'首页',parentElement:{tagName:'P'}};
 const root={lang:'',contains:()=>false};
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  createContext(value){const context={value};context.Provider={context};return context},useContext:context=>context.value,
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,v=>{slots[i].pending=typeof v==='function'?v(slots[i].pending??slots[i].value):v;dirty=true}]},
  useRef(initial){const i=cursor++;if(!slots[i]){slots[i]={ref:{current:initial}};refs.push(slots[i].ref)}return slots[i].ref},
  useMemo(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={value:fn(),deps};return slots[i].value},
  useEffect(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()}})},
 };
 class Observer{
  constructor(fn){this.fn=fn;this.active=false;this.observes=0;this.disconnects=0;observers.push(this)}
  observe(target){this.target=target;this.active=true;this.observes++}
  disconnect(){this.active=false;this.disconnects++}
 }
 const document={body:{},documentElement:{lang:''},querySelector:selector=>selector===(kind==='auth'?'.mini-login':'.mini-app')?root:null,
  addEventListener(){},removeEventListener(){},createTreeWalker(){walks++;if(reenter)observers.at(-1)?.fn();let done=false;return {nextNode:()=>done?null:(done=true,text)}}};
 const window={localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){writes.push([key,value]);storage.set(key,value)}},
  location:{origin:'http://localhost',search:query,href:'http://localhost/h5'+query,hash:'',assign(){throw Error('Unexpected full-page navigation')}},
  history:{replaceState(_state,_title,url){urls.push(String(url));window.location.href=String(url)}},dispatchEvent:event=>events.push(event),
  requestAnimationFrame(fn){frames.set(++frameId,fn);return frameId},cancelAnimationFrame(id){cancelled.push(id);frames.delete(id)}};
 const jsx=(type,props,key)=>({type,props,key});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'lucide-react':Object.fromEntries(['ArrowLeft','Home','ReceiptText','UserRound','Bell'].map(k=>[k,k])),
  '@/lib/analytics':{trackEvent(){}},'@/lib/api-client':{async apiFetch(url,init){requests.push({url,init});if(url==='/api/h5/auth'){if(fail)throw Error('Synthetic offline');return {data:{languages:flags}}}return {data:{}}}}};
 const sandbox=vm.createContext({window,document,navigator:{language:browser},MutationObserver:Observer,NodeFilter:{SHOW_TEXT:4},URL,URLSearchParams,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 const load=(file)=>{const exports={},require=name=>{assert(name in mocks,name);return mocks[name]};let source=readFileSync(file,'utf8');
  // Expose the exact event handler to exercise its guard even when its button is hidden.
  if(file.endsWith('mini-shell.tsx'))source=source.replace('const value=useMemo','globalThis.choose=chooseLanguage;const value=useMemo');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInContext('(function(exports,require){'+js+'\n})',sandbox)(exports,require);return exports};
 mocks['@/lib/i18n']=load('lib/i18n.tsx');
 const component=load('components/'+(kind==='auth'?'auth-locale':'mini-shell')+'.tsx');
 function render(){for(let n=0;n<10;n++){dirty=false;for(const slot of slots)if(slot&&'pending' in slot){slot.value=slot.pending;delete slot.pending}cursor=0;
  tree=kind==='auth'?component.AuthLocaleBridge():component.MiniShell({screen:'home',children:'Synthetic content'});
  if(kind==='mini')root.lang=tree.props.children.props.lang;
  while(effects.length)effects.shift()();if(!dirty)return tree}throw Error('Render loop')}
 const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
 const button=predicate=>{const found=nodes(tree).find(node=>node.type==='button'&&predicate(node.props));assert(found,'Button not found');return found.props};
 render();
 return {render,async settle(){await new Promise(r=>setImmediate(r));return render()},root,text,refs,storage,events,urls,writes,requests,observers,frames,cancelled,routes,component,document,
  i18n:mocks['@/lib/i18n'],get tree(){return tree},get walks(){return walks},button,
  choose(locale){if(kind==='auth')button(p=>p['aria-label']===mocks['@/lib/i18n'].localeLabels[locale]).onClick();else sandbox.choose(locale)},
  menu(){button(p=>p.className==='mini-icon-menu-trigger').onClick();render()},
  mutate(){observers.filter(o=>o.active&&o.target===root).forEach(o=>o.fn())},
  flushFrames(){for(const [id,fn] of [...frames]){frames.delete(id);fn()}},
  provide(provider){provider.type.context.value=provider.props.value},
  reenter(value){reenter=value},unmount(){for(const slot of slots)slot?.cleanup?.()},
 };
}
const active=h=>h.observers.filter(o=>o.active&&o.target===h.root);

test('AuthLocale initial storage, switching, fresh observer, reentry and cleanup',()=>{
 for(const saved of ['en','km','zh','invalid']){
  const h=client('auth',{saved}),initial=saved==='invalid'?'en':saved;
  assert.equal(h.root.lang,initial);assert.equal(active(h).length,1);
  for(const locale of ['zh','en','km'])assert.equal(h.button(p=>p['aria-label']===h.i18n.localeLabels[locale])['aria-pressed'],locale===initial);
  const old=active(h)[0],oldObserves=old.observes,next=initial==='km'?'en':'km';
  h.choose(next);assert.equal(h.storage.get('payease-auth-language'),next);assert.equal(h.document.documentElement.lang,next);
  h.render();assert.equal(h.root.lang,next);assert.equal(h.text.textContent,next==='km'?'ចូលដោយពាក្យសម្ងាត់':'Password sign in');
  assert.equal(old.active,false);assert.equal(old.observes,oldObserves);assert.equal(old.disconnects,1);assert.equal(active(h).length,1);
  const current=active(h)[0],walks=h.walks,observes=current.observes,disconnects=current.disconnects;
  h.text.textContent='密码登录';h.reenter(true);h.mutate();h.reenter(false);
  assert.equal(h.walks,walks+1);assert.equal(current.observes,observes+1);assert.equal(current.disconnects,disconnects+1);
  assert.equal(h.root.lang,next);assert.equal(h.text.textContent,next==='km'?'ចូលដោយពាក្យសម្ងាត់':'Password sign in');
  h.unmount();assert.equal(active(h).length,0);assert.equal(current.disconnects,disconnects+2);
 }
});

test('AuthLocale Chinese selection commits state, storage and document language',()=>{
 const h=client('auth',{saved:'en'});h.choose('zh');h.render();assert.equal(h.root.lang,'zh');assert.equal(h.storage.get('payease-auth-language'),'zh');assert.equal(h.document.documentElement.lang,'zh');assert.equal(h.text.textContent,'密码登录');assert.equal(active(h).length,1);h.unmount();
});

test('MiniShell initial locale priority uses query then storage then browser',()=>{
 for(const [options,expected] of [[{query:'?lang=zh',saved:'km'},'zh'],[{query:'?lang=bad',saved:'km'},'km'],[{saved:'bad',browser:'km-KH'},'km'],[{browser:'en-GB'},'en'],[{browser:'fr'},'en']]){
  const h=client('mini',options);assert.equal(h.root.lang,expected);assert.equal(h.refs[0].current,expected);h.unmount();
 }
});

test('MiniShell enabled selection is synchronous and all side effects occur once',async()=>{
 const h=client('mini',{saved:'en',flags:{zh:false}});await h.settle();h.menu();
 const old=active(h)[0],walks=h.walks;
 h.button(p=>p.lang==='km').onClick();
 assert.equal(h.refs[0].current,'km');assert.equal(h.root.lang,'km');assert.equal(h.text.textContent,h.i18n.i18nValue('km').t('home'));assert.equal(h.walks,walks+1);
 // State has not been committed yet; the event already changed the visible DOM/ref.
 assert.equal(h.tree.props.value.locale,'en');
 assert.equal(h.events.length,1);assert.equal(h.events[0].type,'payease-language-change');assert.equal(h.events[0].detail,'km');
 assert.deepEqual(h.writes,[['payease-language','km']]);assert.equal(new URL(h.urls[0]).searchParams.get('lang'),'km');assert.equal(h.urls.length,1);
 const posted=h.requests.filter(r=>r.url==='/api/h5/locale');assert.equal(posted.length,1);assert.equal(posted[0].init.method,'POST');assert.equal(JSON.parse(posted[0].init.body).locale,'km');
 h.render();assert.equal(h.tree.props.value.locale,'km');assert.equal(old.active,false);assert.equal(old.disconnects,1);assert.equal(active(h).length,1);
 h.menu();assert.throws(()=>h.button(p=>p.lang==='zh'),/Button not found/);
 const counts=[h.walks,h.events.length,h.writes.length,h.urls.length,h.requests.length];h.choose('zh');
 assert.deepEqual([h.walks,h.events.length,h.writes.length,h.urls.length,h.requests.length],counts);assert.equal(h.refs[0].current,'km');
 h.unmount();
});

test('MiniShell server fallback refreshes ref before observer/rAF; failed preflight preserves locale',async()=>{
 const h=client('mini',{saved:'km',flags:{km:false}}),old=active(h)[0];
 await h.settle();assert.equal(h.root.lang,'en');assert.equal(h.refs[0].current,'en');assert.equal(h.storage.get('payease-language'),'en');
 assert.equal(h.text.textContent,h.i18n.i18nValue('en').t('home'));assert.equal(old.active,false);assert.equal(old.disconnects,1);assert.equal(active(h).length,1);
 const current=active(h)[0],walks=h.walks,observes=current.observes,disconnects=current.disconnects;
 h.text.textContent='首页';h.mutate();h.mutate();assert.equal(h.frames.size,1);h.reenter(true);h.flushFrames();h.reenter(false);
 assert.equal(h.walks,walks+1);assert.equal(h.frames.size,0);assert.equal(h.text.textContent,h.i18n.i18nValue('en').t('home'));assert.equal(current.observes,observes+1);assert.equal(current.disconnects,disconnects+1);
 h.mutate();const queued=[...h.frames.keys()][0];h.unmount();assert.equal(h.frames.size,0);assert.deepEqual(h.cancelled,[queued]);assert.equal(active(h).length,0);assert.equal(current.disconnects,disconnects+2);
 const offline=client('mini',{saved:'km',fail:true});await offline.settle();assert.equal(offline.root.lang,'km');assert.equal(offline.refs[0].current,'km');assert.equal(offline.storage.get('payease-language'),'km');assert.equal(offline.writes.length,0);offline.unmount();
});

test('MiniNavLink retains client navigation through its provider',()=>{
 const h=client('mini'),provider=h.component.MiniNavigationProvider({navigate:href=>h.routes.push(href),children:null});
 const link=h.component.MiniNavLink({href:'/h5/records',children:'Synthetic records'});assert.equal(link.type,'Link');assert.equal(link.props.href,'/h5/records');
 h.provide(provider);const button=h.component.MiniNavLink({href:'/h5/records',children:'Synthetic records'});assert.equal(button.type,'button');button.props.onClick();assert.deepEqual(h.routes,['/h5/records']);
 h.render();h.button(p=>p.className==='mini-tab-button'&&p['aria-current']!=='page').onClick();assert.deepEqual(h.routes,['/h5/records','/h5/records']);h.unmount();
});

test('ESLint prevents render-phase ref access in both actual locale components',async()=>{
 const results=await new ESLint().lintFiles(['components/auth-locale.tsx','components/mini-shell.tsx']);
 const errors=results.flatMap(result=>result.messages.filter(message=>message.ruleId==='react-hooks/refs'&&message.severity===2));
 assert.equal(errors.length,0,errors.map(error=>error.message).join('\n'));
 for(const result of results)assert(result.warningCount<=(result.filePath.endsWith('auth-locale.tsx')?0:5),'Warnings must not exceed the unchanged component baseline');
});
