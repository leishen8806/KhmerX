import { mkdirSync, writeFileSync } from 'node:fs';
import { openDevDb } from '../dev-app-backend/common.mjs';

export const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function args(argv=process.argv.slice(2)){
  const out={};
  for(let i=0;i<argv.length;i++){const [key,value]=argv[i].split('=',2);if(key.startsWith('--'))out[key.slice(2)]=value??argv[++i]??true;}
  return out;
}
export function db(){return openDevDb()}
export function workspaces(database,tenant){
  const sql=tenant?'SELECT owner,revision,payload FROM demo_workspaces WHERE owner=?':'SELECT owner,revision,payload FROM demo_workspaces';
  return (tenant?database.prepare(sql).all(tenant):database.prepare(sql).all());
}
export function shard(state,customerId){
  const loans=state.loans.filter(x=>x.customerId===customerId),ids=new Set(loans.map(x=>x.id));
  const byCustomer={loans,events:state.events.filter(x=>ids.has(x.loanId)),entries:state.entries.filter(x=>ids.has(x.loanId)),notifications:state.notifications.filter(x=>ids.has(x.loanId)),requests:[],requestDigests:{}};
  for(const id of state.requests||[]){const digest=state.requestDigests?.[id];let loanId;try{loanId=JSON.parse(digest||'{}').loanId}catch{};if(loanId&&ids.has(loanId)){byCustomer.requests.push(id);byCustomer.requestDigests[id]=digest}}
  return byCustomer;
}
export function ref(entity,channel='H5',date=new Date()){
  const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=t=>d.find(x=>x.type===t)?.value||'';let out='';while(out.length<7)out+=ALPHABET[Math.floor(Math.random()*ALPHABET.length)];
  return `${entity}${channel}${part('year').slice(-2)}${part('month')}${part('day')}${out}`;
}
export function ensureReport(path,value){mkdirSync(path.split(/[\\/]/).slice(0,-1).join('/')||'.',{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n')}
export function parsePayload(row){try{return JSON.parse(row.payload)}catch{throw new Error(`invalid JSON payload for ${row.owner}`)}}
