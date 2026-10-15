import {audit,db,staff} from '@/lib/team/server';
import {input,json} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {route} from '@/lib/http/route';

export const dynamic='force-dynamic';
const text=(value:unknown,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
const canManage=(role:string)=>['admin','ops','dept_admin'].includes(role);

export const GET=route({handler:async()=>{
 const s=await staff();if(!s||!canManage(s.member.role))throw new AuthError('当前岗位没有客户标签权限',403);
 const tags=await db().prepare('SELECT id,name,color,active,created_at,updated_at FROM team_customer_tags WHERE tenant_id=? AND active=1 ORDER BY name').bind(s.tenant.id).all();
 const links=await db().prepare(`SELECT l.tag_id,l.customer_id FROM team_customer_tag_links l WHERE l.tenant_id=? AND EXISTS (SELECT 1 FROM team_customer_tags t WHERE t.id=l.tag_id AND t.tenant_id=l.tenant_id AND t.active=1) AND EXISTS (SELECT 1 FROM team_assignments a WHERE a.tenant_id=l.tenant_id AND a.customer_id=l.customer_id)`).bind(s.tenant.id).all();
 return json({tags:tags.results,links:links.results})
}});

// S3: the write path used assertAllowedOrigin(...,false), which allowed missing
// Origin headers. route({origin:'required'}) now rejects them with 403
// CROSS_SITE_REQUEST before any business logic runs.
export const POST=route({origin:'required',handler:async(request:Request)=>{
 const s=await staff();if(!s||!canManage(s.member.role))throw new AuthError('当前岗位没有客户标签权限',403);
 const p:any=await input(request),action=text(p.action,20),now=new Date().toISOString();
 if(action==='create'){const name=text(p.name,40),color=text(p.color,20)||'#2563eb';if(!name||!/^(#[0-9a-fA-F]{6})$/.test(color))throw new AuthError('标签名称或颜色无效',400);const id='tag_'+crypto.randomUUID();await db().batch([db().prepare('INSERT INTO team_customer_tags(id,tenant_id,name,color,active,created_by,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?)').bind(id,s.tenant.id,name,color,s.user.userId,now,now),audit(s.tenant.id,s.user.userId,'customer_tag_create',{id,name,color})]);return json({ok:true,id})}
 if(action==='rename'){const id=text(p.tagId,100),name=text(p.name,40),color=text(p.color,20)||'#2563eb';if(!id||!name||!/^(#[0-9a-fA-F]{6})$/.test(color))throw new AuthError('标签资料无效',400);const old=await db().prepare('SELECT id,name,color FROM team_customer_tags WHERE id=? AND tenant_id=? AND active=1').bind(id,s.tenant.id).first<any>();if(!old)throw new AuthError('标签不存在',404);await db().batch([db().prepare('UPDATE team_customer_tags SET name=?,color=?,updated_at=? WHERE id=? AND tenant_id=? AND active=1').bind(name,color,now,id,s.tenant.id),audit(s.tenant.id,s.user.userId,'customer_tag_update',{id,before:old,after:{name,color}})]);return json({ok:true})}
 if(action==='archive'){const id=text(p.tagId,100);if(!id)throw new AuthError('标签编号无效',400);await db().batch([db().prepare('UPDATE team_customer_tags SET active=0,updated_at=? WHERE id=? AND tenant_id=? AND active=1').bind(now,id,s.tenant.id),audit(s.tenant.id,s.user.userId,'customer_tag_archive',{id})]);return json({ok:true})}
 if(action==='link'||action==='unlink'){const tagId=text(p.tagId,100),customerId=text(p.customerId,120);if(!tagId||!customerId)throw new AuthError('标签或客户无效',400);const tag=await db().prepare('SELECT id,name FROM team_customer_tags WHERE id=? AND tenant_id=? AND active=1').bind(tagId,s.tenant.id).first<any>();if(!tag)throw new AuthError('标签不存在',404);if(!await db().prepare('SELECT 1 FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(s.tenant.id,customerId).first())throw new AuthError('客户不属于当前授权范围',403);if(action==='link')await db().batch([db().prepare('INSERT OR IGNORE INTO team_customer_tag_links(tenant_id,tag_id,customer_id,created_by,created_at) VALUES (?,?,?,?,?)').bind(s.tenant.id,tagId,customerId,s.user.userId,now),audit(s.tenant.id,s.user.userId,'customer_tag_link',{tagId,customerId})]);else await db().batch([db().prepare('DELETE FROM team_customer_tag_links WHERE tenant_id=? AND tag_id=? AND customer_id=?').bind(s.tenant.id,tagId,customerId),audit(s.tenant.id,s.user.userId,'customer_tag_unlink',{tagId,customerId})]);return json({ok:true})}
 throw new AuthError('客户标签操作无效',400)
}});