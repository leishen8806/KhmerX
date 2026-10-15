import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(fs.readFileSync('lib/customer-shards.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const env={};
const context=vm.createContext({console,Promise,JSON,Date,TextEncoder,structuredClone});
const cloudflare=new vm.SyntheticModule(['env'],function(){this.setExport('env',env)},{context,identifier:'cloudflare:workers'});
const shardModule=new vm.SourceTextModule(source,{context,identifier:'customer-shards.ts'});
const domain=new vm.SyntheticModule(['initialState'],function(){this.setExport('initialState',()=>({loans:[],bots:[],entries:[],events:[],notifications:[],requests:[],requestDigests:{}}))},{context});
const errorModule=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('lib/http/api-error.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{context});
await shardModule.link(specifier=>specifier==='cloudflare:workers'?cloudflare:specifier==='./domain'?domain:specifier==='./http/api-error'?errorModule:Promise.reject(new Error(`unexpected ${specifier}`)));
await cloudflare.evaluate();
await shardModule.evaluate();
const {customerRowsMode,shardForCustomer,writeCustomerShard}=shardModule.namespace;

function dbHarness(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE customer_workspaces(owner TEXT NOT NULL,customer_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,customer_id));CREATE TABLE loan_index(owner TEXT NOT NULL,loan_id TEXT NOT NULL,customer_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,loan_id));');
 sql.exec('CREATE TABLE demo_workspaces(owner TEXT PRIMARY KEY,revision INTEGER,payload TEXT);CREATE TABLE telegram_bot_credentials(owner TEXT,bot_id TEXT,telegram_id TEXT,label TEXT,username TEXT);CREATE TABLE team_assignments(tenant_id TEXT,customer_id TEXT,department_id TEXT,institution_id TEXT,funding_institution_id TEXT,reviewer_id TEXT,PRIMARY KEY(tenant_id,customer_id));CREATE TABLE h5_accounts(owner TEXT,customer_id TEXT,created_at TEXT);CREATE INDEX loan_index_status ON loan_index(owner,status,updated_at);');
 let batchChain=Promise.resolve();
 return {
  sql,
  prepare(query){
   return {bind(...args){
    const statement=sql.prepare(query);
    return {
     async first(){return statement.get(...args)||null},
     async all(){return {results:statement.all(...args)}},
     async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}}}
    };
   }};
  },
  async batch(statements){const run=batchChain.then(async()=>{sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}});batchChain=run.catch(()=>{});return run}
 };
}

test('mode defaults off and accepts only shadow/on',()=>{
 delete env.CUSTOMER_ROWS;assert.equal(customerRowsMode(),'off');env.CUSTOMER_ROWS='shadow';assert.equal(customerRowsMode(),'shadow');env.CUSTOMER_ROWS='on';assert.equal(customerRowsMode(),'on');env.CUSTOMER_ROWS='unexpected';assert.equal(customerRowsMode(),'off');
});

test('shard filters customer rows and related events',()=>{
 const state={loans:[{id:'a',customerId:'A'},{id:'b',customerId:'B'}],events:[{loanId:'a'},{loanId:'b'}],entries:[{loanId:'a'},{loanId:'b'}],notifications:[{loanId:'a'},{loanId:'b'}],requests:['r'],requestDigests:{r:'x'},bots:[],activeBotId:undefined,postloan:undefined};
 const shard=shardForCustomer(state,'A');assert.deepEqual(Array.from(shard.loans).map(x=>x.id),['a']);assert.deepEqual(Array.from(shard.events).map(x=>x.loanId),['a']);assert.deepEqual(Array.from(shard.entries).map(x=>x.loanId),['a']);assert.deepEqual(Array.from(shard.notifications).map(x=>x.loanId),['a']);assert.equal(shard.requests.length,0);
});

test('600 distinct customers write isolated shards and loan indexes',async()=>{
 const db=dbHarness();
 await Promise.all(Array.from({length:600},(_,i)=>{const id=`customer-${i}`;const loan={id:`loan-${i}`,customerId:id,status:'registered',createdAt:new Date(0).toISOString()};const state={loans:[loan],events:[],entries:[],notifications:[],requests:[`request-${i}`],requestDigests:{[`request-${i}`]:'digest'},bots:[],activeBotId:undefined,postloan:undefined};return writeCustomerShard(db,'owner',id,state,0,`request-${i}`)}));
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM customer_workspaces').get().n,600);assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM loan_index').get().n,600);assert.equal(JSON.parse(db.sql.prepare('SELECT payload FROM customer_workspaces WHERE customer_id=?').get('customer-42').payload).loans[0].id,'loan-42');
});

