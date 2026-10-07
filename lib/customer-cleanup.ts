import {db,platformAdmin} from '@/lib/team/server';
import {runtime} from '@/lib/h5-auth';
import {AuthError,keyed,normalizePhone} from '@/lib/h5-auth-core';

// Restricted to disposable, unapproved demo registrations. Financial records cannot be purged here.
export async function customerCleanup(p:any){
 const operator=await platformAdmin();
 const r=runtime();if(r.config.mode!=='demo'||r.config.secret.length<32)throw new AuthError('仅测试模式允许清理注册',403);
 const phone=normalizePhone(p.phone,'telegram');
 const candidates=(await db().prepare('SELECT customer_id,owner,mode,credential_version FROM h5_accounts WHERE phone_mask=?').bind(phone.slice(0,4)+' •••• '+phone.slice(-4)).all<any>()).results;
 const plans:any[]=[];
 for(const account of candidates){
  if(account.customer_id!==await keyed(r.config.secret,'customer|'+account.mode+'|'+account.owner+'|'+phone))continue;
  if(account.mode!=='demo')throw new AuthError('存在真实验证账号，不可通过测试清理操作删除',409);
  const owner=account.owner,id=account.customer_id;
  const cases=(await db().prepare('SELECT id,revision,status FROM kyc_cases WHERE owner=? AND customer_id=? ORDER BY id').bind(owner,id).all<any>()).results;
  const files=await db().prepare('SELECT COUNT(*) AS n FROM kyc_files WHERE owner=? AND customer_id=?').bind(owner,id).first<any>();
  const contracts=await db().prepare('SELECT COUNT(*) AS n FROM kyc_contracts WHERE owner=? AND customer_id=?').bind(owner,id).first<any>();
  const work=await db().prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(owner).first<any>();
  const state=work?JSON.parse(work.payload):null,loans=state?.loans.filter((l:any)=>l.customerId===id)||[];
  const loanIds=loans.map((l:any)=>l.id);
  if(contracts.n||cases.some((k:any)=>k.status!=='draft')||files.n||loans.some((l:any)=>!['registered','kyc_pending','needs_info'].includes(l.status)||l.contract||l.approvalActor)||state?.entries.some((e:any)=>loanIds.includes(e.loanId)))throw new AuthError('存在已提交审核、文件、合同或资金记录，需要专门核对后清理',409);
  const company=await db().prepare('SELECT name FROM team_companies WHERE id=?').bind(owner).first<any>();
  plans.push({account,cases,work,state,loans,loanIds,name:company?.name||'早期演示工作区'});
 }
 const version=await keyed(r.config.secret,JSON.stringify(plans.map(x=>({account:x.account,cases:x.cases,work:x.work?.revision}))));
 const summary=plans.map(x=>({workspace:x.name,registrations:1,kycDrafts:x.cases.length,unsubmittedLoans:x.loans.length}));
 if(p.action==='preview')return {version,records:summary};
 if(p.action!=='clear'||p.confirm!==true||p.version!==version)throw new AuthError('请重新核对清理预览',409);
 if(!plans.length)return {ok:true,cleared:0};
 const statements=[];
 for(const x of plans){
  const {owner,customer_id:id}=x.account;
  // Each assertion and deletion is in the same D1 transaction; changed records roll back all targets.
  statements.push(db().prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM h5_accounts WHERE owner=? AND customer_id=? AND credential_version=?) THEN 1 ELSE json('stale account') END").bind(owner,id,x.account.credential_version));
  statements.push(db().prepare("SELECT CASE WHEN (SELECT COUNT(*) FROM kyc_files WHERE owner=? AND customer_id=?)=0 AND (SELECT COUNT(*) FROM kyc_cases WHERE owner=? AND customer_id=?)=? THEN 1 ELSE json('changed KYC') END").bind(owner,id,owner,id,x.cases.length));
  for(const k of x.cases)statements.push(db().prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM kyc_cases WHERE id=? AND revision=? AND status='draft') THEN 1 ELSE json('changed KYC') END").bind(k.id,k.revision));
  statements.push(db().prepare("SELECT CASE WHEN COALESCE((SELECT revision FROM demo_workspaces WHERE owner=?),-1)=? THEN 1 ELSE json('changed loans') END").bind(owner,x.work?.revision??-1));
  statements.push(db().prepare("INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM team_companies WHERE id=? AND active=1)").bind(crypto.randomUUID(),owner,operator.email,'customer_cleanup',JSON.stringify({customerId:id,kycDrafts:x.cases.length,unsubmittedLoans:x.loans.length,files:0,mode:'demo'}),new Date().toISOString(),owner));
  statements.push(db().prepare('DELETE FROM h5_sessions WHERE owner=? AND customer_id=?').bind(owner,id));
  statements.push(db().prepare('DELETE FROM h5_challenges WHERE owner=? AND phone_key=?').bind(owner,id));
  statements.push(db().prepare('DELETE FROM telegram_subscriptions WHERE owner=? AND customer_id=?').bind(owner,id));
  statements.push(db().prepare('DELETE FROM kyc_history WHERE owner=? AND case_id IN (SELECT id FROM kyc_cases WHERE owner=? AND customer_id=?)').bind(owner,owner,id));
  statements.push(db().prepare('DELETE FROM kyc_cases WHERE owner=? AND customer_id=?').bind(owner,id));
  statements.push(db().prepare('DELETE FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(owner,id));
  if(x.work&&x.loans.length){const next=structuredClone(x.state);next.loans=next.loans.filter((l:any)=>!x.loanIds.includes(l.id));for(const key of ['events','notifications'])next[key]=next[key].filter((e:any)=>!x.loanIds.includes(e.loanId));statements.push(db().prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=?').bind(JSON.stringify(next),owner));for(const loanId of x.loanIds)statements.push(db().prepare('DELETE FROM telegram_outbox WHERE owner=? AND loan_id=?').bind(owner,loanId));}
  statements.push(db().prepare('DELETE FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,id));
 }
 await db().batch(statements);
 return {ok:true,cleared:plans.length,records:summary};
}
