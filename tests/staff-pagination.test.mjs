import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';

const blank=()=>({loans:[],bots:[],events:[],entries:[],notifications:[],requests:[]});
const loan=id=>({id,name:'Synthetic',status:'kyc_pending',amount:5000,fee:0,paid:0,wallet:0,botId:'',note:'',demoDays:0,kyc:{contacts:[],income:0,document:''}});
function workspace(request,props={initialRole:'ops'},options={}){
 let cursor=0,changed=false;const slots=[],effects=[];
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,v=>{const next=typeof v==='function'?v(slots[i].value):v;if(!Object.is(next,slots[i].value)){slots[i].value=next;changed=true}}]},
  useRef(value){const i=cursor++;return slots[i]??=( {current:value})},
  useMemo(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={value:fn(),deps};return slots[i].value},
  useCallback(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={value:fn,deps};return slots[i].value},
  useEffect(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()}})},
 };
 const jsx=(type,props)=>({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/api-client':{ApiClientError:class extends Error{},apiFetch:async(url,init)=>({data:await request(url,init)})},'@/lib/client-id':{clientRequestId:()=> 'synthetic-request'},'@/lib/domain':{initialState:blank,statusNames:{kyc_pending:'Pending',needs_info:'Needs info',closed:'Closed'},summary:()=>({active:0,closed:0,disbursed:0,repaid:0})},'@/components/customer-journey':{kycPresentation:()=>({}),loanPhase:()=>0,loanSteps:[]}};
 Object.assign(mocks,options.mocks);const exports={};const code=ts.transpileModule(readFileSync(options.source||'app/workspace.tsx','utf8')+(options.inner?'\nexport {TeamClientInner};':''),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>mocks[name]||new Proxy({},{get:(_o,key)=>key}),Error,URLSearchParams,AbortController,queueMicrotask,clearInterval(){},window:{addEventListener(){},removeEventListener(){},location:{origin:'http://localhost',search:'',replace(){}},localStorage:{getItem:()=>null,setItem(){}},setInterval:()=>1,setTimeout(){}},localStorage:{getItem:()=>null},document:{addEventListener(){},removeEventListener(){},documentElement:{classList:{toggle(){}}},querySelector:()=>null,getElementById:()=>null}});
 const render=()=>{let tree;for(let n=0;n<12;n++){changed=false;cursor=0;tree=exports[options.exportName||'default'](props);while(effects.length)effects.shift()();if(!changed)return tree}throw Error('Render loop')};
 return {render,async settle(){await new Promise(resolve=>setImmediate(resolve));return render()}};
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[]}
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');
const find=(tree,predicate)=>{const result=nodes(tree).find(predicate);assert(result,'missing control');return result};
const next=tree=>find(tree,n=>n.props?.['aria-label']==='下一页');
const paged=(page=1,total=5000)=>({state:{...blank(),loans:[loan('loan-'+page)]},pagination:{page,pageSize:50,total,pages:Math.max(1,Math.ceil(total/50))}});

test('staff workspace probes without params, pages explicitly, resets filters and refreshes the current page after actions',async()=>{
 const calls=[];const c=workspace((url,init)=>{calls.push({url,init});return init?.method==='POST'?paged():paged(Number(new URL(url,'http://localhost').searchParams.get('page')||1))});
 assert.match(text(c.render()),/正在读取/);let tree=await c.settle();assert.equal(calls[0].url,'/api/state');assert.match(text(tree),/共 5000 笔/);assert.match(text(tree),/本页 · 待资料审核/);
 next(tree).props.onClick();c.render();tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state?page=2&pageSize=50');assert.match(text(tree),/第 2 \/ 100 页/);
 find(tree,n=>n.type==='button'&&text(n)==='本页 · 待我处理').props.onClick();c.render();tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state?page=1&pageSize=50&status=kyc_pending');
 next(tree).props.onClick();c.render();tree=await c.settle();find(tree,n=>n.type==='Button'&&text(n).startsWith('查看')).props.onClick();tree=c.render();
 find(tree,n=>n.type==='Button'&&text(n).startsWith('资料审核通过')).props.onClick();c.render();await c.settle();
 assert.equal(calls.at(-2).init?.method,'POST');assert.equal(JSON.parse(calls.at(-2).init.body).loanId,'loan-2');assert.equal(calls.at(-1).url,'/api/state?page=2&pageSize=50&status=kyc_pending');
});

