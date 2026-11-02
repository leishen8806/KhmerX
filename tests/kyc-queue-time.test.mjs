import * as queueCopy from '../lib/kyc/queue-copy.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {existsSync,readFileSync} from 'node:fs';
const formatter=existsSync('lib/kyc/queue-time.ts')?await import('../lib/kyc/queue-time.ts'):{};
function queue(locale='en',updated='2026-10-24T00:00:00Z',intl=Intl){
 let cursor=0,now=Date.parse('2026-10-24T00:01:30Z');const state=[],effects=[],cleanup=[],timers=[],cleared=[];
 const hooks={useState(value){const i=cursor++;if(!(i in state))state[i]=typeof value==='function'?value():value;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useEffect(fn,deps){const i=cursor++;if(!state[i]||deps.some((v,j)=>v!==state[i][j])){state[i]=deps;effects.push(()=>{cleanup[i]?.();cleanup[i]=fn()})}}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props}),mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/kyc/queue-copy':queueCopy,'@/lib/client-id':{},'@/lib/api-client':{},'@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},'@/components/csv-export':{CsvExport:'csv'},'@/lib/kyc/core':{statusLabels:{submitted:'已提交'}},'@/lib/admin-i18n':{useAdminLocale:()=>({locale})},'@/lib/kyc/queue-time':formatter};
 const exports={},js=ts.transpileModule(readFileSync('components/kyc-orders.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const context=vm.createContext({Intl:intl,Date:class extends Date{static now(){return now}},setInterval(fn,delay){timers.push({fn,delay});return timers.length},clearInterval(id){cleared.push(id)},window:{setInterval(fn,delay){timers.push({fn,delay});return timers.length},clearInterval(id){cleared.push(id)}}});
 const helper={},helperJs=ts.transpileModule(readFileSync('lib/kyc/queue-time.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInContext('(function(exports,require){'+helperJs+'\n})',context)(helper,n=>mocks[n]);mocks['@/lib/kyc/queue-time']=helper;
 vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});
 const props={orders:[{id:'synthetic-order',customer_id:'synthetic-customer',status:'submitted',revision:1,updated_at:updated,submitted_at:'2026-10-23T00:00:00Z'}],scope:[],units:[],members:[],role:'kyc',renderAssignment:()=>null};
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 const render=()=>{cursor=0;const tree=exports.KycOrders(props);effects.splice(0).forEach(fn=>fn());return nodes(tree)};
 render();return {render,props,timers,cleared,advance(ms){now+=ms;timers.forEach(t=>t.fn())},dispose(){cleanup.forEach(fn=>fn?.())}};
}
test('actual queue labels relative updated time alongside real submission and SLA in every locale',()=>{
 for(const [locale,expected,updatedLabel,missing] of [['zh','1分钟前','更新于','提交时间不可用'],['en','1 minute ago','Updated','Submission time unavailable'],['km','1 នាទីមុន','បានធ្វើបច្ចុប្បន្នភាព','មិនមានពេលដាក់ស្នើ']]){
  const h=queue(locale),nodes=h.render(),time=nodes.filter(n=>n.type==='time').at(-1);assert(time,'queue must render semantic relative time');assert.equal(time.props.children,expected);assert.equal(time.props.dateTime,'2026-10-24T00:00:00.000Z');assert.match(time.props.title,/Asia\/Phnom_Penh/);
  const full=JSON.stringify(nodes);assert(full.includes(updatedLabel));assert(!full.includes(missing));assert(full.includes('2026-10-23T00:00:00Z'));assert(!time.props.title.includes('NaN'));if(locale==='en')assert.match(time.props.title,/07:00:00/);h.dispose();
 }
});
test('missing invalid and future times never render NaN or fabricated waiting duration',()=>{
 for(const value of [undefined,null,'','bad','2026-02-30T00:00:00Z',0,'2026-10-24T00:05:00Z']){
  const h=queue('en',value);h.props.orders[0].updated_at=value;const nodes=h.render(),text=JSON.stringify(nodes);assert.doesNotMatch(text,/NaN|Invalid Date/);assert(text.includes(value==='2026-10-24T00:05:00Z'?'Update time is in the future':'Update time unavailable'));assert(text.includes('Waiting'));h.dispose();
 }
});
test('relative clock refreshes across minute/hour/day boundaries and cleans up its timer',()=>{
 const h=queue('en','2026-10-24T00:01:00Z'),time=()=>h.render().filter(n=>n.type==='time').at(-1).props.children;
 assert.equal(time(),'30 seconds ago');assert.equal(h.timers.length,1);assert.equal(h.timers[0].delay,60000);h.advance(30000);assert.equal(time(),'1 minute ago');h.advance(3540000);assert.equal(time(),'1 hour ago');h.advance(82800000);assert.equal(time(),'1 day ago');h.dispose();assert.deepEqual(h.cleared,[1]);
});
test('a browser missing Khmer Intl data still renders Khmer relative units rather than English fallback',()=>{
 const intl={DateTimeFormat:Intl.DateTimeFormat,NumberFormat:Intl.NumberFormat,RelativeTimeFormat:class extends Intl.RelativeTimeFormat{constructor(locale,options){super(locale==='km'?'en':locale,options)}}};
 const h=queue('km','2026-10-24T00:00:00Z',intl),time=()=>h.render().filter(n=>n.type==='time').at(-1).props.children;assert.equal(time(),'1 នាទីមុន');h.advance(3600000);assert.equal(time(),'1 ម៉ោងមុន');h.dispose();
});
