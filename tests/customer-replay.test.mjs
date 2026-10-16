import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {plan,prepare} from '../scripts/loadtest/fixture/core.mjs';
import {runtime} from '../scripts/loadtest/fixture/test-runtime.mjs';
async function setup(mode){
 const root=mkdtempSync(join(tmpdir(),'khmerx-replay-'));mkdirSync(join(root,'.wrangler/state'),{recursive:true});
 const database=join(root,'.wrangler/state/test.sqlite'),db=new DatabaseSync(database);db.exec('PRAGMA foreign_keys=ON');
 for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(join('drizzle',name),'utf8'));
 const bindings={PAYEASE_ENV:'local',KHMERX_TEST_MODE:'true',PAYEASE_AUTH_MODE:'demo',CUSTOMER_ROWS:mode,KYC_DATA_SECRET:'synthetic-replay-fixture-secret-only'};
 const o={root,database,config:{host:'localhost',bindings},profile:'local-harness',baseUrl:'http://127.0.0.1:8796',runId:'synthetic-replay-'+mode,dataset:'main',count:2};
 const manifest=prepare({...o,apply:true,confirm:plan(o).fingerprint}).manifest,rt=await runtime(db,bindings);
 return {db,manifest,rt,close(){db.close();assert(root.startsWith(join(tmpdir(),'khmerx-replay-')));rmSync(root,{recursive:true,force:true})}};
}
for(const mode of ['off','on','shadow'])test(`customer confirm_bill replay preserves state/revision and payload binding (${mode})`,async()=>{
 const f=await setup(mode);try{
  const owner=f.manifest.target.tenantId,clients=f.manifest.customers.map(c=>({id:c.customerId,phoneMasked:'synthetic',channel:'H5'}));
  const bills=[];
  for(const [i,c]of clients.entries()){
   const created=await f.rt.store.mutate(owner,{action:'create',role:'mini',amount:5000,name:'SYNTH',consent:true,termDays:14,requestId:`synthetic-create-${i}`},c),loan=created.state.loans.find(l=>l.customerId===c.id);
   const bill={action:'confirm_bill',role:'mini',loanId:loan.id,billConfirmed:true,quoteId:loan.billing.quoteId,requestId:`synthetic-bill-${i}`};await f.rt.store.mutate(owner,bill,c);bills.push(bill);
  }
  const before=await f.rt.store.readState(owner,clients[0].id),replay=await f.rt.store.mutate(owner,bills[0],clients[0]),after=await f.rt.store.readState(owner,clients[0].id);
  assert.equal(replay.revision,before.revision);assert.equal(after.revision,before.revision);assert.equal(JSON.stringify(after.state),JSON.stringify(before.state));
  await assert.rejects(f.rt.store.mutate(owner,{...bills[0],billConfirmed:false},clients[0]),/请求编号已绑定其他操作/);
  await assert.rejects(f.rt.store.mutate(owner,bills[0],clients[1]),/不属于当前客户/);
  await assert.rejects(f.rt.store.mutate(owner,{action:'create',amount:5000,consent:true,requestId:'synthetic-create-0'},clients[0]),/请先完成当前申请/);
  assert.equal((await f.rt.store.readState(owner,clients[0].id)).revision,before.revision);
  if(mode!=='off'){
   for(let i=0;i<100;i++){if(f.db.prepare('SELECT COUNT(*) n FROM customer_workspaces WHERE revision=2').get().n===2)break;await new Promise(r=>setTimeout(r,10))}
   for(const [i,c]of clients.entries()){
    const shard=JSON.parse(f.db.prepare('SELECT payload FROM customer_workspaces WHERE owner=? AND customer_id=?').get(owner,c.id).payload),key=c.id.slice(0,16)+':'+bills[i].requestId;
    assert(shard.requests.includes(key));assert.equal(shard.requests.length,2);assert.equal(Object.keys(shard.requestDigests).length,2);assert(!shard.requests.some(k=>k.endsWith('synthetic-bill-'+(1-i))));
   }
  }
 }finally{f.close()}
});
test('shard idempotency history evicts request IDs and digests together at 500',async()=>{
 const f=await setup('on');try{
  const rows=await f.rt.load('@/lib/customer-shards'),{env}=await f.rt.load('cloudflare:workers'),owner=f.manifest.target.tenantId,c=f.manifest.customers[0];
  for(let i=0;i<502;i++){const key='synthetic-key-'+i;assert(await rows.writeCustomerShard(env.DB,owner,c.customerId,{loans:[],events:[],entries:[],notifications:[],requests:[key],requestDigests:{[key]:'synthetic-digest-'+i}},i,key))}
  const p=JSON.parse(f.db.prepare('SELECT payload FROM customer_workspaces WHERE customer_id=?').get(c.customerId).payload);
  assert.equal(p.requests.length,500);assert.equal(Object.keys(p.requestDigests).length,500);assert.equal(p.requests[0],'synthetic-key-2');assert.equal(p.requestDigests['synthetic-key-0'],undefined);assert.equal(p.requestDigests['synthetic-key-501'],'synthetic-digest-501');
 }finally{f.close()}
});