function teamClient(request){return workspace(request,{}, {source:'app/team/client.tsx',inner:true,exportName:'TeamClientInner',mocks:{
 '@/lib/admin-i18n':{useAdminLocale:()=>({locale:'zh',setLocale(){}})},
 '@/lib/team/policy':{roleLabels:{ops:'Ops'},roleCatalog:{},roleUnitKind:()=>null,kycFieldGroups:{}},
 '@/lib/team/crm-subpages':{crmSubpageByView:{},canonicalCrmView:v=>v},
 '@/lib/team/crm-menu':{isCrmQueueSection:()=>false},
}})}
const controls=tree=>find(tree,n=>n.type==='StaffPaginationControls').props;
const companyData=id=>({company:{id,slug:id,name:'Synthetic company'},member:{id:'synthetic-ops',role:'ops'},memberships:[],units:[],members:[]});

test('team/CRM probes each company, retains page/status after actions and rejects old-company data',async()=>{
 let company='A',stale;const calls=[];const c=teamClient((url,init)=>{
  calls.push({url,init});if(init?.method==='POST'){if(JSON.parse(init.body).action==='enter')company='B';return {}}
  if(url==='/api/team')return companyData(company);
  const page=Number(new URL(url,'http://localhost').searchParams.get('page')||1);
  if(company==='A'&&page===3)return new Promise(resolve=>stale=resolve);
  return {...paged(page),customerPagination:{page,pageSize:50,total:5001,pages:101}};
 });
 c.render();let tree=await c.settle();assert.deepEqual(calls.map(c=>c.url),['/api/team','/api/state']);assert.equal(controls(tree).customer.total,5001);
 controls(tree).onPage(2);c.render();tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state?page=2&pageSize=50');
 controls(tree).onStatus('closed');c.render();tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state?page=1&pageSize=50&status=closed');
 controls(tree).onPage(2);c.render();tree=await c.settle();
 const action=find(tree,n=>typeof n.type==='function'&&n.type.name==='CrmOverview');
 const post=find(tree,n=>typeof n.props?.post==='function').props.post;
 assert(action);await post({action:'synthetic-action',loanId:'loan-2'},'/api/state');tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state?page=2&pageSize=50&status=closed');
 controls(tree).onPage(3);c.render();await c.settle();await post({action:'enter',slug:'B'});tree=await c.settle();assert.equal(calls.at(-1).url,'/api/state');assert.equal(controls(tree).status,'');
 stale({...paged(3),pagination:{...paged(3).pagination,total:999}});tree=await c.settle();assert.equal(controls(tree).loan.total,5000);
});

test('shared staff controls use both totals and keep the final customer-only page reachable',()=>{
 const pages=[];const c=workspace(()=>null,{loan:paged(100).pagination,customer:{page:100,pageSize:50,total:5001,pages:101},status:'',loading:false,busy:false,error:'',onPage:p=>pages.push(p),onStatus(){},onRetry(){}},{source:'components/staff-pagination.tsx',exportName:'StaffPaginationControls'});
 const tree=c.render();assert.match(text(tree),/共 5000 条/);assert.match(text(tree),/共 5001 位/);assert.equal(next(tree).props.disabled,false);next(tree).props.onClick();assert.deepEqual(pages,[101]);
});

test('team off stays unpaged; paging errors remain visible and retry preserves page and status',async()=>{
 const calls=[];let enabled=false,fail=false;const c=teamClient(url=>{calls.push(url);if(url==='/api/team')return companyData('A');if(fail)throw Error('Synthetic offline');return enabled?paged(Number(new URL(url,'http://localhost').searchParams.get('page')||1)):{state:blank()}});
 c.render();let tree=await c.settle();assert.equal(controls(tree).loan,undefined);controls(tree).onRetry();c.render();tree=await c.settle();assert(calls.filter(url=>url.startsWith('/api/state')).every(url=>url==='/api/state'));
 enabled=true;controls(tree).onRetry();c.render();tree=await c.settle();fail=true;controls(tree).onPage(2);c.render();tree=await c.settle();assert.equal(controls(tree).error,'Synthetic offline');
 fail=false;controls(tree).onRetry();c.render();tree=await c.settle();assert.equal(calls.at(-1),'/api/state?page=2&pageSize=50');assert.equal(controls(tree).error,'');assert.equal(controls(tree).loan.page,2);
});

