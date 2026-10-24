import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function load(file,mocks,globals={}){
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext('(function(exports,require){'+js+'\n})',globals)(exports,n=>{assert(n in mocks,n);return mocks[n]});return exports;
}
function queue(){
 let cursor=0;const state=[];const jsx=(type,props)=>({type,props});
 const component=load('components/kyc-orders.tsx',{
  react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=v]},useEffect(){}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/client-id':{},'@/lib/api-client':{},
  '@/lib/admin-i18n':{useAdminLocale:()=>({locale:'zh'})},'@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},'@/components/csv-export':{CsvExport:'csv'},'@/lib/kyc/core':{statusLabels:{submitted:'已提交'}}
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
 assert.equal(q.nodes(tree).filter(n=>n.type==='time').length,0);
 for(const file of ['app/team/client.tsx','components/crm-subpages.tsx'])assert.match(readFileSync(file,'utf8'),/memberId=\{member\??\.id\}/);
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
