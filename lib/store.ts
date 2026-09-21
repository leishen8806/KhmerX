import {env} from 'cloudflare:workers';
import {initialState,applyAction,type State} from './domain';
import {customerAction} from './domain';
function db(){if(!env.DB)throw Error('测试数据库暂不可用');return env.DB}
export async function readState(owner:string):Promise<{state:State;revision:number}>{
 const row=await db().prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(owner).first<{revision:number;payload:string}>();
 return row?{state:JSON.parse(row.payload),revision:row.revision}:{state:initialState(),revision:0};
}
export async function mutate(owner:string,p:any,customer?:{id:string;phoneMasked:string}){
 await db().prepare('INSERT OR IGNORE INTO demo_workspaces (owner,revision,payload) VALUES (?,0,?)').bind(owner,JSON.stringify(initialState())).run();
 for(let i=0;i<4;i++){
  const {state,revision}=await readState(owner);const next=customer?customerAction(state,p,customer):applyAction(state,p);
  if(next===state)return {state,revision};
  const result=await db().prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(next),owner,revision).run();
  if(result.meta.changes===1)return {state:next,revision:revision+1};
 }
 throw Error('其他操作刚刚更新了记录，请重试');
}
