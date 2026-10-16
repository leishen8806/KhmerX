// Test adapter: real source and SQLite; only platform bindings are synthetic.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
export async function runtime(sql,bindings){
 let batchChain=Promise.resolve();
 const DB={prepare(query){return {bind(...args){const s=sql.prepare(query);return {async first(){return s.get(...args)||null},async all(){return {results:s.all(...args)}},async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}}}}}}},async batch(statements){const p=batchChain.then(async()=>{sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}});batchChain=p.catch(()=>{});return p}};
 const root=path.resolve('.'),context=vm.createContext({console,crypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,URLSearchParams,AbortSignal,Uint8Array,ArrayBuffer,Buffer,Date,structuredClone,atob,btoa,setTimeout,clearTimeout}),cache=new Map();let selected='';
 function synth(id,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v)},{context,identifier:id});cache.set(id,m);return m}
 synth('cloudflare:workers',{env:{...bindings,DB}});synth('next/headers',{headers:async()=>new Headers({cookie:'payease_company='+selected})});synth(path.join(root,'app/chatgpt-auth.ts'),{getChatGPTUser:async()=>({userId:'synthetic-fixture-runner',email:'synthetic@example.test'})});
 function module(spec,base=root+'/entry.ts'){
  let id=spec;if(spec.startsWith('@/'))id=path.join(root,spec.slice(2));else if(spec.startsWith('.'))id=path.resolve(path.dirname(base),spec);
  if(!cache.has(id)&&!path.extname(id)&&fs.existsSync(id+'.ts'))id+='.ts';if(cache.has(id))return cache.get(id);
  if(id.endsWith('.json'))return synth(id,{default:JSON.parse(fs.readFileSync(id,'utf8'))});
  const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const m=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,m);return m;
 }
 const m=module('@/lib/store');await m.link((s,p)=>module(s,p.identifier));await m.evaluate();
 async function load(name){const x=module(name);if(x.status==='unlinked')await x.link((s,p)=>module(s,p.identifier));if(x.status==='linked')await x.evaluate();return x.namespace}
 return {store:m.namespace,load,select(owner){selected=owner}};
}