test('report/customer totals are authoritative while summaries and funding diagnostics remain page-scoped',()=>{
 const report=workspace(()=>null,{customers:[],loans:[],entries:[],notifications:[],pageOnly:true,customerTotal:5001,loanTotal:5000},{source:'components/report-center.tsx',exportName:'ReportCenter'}).render();
 assert.match(text(report),/本页 · 运营数据摘要/);assert.match(text(report),/客户 5001 · 贷款 5000/);
 const customers=workspace(()=>null,{customers:[],events:[],pageOnly:true,total:5001},{source:'components/customer-center.tsx',exportName:'CustomerCenter'}).render();assert.match(text(customers),/本页 0 \/ 5001 位客户/);
 const funding=workspace(()=>null,{loans:[],events:[],entries:[],scope:[],units:[],role:'ops',busy:false,post(){},pageOnly:true},{source:'components/funding-panel.tsx',exportName:'FundingPanel',mocks:{'@/lib/funding-limits':{fundingStatus:()=>({})}}}).render();
 assert.match(text(funding),/本页 · 放款工作台/);assert(!nodes(funding).some(n=>n.props?.className==='funding-limit-summary'));
 for(const view of ['资金监管','冻结与解除']){let tree=workspace(()=>null,{view,work:paged(),units:[],members:[],member:{role:'admin'},busy:false,post(){}},{source:'components/crm-subpages.tsx',exportName:'CrmSubpageRouter',mocks:{'@/lib/team/crm-subpages':{canonicalCrmView:v=>v,crmSubpageByView:{}},'@/lib/funding-limits':{fundingStatus:()=>({dayCents:0,monthCents:0,dailyRemainingCents:0,monthlyRemainingCents:0,dailyPercent:0,monthlyPercent:0,warning:false,blocked:false,timezone:'Asia/Phnom_Penh'})}}}).render();for(let i=0;i<5&&typeof tree.type==='function';i++)tree=tree.type(tree.props);if(view==='资金监管'){assert.match(text(tree),/当前为测试资金监管视图/);assert.doesNotMatch(text(tree),/分页数据不能判定全公司剩余额度/)}else assert(nodes(tree).some(n=>n.type==='EmergencyAccess'))}
});

test('staff off mode stays unpaged; customer mode keeps its existing local pagination',async()=>{
 const calls=[];const c=workspace(url=>{calls.push(url);return {state:{...blank(),loans:Array.from({length:8},(_,i)=>loan(String(i)))}}});c.render();const tree=await c.settle();assert.equal(calls[0],'/api/state');assert.equal(find(tree,n=>n.props?.className==='pagination').props.hidden,true);assert.equal(nodes(tree).filter(n=>n.type==='TableRow'&&text(n).includes('Synthetic')).length,16);
 find(tree,n=>n.type==='button'&&text(n)==='已结清').props.onClick();c.render();await c.settle();assert(calls.every(url=>url==='/api/state'));
 const customerCalls=[];const customer=workspace(url=>{customerCalls.push(url);return {state:blank()}},{customerMode:true});customer.render();await customer.settle();assert.deepEqual(customerCalls,['/api/h5/state']);
});

test('staff paging ignores a stale page response and retains an off-page action target',async()=>{
 let stale;const calls=[];const c=workspace((url,init)=>{calls.push({url,init});const page=new URL(url,'http://localhost').searchParams.get('page');if(page==='2'&&!init?.method)return new Promise(resolve=>stale=resolve);return paged()});
 c.render();let tree=await c.settle();find(tree,n=>n.type==='Button'&&text(n).startsWith('查看')).props.onClick();tree=c.render();next(tree).props.onClick();c.render();await c.settle();
 find(c.render(),n=>n.type==='button'&&text(n)==='本页 · 待我处理').props.onClick();c.render();tree=await c.settle();stale(paged(2));tree=await c.settle();assert.match(text(tree),/第 1 \/ 100 页/);
 // A selected loan remains actionable even if a refreshed page no longer includes it.
 find(tree,n=>n.type==='Button'&&text(n).startsWith('资料审核通过')).props.onClick();c.render();await c.settle();assert.equal(JSON.parse(calls.at(-2).init.body).loanId,'loan-1');
});

