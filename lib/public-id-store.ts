import {publicIdentifier,type PublicChannel,type PublicEntity} from './public-id.ts';

type Statement={bind(...args:unknown[]):{first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<{meta:{changes:number}}>}};
type PublicIdDB={prepare(sql:string):Statement};

export function channelForAccount(mode:unknown,channelId?:unknown):PublicChannel{
 if(mode==='telegram')return 'TG';
 if(mode==='demo')return 'H5';
 if(typeof channelId==='string'&&channelId.startsWith('api'))return 'IN';
 return 'SY';
}

export async function claimPublicIdentifier(db:PublicIdDB,entity:PublicEntity,channel:PublicChannel,internalId:string,tenantId?:string,createdAt=new Date().toISOString()):Promise<string>{
 const existing=await db.prepare('SELECT ref FROM public_identifiers WHERE entity_type=? AND internal_id=?').bind(entity,internalId).first<{ref:string}>();
 if(existing?.ref)return existing.ref;
 for(let attempt=0;attempt<6;attempt++){
  const ref=publicIdentifier(entity,channel,new Date(createdAt));
  try{
   const inserted=await db.prepare('INSERT INTO public_identifiers (ref,entity_type,internal_id,tenant_id,source_channel,created_at) VALUES (?,?,?,?,?,?)').bind(ref,entity,internalId,tenantId||null,channel,createdAt).run();
   if(inserted.meta.changes===1)return ref;
  }catch(error){
   const again=await db.prepare('SELECT ref FROM public_identifiers WHERE entity_type=? AND internal_id=?').bind(entity,internalId).first<{ref:string}>();
   if(again?.ref)return again.ref;
   if(attempt===5)throw error;
  }
 }
 throw new Error('公共编号生成失败，请稍后重试');
}

export async function attachCustomerRef(db:PublicIdDB,owner:string,customerId:string,mode:unknown,channelId?:unknown,createdAt=new Date().toISOString()){
 const ref=await claimPublicIdentifier(db,'C',channelForAccount(mode,channelId),customerId,owner,createdAt);
 await db.prepare('UPDATE h5_accounts SET customer_ref=?,source_channel=COALESCE(source_channel,?) WHERE owner=? AND customer_id=? AND (customer_ref IS NULL OR customer_ref<>?)').bind(ref,channelForAccount(mode,channelId),owner,customerId,ref).run();
 return ref;
}
