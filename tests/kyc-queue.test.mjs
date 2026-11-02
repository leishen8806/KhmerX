import * as queueCopy from '../lib/kyc/queue-copy.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as queueTime from '../lib/kyc/queue-time.ts';

function load(file,mocks,globals={}){
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext('(function(exports,require){'+js+'\n})',globals)(exports,n=>{assert(n in mocks,n);return mocks[n]});return exports;
}
function queue(locale='zh'){
 let cursor=0;const state=[];const jsx=(type,props)=>({type,props});
 const component=load('components/kyc-orders.tsx',{
  react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=v]},useEffect(){}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/client-id':{},'@/lib/kyc/queue-copy':queueCopy,'@/lib/api-client':{},
  '@/lib/kyc/queue-time':queueTime,'@/lib/admin-i18n':{useAdminLocale:()=>({locale})},'@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},'@/components/csv-export':{CsvExport:'csv'},'@/lib/kyc/core':{statusLabels:{submitted:'待人工审核'}}
 });
 const props={orders:[{id:'mine',customer_id:'one',status:'submitted',updated_at:'2026-10-24T00:00:00Z'},{id:'peer',customer_id:'two',status:'submitted'},{id:'unassigned',customer_id:'three',status:'submitted'}],scope:[{customer_id:'one',reviewer_id:'member-id'},{customer_id:'two',reviewer_id:'auth-user-id'},{customer_id:'three',reviewer_id:null}],units:[],members:[],role:'kyc',memberId:'member-id',renderAssignment:()=>null};
 const render=()=>{cursor=0;return component.KycOrders(props)};
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 return {...component,props,render,nodes};
}

test('queue sorts real submission timestamps oldest first, stably, unknown last; never substitutes updated_at',()=>{
 const q=queue(),rows=[{id:'unknown',updated_at:'2000-01-01T00:00:00Z'},{id:'new',submitted_at:'2026-10-24T00:00:00Z'},{id:'old',submitted_at:'2026-10-23T00:00:00Z'},{id:'same',submitted_at:'2026-10-23T00:00:00Z'},{id:'invalid',submitted_at:'not a date'},{id:'numeric',submitted_at:1}];
 assert.deepEqual(Array.from(q.oldestSubmittedFirst(rows),r=>r.id),['old','same','new','unknown','invalid','numeric']);
 assert.equal(rows[0].id,'unknown');assert.equal(q.submittedTime(rows[0]),null);
 assert.equal(q.submittedTime({submitted_at:''}),null);
});
test('English and Khmer queue static text has no Chinese and Khmer submission ages use full local units',()=>{
 const text=n=>Array.isArray(n)?n.map(text).join(' '):typeof n==='string'?n:n&&typeof n==='object'?text(n.props?.children):'';
 for(const locale of ['en','km']){const q=queue(locale);assert(!/[\u3400-\u9fff]/.test(text(q.render())));}
 const q=queue('km');assert.match(q.relativeSubmission(0,60000,'km'),/នាទី/);assert(!/-1|min|\bd\b/.test(q.relativeSubmission(0,60000,'km')));
});
test('queue labels are separated from adjacent values in all three languages',()=>{
 const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):String(n??'');
 for(const [locale,results,phone,customer,revision] of [['zh','当前结果','注册手机','客户','· 资料版本'],['en','Results','Registered phone','Customer','· Revision'],['km','លទ្ធផល','ទូរសព្ទដែលបានចុះឈ្មោះ','អតិថិជន','· កំណែទិន្នន័យ']]){
  const q=queue(locale);q.props.orders=[{id:'CASE-001',customer_id:'USER-001',customer_ref:'CUSTOMER-001',phone_mask:'+855 MASKED',status:'submitted',revision:4}];
  const content=text(q.render());for(const [label,value] of [[results,'1'],[phone,'+855 MASKED'],[customer,'CUSTOMER-001'],[revision,'4']])assert(content.includes(label+' '+value),locale+': '+label);
 }
});