test('5000 customer pages are bounded, scoped, ordered and exclude frozen legacy state',async()=>{
 const db=dbHarness(),{readStaffPage,staffLoanState}=shardModule.namespace;
 const blank={loans:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{},bots:[]};
 db.sql.prepare('INSERT INTO demo_workspaces VALUES(?,?,?)').run('owner',9,JSON.stringify({...blank,loans:[{id:'stale-secret'}]}));
 const customer=db.sql.prepare('INSERT INTO customer_workspaces VALUES(?,?,?,?,?)'),index=db.sql.prepare('INSERT INTO loan_index VALUES(?,?,?,?,?,?)'),assignment=db.sql.prepare('INSERT INTO team_assignments VALUES(?,?,?,?,?,?)'),account=db.sql.prepare('INSERT INTO h5_accounts VALUES(?,?,?)');
 db.sql.exec('BEGIN');for(let i=0;i<5000;i++){const id=`customer-${i}`,at=new Date(i*1000).toISOString(),loan={id:`loan-${i}`,customerId:id,status:i%2?'active':'signed',createdAt:at};customer.run('owner',id,0,JSON.stringify({...blank,loans:[loan],events:Array.from({length:i===4999?250:1},(_,n)=>({loanId:loan.id,at:new Date(n*1000).toISOString()}))}),at);index.run('owner',loan.id,id,loan.status,at,at);assignment.run('owner',id,i%2?'D1':'D2','I1','I2','reviewer');account.run('owner',id,at)}db.sql.exec('COMMIT');
 const member={tenant_id:'owner',active:1,role:'admin',unit_id:null,id:'reviewer'},timings=[];let first;
 for(let i=0;i<20;i++){const start=performance.now();first=await readStaffPage(db,member);timings.push(performance.now()-start)}
 const p95=timings.sort((a,b)=>a-b)[18];console.log(`Q7 local SQLite: 5000 customers, first-page p95=${p95.toFixed(2)}ms`);assert(p95<500);
 assert.equal(first.pagination.total,5000);assert.equal(first.state.loans.length,50);assert.equal(first.state.loans[0].id,'loan-4999');assert.equal(first.state.events.length,200);assert.equal(first.customerIds.length,50);
 const second=await readStaffPage(db,member,{page:2,pageSize:50});assert(!second.state.loans.some(x=>first.state.loans.some(y=>x.id===y.id)));
 assert.equal((await readStaffPage(db,member,{pageSize:9999})).state.loans.length,200);
 const restricted=await readStaffPage(db,{...member,role:'kyc',unit_id:'D1'},{status:'active'});assert.equal(restricted.pagination.total,2500);assert(restricted.state.loans.every(x=>Number(x.id.split('-')[1])%2===1));
 assert.equal((await readStaffPage(db,{...member,tenant_id:'foreign'})).pagination.total,0);assert.equal((await readStaffPage(db,{...member,active:0})).pagination.total,0);
 const single=await staffLoanState(db,'owner','loan-42');assert.equal(single.customerId,'customer-42');assert.equal(single.state.loans.length,1);assert.equal(single.tenantRevision,9);
 await assert.rejects(staffLoanState(db,'foreign','loan-42'),e=>e.status===404);
});

test('funding writes serialize tenant capacity and do not update index after stale CAS',async()=>{
 const db=dbHarness(),{staffStateWrite,staffPayload,loanIndexUpdate,tenantFundingEntries}=shardModule.namespace;
 db.sql.prepare('INSERT INTO demo_workspaces VALUES(?,?,?)').run('owner',0,'{}');
 const now=new Date().toISOString(),loans=['A','B'].map(id=>({id,customerId:id,status:'signed',createdAt:now}));
 for(const loan of loans)await writeCustomerShard(db,'owner',loan.id,{loans:[loan],events:[],entries:[],notifications:[],requests:[],bots:[]},0);
 const next=loan=>({loans:[{...loan,status:'active'}],events:[],entries:[{loanId:loan.id,kind:'\u6d4b\u8bd5\u653e\u6b3e',cents:700,at:now}],notifications:[],requests:['write-id'],requestDigests:{'write-id':'digest'}});
 const write=async loan=>{const state=next(loan);return db.batch([staffStateWrite(db,'owner',1,state,loan.id,'EXISTS (SELECT 1 FROM demo_workspaces WHERE owner=? AND revision=?)',['owner',0]),db.prepare('UPDATE demo_workspaces SET revision=revision+1 WHERE owner=? AND changes()=1').bind('owner'),loanIndexUpdate(db,'owner',loan.id,state.loans[0],2,staffPayload(state,loan.id))])};
 const [a,b]=await Promise.all(loans.map(write));assert.equal(a[0].meta.changes,1);assert.equal(b[0].meta.changes,0);assert.equal(db.sql.prepare('SELECT status FROM loan_index WHERE loan_id=?').get('B').status,'signed');
 assert.equal((await tenantFundingEntries(db,'owner')).reduce((n,x)=>n+x.cents,0),700);assert.equal((await tenantFundingEntries(db,'foreign')).length,0);
});
