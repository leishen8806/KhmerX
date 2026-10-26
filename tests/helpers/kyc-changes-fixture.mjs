// Real services and migrations; only Cloudflare bindings, cookies and SSO identity are local.
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
export async function changesFixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const DB={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}}}}},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sql.exec('COMMIT');return out}catch(error){sql.exec('ROLLBACK');throw error}}};
 const env={DB,KYC_DATA_SECRET:'synthetic-changes-only-'.repeat(5),KYC_REVIEWER_EMAILS:'owner@example.test',PAYEASE_AUTH_SECRET:'synthetic-changes-auth-'.repeat(5),PAYEASE_AUTH_MODE:'demo',KHMERX_TEST_MODE:'true'};
 let user={userId:'owner',email:'owner@example.test'},selected='';const logs=[],root=path.resolve('.'),cache=new Map();
 const context=vm.createContext({console:{...console,error:(...args)=>logs.push(args.join(' '))},crypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,URLSearchParams,AbortSignal,Uint8Array,ArrayBuffer,Buffer,Date,structuredClone,atob,btoa,setTimeout,clearTimeout});
 function synth(id,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value)},{context,identifier:id});cache.set(id,m);return m;}
 synth('cloudflare:workers',{env});synth('next/headers',{headers:async()=>new Headers({cookie:selected?'payease_company='+selected:''})});synth(path.join(root,'app/chatgpt-auth.ts'),{getChatGPTUser:async()=>user});
 function getModule(spec,base=root+'/entry.ts'){
  let id=spec;if(spec.startsWith('@/'))id=path.join(root,spec.slice(2));else if(spec.startsWith('.'))id=path.resolve(path.dirname(base),spec);
  if(!cache.has(id)&&!path.extname(id)&&fs.existsSync(id+'.ts'))id+='.ts';if(cache.has(id))return cache.get(id);
  if(id.endsWith('.json'))return synth(id,{default:JSON.parse(fs.readFileSync(id,'utf8'))});
  const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const m=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,m);return m;
 }
 async function mod(name){const m=getModule(name);if(m.status==='unlinked')await m.link((s,p)=>getModule(s,p.identifier));if(m.status==='linked')await m.evaluate();return m.namespace;}
 const team=await mod('@/lib/team/server'),kyc=await mod('@/lib/kyc/server'),core=await mod('@/lib/kyc/core');
 const A=(await team.manage({action:'create_company',name:'Synthetic A',slug:'changes-a',en:true,km:true,zh:true})).companyId;
 const B=(await team.manage({action:'create_company',name:'Synthetic B',slug:'changes-b'})).companyId;
 selected=A;
 return {sql,DB,team,kyc,core,A,B,mod,logs,setUser(value){user=value;},select(value){selected=value;},close(){sql.close();}};
}