test('C1 Q7 fixture: all five roles page 5000 customers without duplicates or omissions',async()=>{
 // Reuse the existing SQLite/platform harness and Q7 data setup without changing or registering its tests.
 const original=readFileSync('tests/team-integration.test.mjs','utf8');
 const prefix=original.slice(0,original.indexOf('\ntest('));
 const q7=original.slice(original.indexOf("test('Q7 actual state route pages 5000 customers"));
 const setup=q7.slice(q7.indexOf(' user=owner;'),q7.indexOf(' await kyc.initialize'));
 assert(prefix.includes('async function mod(')&&setup.includes('i<5000'));
 const source=prefix.replace("payease_company='+selected", "payease_staff_company='+selected")+setup+`
 const institution=crypto.randomUUID();sql.prepare('INSERT INTO team_units (id,tenant_id,kind,name,active) VALUES (?,?,?,?,1)').run(institution,P,'institution','Synthetic institution');
 const members={};for(const role of ['ops','kyc','lender','finance']){members[role]=crypto.randomUUID();sql.prepare('INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)').run(members[role],P,'c1-'+role,role+'@example.test',role,['ops','kyc'].includes(role)?department:institution)}
 sql.prepare('UPDATE team_assignments SET institution_id=?,reviewer_id=? WHERE tenant_id=?').run(institution,members.kyc,P);
 const route=await mod('@/app/api/state/route');env.CUSTOMER_ROWS='on';selected=P;
 for(const role of ['admin','ops','kyc','lender','finance']){
  user=role==='admin'?owner:{userId:'c1-'+role,email:role+'@example.test'};
  const customers=new Set(),loans=new Set();let firstMs,midMs;
  for(let page=1;page<=101;page++){
   const start=performance.now(),response=await route.GET(new Request('http://localhost/api/state?page='+page+'&pageSize=50')),body=await response.json();
   assert.equal(response.status,200);assert.equal(body.pagination.total,5000);assert.equal(body.customerPagination.total,5001);
   if(page===1)firstMs=performance.now()-start;if(page===50)midMs=performance.now()-start;
   for(const item of body.customers){assert(!customers.has(item.customerId));customers.add(item.customerId)}
   for(const item of body.state.loans){assert(!loans.has(item.id));loans.add(item.id)}
  }
  assert.equal(customers.size,5001);assert.equal(loans.size,5000);
  for(let i=0;i<5000;i++){assert(customers.has('q7-perf-'+i));assert(loans.has('q7-loan-'+i))}assert(customers.has('q7-no-loan'));
  console.log('C1 local SQLite HTTP route '+role+': first='+firstMs.toFixed(2)+'ms middle='+midMs.toFixed(2)+'ms, 5001 customers / 5000 loans');
 }
 sql.close();`;
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 await vm.runInThisContext('(async function(require,exports){'+code+'})')(createRequire(import.meta.url),{});
});

test('staff paging exposes loading, retryable failure and empty pages without losing navigation',async()=>{
 let finish,fail=false;const c=workspace(()=>new Promise((resolve,reject)=>{finish=value=>fail?reject(Error('Synthetic offline')):resolve(value)}));
 c.render();await c.settle();finish(paged());let tree=await c.settle();next(tree).props.onClick();c.render();tree=await c.settle();assert.equal(next(tree).props.disabled,true);assert.match(text(tree),/正在加载列表/);
 fail=true;finish();tree=await c.settle();assert.match(text(tree),/Synthetic offline/);assert.equal(next(tree).props.disabled,true);
 fail=false;find(tree,n=>n.type==='Button'&&text(n)==='重新加载').props.onClick();c.render();finish({...paged(2),state:blank()});tree=await c.settle();assert.match(text(tree),/没有匹配的申请/);assert.equal(next(tree).props.disabled,false);
});
