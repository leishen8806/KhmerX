type QueueCase={id:string;status:string;submitted_at?:string|null};
export type NextReview={state:'idle'|'loading'|'ready'|'empty'|'failed';nextId?:string};
export function selectNext<T extends QueueCase>(cases:T[],currentId:string):T|null{
 const pending=cases.filter(c=>c.status==='submitted'&&c.id!==currentId);
 if(pending.every(c=>c.submitted_at&&Number.isFinite(Date.parse(c.submitted_at))))pending.sort((a,b)=>Date.parse(a.submitted_at!)-Date.parse(b.submitted_at!));
 return pending[0]||null;
}
type Preference=Pick<Storage,'getItem'|'setItem'>;
const key='kyc-review-auto-next';
export function readAutoNext(storage:Preference){try{return storage.getItem(key)==='true'}catch{return false}}
export function writeAutoNext(storage:Preference,value:boolean){try{storage.setItem(key,String(value));return value}catch{return false}}
export async function reviewAndNext<T>(post:()=>Promise<T>,accepted:(record:T)=>void,queue:()=>Promise<QueueCase[]>,currentId:string):Promise<NextReview>{
 const record=await post();accepted(record);
 return fetchNext(queue,currentId);
}
export async function fetchNext(queue:()=>Promise<QueueCase[]>,currentId:string):Promise<NextReview>{
 try{const next=selectNext(await queue(),currentId);return next?{state:'ready',nextId:next.id}:{state:'empty'}}catch{return {state:'failed'}}
}
