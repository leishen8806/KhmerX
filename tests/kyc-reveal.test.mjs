import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {changesFixture} from './helpers/kyc-sensitive-fixture.mjs';
export async function revealFixture(t){
 assert(existsSync('app/api/kyc/review/reveal/route.ts'),'reveal route exists');const f=await changesFixture();t.after(()=>f.close());
 let row=await f.kyc.initialize(f.A,'reveal',false),data=await f.kyc.payload(row);data.profile.values={documentNumber:'DOC123456789',bankAccount:'BANK987654321',surname:'OLD'};row=await f.kyc.transition(row,'submitted',data,'submit','customer');
 const route=await f.mod('@/app/api/kyc/review/reveal/route');
 const post=async(p={},origin='http://localhost')=>{const r=await route.POST(new Request('http://localhost/api/kyc/review/reveal',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),'x-request-id':'12345678-1234-4123-8123-123456789abc'},body:JSON.stringify({id:row.id,revision:row.revision,field:'documentNumber',...p})}));return {r,body:await r.json()};};
 return {...f,row,data,post,count:()=>f.sql.prepare("SELECT count(*) AS n FROM team_audit WHERE action='kyc_sensitive_reveal'").get().n};
}
test('reveal validates field/id/revision and origin, before returning any values',async t=>{
 const f=await revealFixture(t);
 for(const p of [{field:'surname'},{field:'__proto__'},{id:''},{id:{}},{revision:-1},{revision:1.2}]){const result=await f.post(p);assert.equal(result.r.status,400);assert.equal(result.body.value,undefined);}
 for(const origin of ['', 'https://foreign.test'])assert.equal((await f.post({},origin)).r.status,403);
 assert.equal((await f.post({revision:0})).r.status,409);assert.equal(f.count(),0);
 f.select(f.B);assert.equal((await f.post()).r.status,404);f.select('');assert.equal((await f.post()).r.status,403);
});
test('reveal denies audit and unassigned roles; rechecks permissions even within dedup window',async t=>{
 const f=await revealFixture(t);assert.equal((await f.post()).r.status,200);
 for(const role of ['audit','kyc','dept_admin','ops']){const id='member-'+role;f.sql.prepare('INSERT INTO team_members(id,tenant_id,user_id,email,role,active,version) VALUES(?,?,?,?,?,1,0)').run(id,f.A,id,id+'@example.test',role);f.setUser({userId:id,email:id+'@example.test'});assert.equal((await f.post()).r.status,403);}
 f.setUser({userId:'owner',email:'owner@example.test'});f.sql.prepare("UPDATE team_members SET role='audit' WHERE tenant_id=? AND user_id='owner'").run(f.A);assert.equal((await f.post()).r.status,403);assert.equal(f.count(),1);
});
test('reveal awaits metadata-only audit, deduplicates concurrent success and does not cache failure or clear values',async t=>{
 const f=await revealFixture(t),prepare=f.DB.prepare;let release;const gate=new Promise(r=>release=r);let writes=0;
 f.DB.prepare=q=>{const s=prepare(q);return q.startsWith('INSERT INTO team_audit')?{bind(...args){const b=s.bind(...args);return {...b,async run(){writes++;await gate;return b.run();}};}}:s;};
 let settled=false;const first=f.post().then(r=>{settled=true;return r;}),second=f.post();await new Promise(r=>setTimeout(r,25));assert.equal(settled,false);release();
 const results=await Promise.all([first,second]);for(const {r,body} of results){assert.equal(r.status,200);assert.equal(body.value,'DOC123456789');assert.equal(body.field,'documentNumber');assert.equal(typeof body.revealToken,'string');assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal(writes,1);assert.equal(f.count(),1);f.DB.prepare=prepare;
 const event=f.sql.prepare("SELECT * FROM team_audit WHERE action='kyc_sensitive_reveal'").get();assert.equal(event.actor,'owner');assert.equal(event.tenant_id,f.A);assert.deepEqual(JSON.parse(event.detail),{caseId:f.row.id,revision:f.row.revision,field:'documentNumber',requestId:'12345678-1234-4123-8123-123456789abc'});
 await f.post();assert.equal(f.count(),1);
 f.DB.prepare=q=>{const s=prepare(q);return q.startsWith('INSERT INTO team_audit')?{bind(...args){args[1]='missing';return s.bind(...args);}}:s;};
 const failed=await f.post({field:'bankAccount'});assert.equal(failed.r.status,500);assert.equal(failed.body.value,undefined);assert.equal(failed.body.revealToken,undefined);
 f.DB.prepare=prepare;assert.equal((await f.post({field:'bankAccount'})).body.value,'BANK987654321');assert.equal(f.count(),2);
});
test('dedup expires at 30 seconds and is separated by actor and revision',async t=>{
 const f=await revealFixture(t);assert.equal((await f.post()).r.status,200);const clock=Date.now;
 try{Date.now=()=>clock()+30001;assert.equal((await f.post()).r.status,200);}finally{Date.now=clock;}assert.equal(f.count(),2);
 f.sql.prepare("INSERT INTO team_members(id,tenant_id,user_id,email,role,active,version) VALUES('other-admin',?,'other-admin','other@example.test','admin',1,0)").run(f.A);f.setUser({userId:'other-admin',email:'other@example.test'});assert.equal((await f.post()).r.status,200);assert.equal(f.count(),3);
 const next=await f.kyc.transition(f.row,'submitted',f.data,'save','customer');assert.equal((await f.post({revision:next.revision})).r.status,200);assert.equal(f.count(),4);
});
