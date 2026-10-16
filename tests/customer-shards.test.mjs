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
await shardModule.link(specifier=>specifier==='cloudflare:workers'?cloudflare:Promise.reject(new Error(`unexpected ${specifier}`)));
await cloudflare.evaluate();
await shardModule.evaluate();
const {customerRowsMode,shardForCustomer,writeCustomerShard}=shardModule.namespace;

function dbHarness(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE customer_workspaces(owner TEXT NOT NULL,customer_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,customer_id));CREATE TABLE loan_index(owner TEXT NOT NULL,loan_id TEXT NOT NULL,customer_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,loan_id));');
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

test('failed shard index update rolls back the first customer row insert',async()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE customer_workspaces(owner TEXT NOT NULL,customer_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,customer_id));CREATE TABLE loan_index(owner TEXT NOT NULL,loan_id TEXT NOT NULL,customer_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(owner,loan_id));');
 const db={
  prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}}}}}}},
  async batch(statements){sql.exec('BEGIN');try{const result=[];for(const statement of statements){result.push(await statement.run());if(result.length===2)throw new Error('synthetic index failure')}sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}
 };
 const state={loans:[{id:'loan-a',customerId:'A',status:'registered',createdAt:new Date(0).toISOString()}],events:[],entries:[],notifications:[],requests:[],requestDigests:{},bots:[]};
 await assert.rejects(()=>writeCustomerShard(db,'owner','A',state,0),/synthetic index failure/);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM customer_workspaces').get().n,0);
});

test('customer loan removal deletes the stale loan index row',async()=>{
 const db=dbHarness();
 const base={events:[],entries:[],notifications:[],requests:[],requestDigests:{},bots:[]};
 await writeCustomerShard(db,'owner','A',{...base,loans:[{id:'loan-a',customerId:'A',status:'registered',createdAt:new Date(0).toISOString()}]},0);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM loan_index WHERE owner=? AND customer_id=?').get('owner','A').n,1);
 await writeCustomerShard(db,'owner','A',{...base,loans:[]},1);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM loan_index WHERE owner=? AND customer_id=?').get('owner','A').n,0);
});

test('customer shard writes remove orphaned request digests',async()=>{
 const db=dbHarness();
 const base={loans:[],events:[],entries:[],notifications:[],bots:[]};
 await writeCustomerShard(db,'owner','A',{...base,requests:['live'],requestDigests:{live:'ok'}},0,'live');
 const seeded=JSON.parse(db.sql.prepare('SELECT payload FROM customer_workspaces WHERE owner=? AND customer_id=?').get('owner','A').payload);
 seeded.requestDigests.orphan='sensitive';
 db.sql.prepare('UPDATE customer_workspaces SET payload=? WHERE owner=? AND customer_id=?').run(JSON.stringify(seeded),'owner','A');
 await writeCustomerShard(db,'owner','A',{...base,requests:['live'],requestDigests:{live:'ok'}},1);
 const saved=JSON.parse(db.sql.prepare('SELECT payload FROM customer_workspaces WHERE owner=? AND customer_id=?').get('owner','A').payload);
 assert.deepEqual(saved.requestDigests,{live:'ok'});
});
