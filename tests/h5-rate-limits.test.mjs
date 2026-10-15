import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {registerPhone,sendCode,randomToken,AuthError} from '../lib/h5-auth-core.ts';

function fixture(config={}){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={
  prepare(query){
   return {bind(...args){
    return {
     async first(){return sql.prepare(query).get(...args)??null},
     async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},
    };
   }};
  },
 };
 let t=1800000000000;
 return {sql,now:()=>t,advance:seconds=>{t+=seconds*1000},owner:'public',browser:randomToken(),r:{db,now:()=>t,config:{mode:'demo',secret:'synthetic-test-secret-at-least-32-characters',allowDemo:true,...config}}};
}

test('default tenant registration limit does not block 600 public registrations',async()=>{
 const f=fixture();
 for(let i=0;i<600;i++)await registerPhone(f.r,f.owner,randomToken(),{phone:'+1202'+String(5550000+i).padStart(7,'0')});
 assert.equal(f.sql.prepare("SELECT count(*) AS n FROM h5_limits WHERE key LIKE 'register-owner|%'").get().n,1);
});

test('owner multiplier applies in gray and is ignored in production',async()=>{
 const gray=fixture({environment:'gray',limitScale:2,ownerLimits:{register:1}});
 await registerPhone(gray.r,gray.owner,randomToken(),{phone:'+12025550101'});
 await registerPhone(gray.r,gray.owner,randomToken(),{phone:'+12025550102'});
 await assert.rejects(registerPhone(gray.r,gray.owner,randomToken(),{phone:'+12025550103'}),e=>e.status===429);
 const production=fixture({environment:'production',limitScale:2,ownerLimits:{register:2}});
 await registerPhone(production.r,production.owner,randomToken(),{phone:'+12025550201'});
 await registerPhone(production.r,production.owner,randomToken(),{phone:'+12025550202'});
 await registerPhone(production.r,production.owner,randomToken(),{phone:'+12025550203'});
});

test('per-phone send limit remains strict when tenant limits are raised',async()=>{
 const f=fixture({limitScale:100});
 await sendCode(f.r,f.owner,f.browser,{phone:'+12025550301',consent:true});
 await assert.rejects(sendCode(f.r,f.owner,randomToken(),{phone:'+12025550301',consent:true}),e=>e instanceof AuthError&&e.status===429);
});