test('assigned to me uses member id with scope reviewer_id; reset restores authorized visible rows',()=>{
 const q=queue();let tree=q.render();
 const cards=tree=>q.nodes(tree).filter(n=>n.type==='article').map(n=>n.props.children[0].props.children[0].props.children[1].props.children);
 assert.deepEqual(cards(tree),['MINE','PEER','UNASSIGN']);
 q.nodes(tree).find(n=>n.props?.type==='checkbox').props.onChange({target:{checked:true}});tree=q.render();
 assert.deepEqual(cards(tree),['MINE']);
 assert.equal(q.assignedToMember(q.props.scope,'two','member-id'),false);
 assert.equal(q.assignedToMember(q.props.scope,'three',undefined),false);
 q.nodes(tree).find(n=>n.props?.children==='重置查询').props.onClick();assert.equal(cards(q.render()).length,3);
 q.props.memberId=undefined;assert.equal(q.nodes(q.render()).find(n=>n.props?.type==='checkbox').props.disabled,true);
});

test('live response without submitted_at displays unavailable timing despite updated_at',()=>{
 const q=queue(),tree=q.render();
 assert.equal(q.nodes(tree).filter(n=>n.props?.children==='提交时间不可用，暂无法计算等待时长。').length,3);
 assert.equal(q.nodes(tree).filter(n=>n.type==='time').length,1);
 for(const file of ['app/team/client.tsx','components/crm-subpages.tsx'])assert.match(readFileSync(file,'utf8'),/memberId=\{member\??\.id\}/);
});

test('real submission time renders relative age with full timestamp title; only waiting over 24h turns red',()=>{
 const q=queue(),now=Date.now();
 const row=(id,age,status='submitted')=>({id,customer_id:id,status,submitted_at:new Date(now-age).toISOString()});
 q.props.orders=[row('overdue',25*3600000),row('recent',2*3600000),row('approved',30*3600000,'approved'),{id:'unknown',customer_id:'unknown',status:'submitted',updated_at:new Date(now-50*3600000).toISOString()}];
 const nodes=q.nodes(q.render()),times=nodes.filter(n=>n.type==='time'&&q.props.orders.some(o=>o.submitted_at===n.props.dateTime));
 assert.equal(times.length,3);
 const overdue=times.find(n=>n.props.dateTime===q.props.orders[0].submitted_at);
 assert.match(overdue.props.children.join(''),/1天前/);
 assert.equal(overdue.props.title,new Date(q.props.orders[0].submitted_at).toLocaleString('zh'));
 assert.equal(nodes.filter(n=>typeof n.props?.className==='string'&&n.props.className.split(' ').includes('is-late')).length,1);
 assert.match(times.find(n=>n.props.dateTime===q.props.orders[1].submitted_at).props.children.join(''),/2小时前/);
 assert.equal(q.relativeSubmission(now-60000,now,'en'),'1 minute ago');
 assert.equal(q.relativeSubmission(now-3600000,now,'km'),'1 ម៉ោងមុន');
});

test('no-id review redirects to the canonical team route after auth; detail remains guarded',async()=>{
 const calls=[],jsx=(type,props)=>({type,props});
 const page=load('app/kyc/review/page.tsx',{'../../chatgpt-auth':{async requireChatGPTUser(path){calls.push(['auth',path])}},'../client':{default:'KycClient'},'next/navigation':{redirect(url){calls.push(['redirect',url]);throw Error('redirect')}},'react/jsx-runtime':{jsx,jsxs:jsx}}).default;
 for(const id of [undefined,'',' ',['multiple']]){
  calls.length=0;await assert.rejects(page({searchParams:Promise.resolve({id})}),/redirect/);
  assert.deepEqual(calls.map(c=>c[0]),['auth','redirect']);assert.equal(calls[1][1],'/team/kyc?view='+encodeURIComponent('KYC 审核队列'));
 }
 calls.length=0;const detail=await page({searchParams:Promise.resolve({id:'synthetic'})});assert.equal(detail.props.review,true);assert.equal(calls.length,1);
});
