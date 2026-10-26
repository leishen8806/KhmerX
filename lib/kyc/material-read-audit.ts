type MaterialReadAuditDetail={caseId:string;revision:number;slot:string;fileId:string;action:string;requestId:string};
type AuditDb={prepare:(sql:string)=>{bind:(...args:unknown[])=>{run:()=>Promise<{meta?:{changes?:number}}>}}};

const DETAIL_KEYS=['caseId','revision','slot','fileId','action','requestId'] as const;
function detailJson(detail:MaterialReadAuditDetail){
 if(!detail||Object.keys(detail).length!==DETAIL_KEYS.length||DETAIL_KEYS.some(key=>!Object.hasOwn(detail,key)))throw new TypeError('material read audit detail must contain exactly six keys');
 if(typeof detail.caseId!=='string'||!Number.isInteger(detail.revision)||typeof detail.slot!=='string'||typeof detail.fileId!=='string'||typeof detail.action!=='string'||typeof detail.requestId!=='string')throw new TypeError('material read audit detail has invalid types');
 return JSON.stringify({caseId:detail.caseId,revision:detail.revision,slot:detail.slot,fileId:detail.fileId,action:detail.action,requestId:detail.requestId});
}
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}

/** Append a redacted material-read audit event; callers decide when the file request may proceed. */
export async function recordMaterialReadAudit(db:AuditDb,tenantId:string,actor:string,detail:MaterialReadAuditDetail,at=new Date()){
 const json=detailJson(detail),bucket=Math.floor(at.getTime()/30_000)*30_000,createdAt=at.toISOString();
 const id=await sha256(JSON.stringify({tenantId,actor,bucket,detail:json}));
 const result=await db.prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,tenantId,actor,'material_read',json,createdAt).run();
 return {id,createdAt,bucket,inserted:Number(result.meta?.changes||0)===1};
}
