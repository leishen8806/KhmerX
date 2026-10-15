// Run: node --experimental-vm-modules --test tests/team-integration.test.mjs
// Real SQLite + unchanged application services, with only platform identity/storage bindings replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHmac} from 'node:crypto';
const root=path.resolve('.');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB={
 prepare(query){return {bind(...args){const s=sql.prepare(query);return {
  async first(){return s.get(...args)||null},
  async all(){return {results:s.all(...args)}},
  async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}}}
 }}}},
 async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}
};
const blobs=new Map();const env={DB,BUCKET:{async put(k,v){blobs.set(k,v)},async get(k){const v=blobs.get(k);return v?{async arrayBuffer(){return v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}}:null},async delete(k){blobs.delete(k)}},KYC_DATA_SECRET:'synthetic-only-'.repeat(5),KYC_REVIEWER_EMAILS:'owner@example.test',PAYEASE_AUTH_SECRET:'synthetic-auth-'.repeat(5),PAYEASE_AUTH_MODE:'demo',KHMERX_TEST_MODE:'true'};
let user={userId:'owner',email:'owner@example.test'},selected='',extraCookies='';const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,URLSearchParams,AbortSignal,Uint8Array,ArrayBuffer,Buffer,Date,structuredClone,atob,btoa,setTimeout,clearTimeout});
const cache=new Map();
function synth(id,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v)},{context,identifier:id});cache.set(id,m);return m}
synth('cloudflare:workers',{env});synth('next/headers',{headers:async()=>new Headers({cookie:(selected?'payease_company='+selected:'')+extraCookies})});synth(path.join(root,'app/chatgpt-auth.ts'),{getChatGPTUser:async()=>user});
function getModule(spec,base=root+'/entry.ts'){let id=spec;if(spec.startsWith('@/'))id=path.join(root,spec.slice(2));else if(spec.startsWith('.'))id=path.resolve(path.dirname(base),spec);if(!cache.has(id)&&!path.extname(id)&&fs.existsSync(id+'.ts'))id+='.ts';if(cache.has(id))return cache.get(id);if(id.endsWith('.json'))return synth(id,{default:JSON.parse(fs.readFileSync(id,'utf8'))});const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,m);return m}
const entry=getModule('@/lib/team/workflow');await entry.link((s,m)=>getModule(s,m.identifier));await entry.evaluate();
async function mod(name){const m=getModule(name);if(m.status==='unlinked')await m.link((s,p)=>getModule(s,p.identifier));if(m.status==='linked')await m.evaluate();return m.namespace}
const team=await mod('@/lib/team/server'),flow=entry.namespace,kyc=await mod('@/lib/kyc/server'),core=await mod('@/lib/kyc/core'),store=await mod('@/lib/store'),signing=await mod('@/lib/loan-signing'),reports=await mod('@/lib/team/reports'),fundingSettings=await mod('@/lib/team/funding-settings'),fundingRisk=await mod('@/lib/team/funding-risk-events');
const policy=await mod('@/lib/team/policy');
const owner={userId:'owner',email:'owner@example.test'};
function testTotp(secret,at=Date.now()){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let buffer=0,bits=0,bytes=[];for(const c of secret){const n=alphabet.indexOf(c);buffer=(buffer<<5)|n;bits+=5;if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255)}}const counter=Math.floor(at/30000),input=Buffer.alloc(8);input.writeUInt32BE(Math.floor(counter/0x100000000),0);input.writeUInt32BE(counter>>>0,4);const mac=createHmac('sha1',Buffer.from(bytes)).update(input).digest(),offset=mac[19]&15,code=((mac[offset]&127)<<24|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3])%1000000;return String(code).padStart(6,'0')}
const req=p=>new Request('http://localhost/api/kyc/review',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(p)});
const A=(await team.manage({action:'create_company',name:'Synthetic A',slug:'synthetic-a',en:true,km:true,zh:false})).companyId;
const B=(await team.manage({action:'create_company',name:'Synthetic B',slug:'synthetic-b'})).companyId;
test('admin MFA enrollment and SSO challenge verification',async()=>{selected=A;user=owner;const auth=await mod('@/lib/team/auth'),start=await team.manage({action:'mfa_enroll_start'});assert.match(start.mfa.secret,/^[A-Z2-7]{32}$/);assert.match(start.mfa.uri,/otpauth:\/\/totp/);await team.manage({action:'mfa_enroll_confirm',code:testTotp(start.mfa.secret)});assert.equal(sql.prepare('SELECT mfa_enabled FROM team_members WHERE tenant_id=? AND user_id=?').get(A,'owner').mfa_enabled,1);const recovery=await team.manage({action:'mfa_recovery_generate'});assert.equal(recovery.recoveryCodes.length,10);const route=await mod('@/app/api/team/auth/route'),make=(p)=>new Request('http://localhost/api/team/auth',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(p)});const first=await route.POST(make({action:'sso'})),pending=await first.json();assert.equal(pending.mfaRequired,true);const second=await route.POST(make({action:'mfa',challenge:pending.challenge,code:recovery.recoveryCodes[0]}));assert.equal(second.status,200);assert.match(second.headers.get('set-cookie'),/payease_staff_mode=sso/);const replay=await route.POST(make({action:'mfa',challenge:pending.challenge,code:recovery.recoveryCodes[0]}));assert.equal(replay.status,401);await team.manage({action:'mfa_disable',reason:'Synthetic MFA acceptance'});assert.equal(sql.prepare('SELECT mfa_enabled FROM team_members WHERE tenant_id=? AND user_id=?').get(A,'owner').mfa_enabled,0);void auth});
test('break-glass requires a second admin, expires in 30 minutes and is auditable',async()=>{const emergency=await mod('@/lib/team/emergency');const secondId=crypto.randomUUID();sql.prepare("INSERT INTO team_members (id,tenant_id,user_id,email,role,active,version) VALUES (?,?,?,?,?,1,0)").run(secondId,A,'emergency-admin','emergency-admin@example.test','admin');selected=A;user=owner;const request=await emergency.emergencyRequest({scope:['audit','kyc'],reason:'Synthetic recovery for incident review'});assert.equal(request.status,'requested');await assert.rejects(emergency.emergencyApprove(request.id),/不能批准自己的/);user={userId:'emergency-admin',email:'emergency-admin@example.test'};const approved=await emergency.emergencyApprove(request.id);assert.equal(approved.status,'active');const row=sql.prepare('SELECT status,approver_id,expires_at FROM team_emergency_access WHERE id=?').get(request.id);assert.equal(row.approver_id,secondId);assert(row.expires_at-Date.now()<=30*60*1000);await emergency.emergencyRevoke(request.id);assert.equal(sql.prepare('SELECT status FROM team_emergency_access WHERE id=?').get(request.id).status,'revoked');user=owner;await assert.rejects(emergency.emergencyRequest({scope:['funding'],reason:'Synthetic funding incident authorization'}),error=>error.code==='EMERGENCY_TARGET_REQUIRED');const funding=await emergency.emergencyRequest({scope:['funding'],loanId:'loan-target-qa',cents:10000,reason:'Synthetic funding incident authorization'});user={userId:'emergency-admin',email:'emergency-admin@example.test'};await emergency.emergencyApprove(funding.id);user=owner;const grant=await emergency.assertEmergencyAccess(funding.id,'funding','admin_disburse','loan-target-qa',10000);assert.equal(grant.id,funding.id);await assert.rejects(emergency.assertEmergencyAccess(funding.id,'funding','admin_disburse','loan-target-qa',20000),error=>error.code==='EMERGENCY_TARGET_MISMATCH');await assert.rejects(emergency.assertEmergencyAccess(funding.id,'kyc','admin_disburse'),/不包含该业务范围/);await emergency.emergencyRevoke(funding.id)});
test('audit integrity manifests tolerate append-only audit records and detect prefix changes',async()=>{const integrity=await mod('@/lib/team/audit-integrity');selected=A;user=owner;const manifest=await integrity.createManifest();const verified=await integrity.verifyManifest(manifest.id);assert.equal(verified.match,true);await team.manage({action:'add_unit',kind:'department',name:'Integrity test unit'});const appended=await integrity.verifyManifest(manifest.id);assert.equal(appended.match,true);assert.equal(appended.appendOnly,true);assert.equal(appended.appendedRows>0,true);assert.notEqual(appended.currentDigest,appended.manifestDigest)});
test('company creation and editing persist client language availability',async()=>{const created=sql.prepare('SELECT client_en_enabled,client_km_enabled,client_zh_enabled FROM team_companies WHERE id=?').get(A);assert.equal(created.client_en_enabled,1);assert.equal(created.client_km_enabled,1);assert.equal(created.client_zh_enabled,0);selected=A;user=owner;await team.manage({action:'client_language_config',en:true,km:false,zh:true});const edited=sql.prepare('SELECT client_en_enabled,client_km_enabled,client_zh_enabled FROM team_companies WHERE id=?').get(A);assert.equal(edited.client_en_enabled,1);assert.equal(edited.client_km_enabled,0);assert.equal(edited.client_zh_enabled,1);await assert.rejects(team.manage({action:'client_language_config',en:false,km:false,zh:false}),/至少启用一种/)});
test('platform company lifecycle changes are audited and block active loans',async()=>{selected='';user=owner;const before=await team.teamData();assert(before.companies.some(c=>c.id===B));await team.manage({action:'platform_update_company',companyId:B,name:'Synthetic B paused',active:false,en:true,km:true,zh:false,reason:'Synthetic platform pause'});assert.equal(sql.prepare('SELECT active,name FROM team_companies WHERE id=?').get(B).active,0);assert.equal(sql.prepare('SELECT name FROM team_companies WHERE id=?').get(B).name,'Synthetic B paused');await team.manage({action:'platform_update_company',companyId:B,name:'Synthetic B',active:true,en:true,km:true,zh:true,reason:'Synthetic platform restore'});assert.equal(sql.prepare('SELECT active FROM team_companies WHERE id=?').get(B).active,1);assert.equal(sql.prepare("SELECT count(*) AS n FROM team_audit WHERE tenant_id=? AND action='platform_update_company'").get(B).n,2);});
test('role catalog keeps scope, duties and high-risk policy aligned',()=>{assert.equal(policy.roleUnitKind('lender'),'institution');assert.equal(policy.roleUnitKind('kyc'),'department');assert.equal(policy.roleUnitKind('collector'),'postloan');assert.equal(policy.roleUnitKind('admin'),null);assert.equal(policy.roleCatalog.finance_checker.highRisk,true);assert.match(policy.roleCatalog.kyc.description,/KYC/);});
test('company funding settings are isolated, versioned and admin-only',async()=>{selected='';user=owner;const C=(await team.manage({action:'create_company',name:'Synthetic C',slug:'synthetic-c'})).companyId;assert.equal(sql.prepare('SELECT daily_cents,monthly_cents,warning_percent FROM team_funding_settings WHERE tenant_id=?').get(C).daily_cents,1000000);selected=A;user=owner;const before=await fundingSettings.fundingSettingsData();assert.equal(before.settings.dailyCents,1000000);assert.equal(before.settings.monthlyCents,3000000);await assert.rejects(fundingSettings.fundingSettingsSave({dailyCents:4000000,monthlyCents:3000000,warningPercent:20,version:before.settings.version}),error=>error.code==='FUNDING_SETTINGS_INVALID');const saved=await fundingSettings.fundingSettingsSave({dailyCents:1200000,monthlyCents:3600000,warningPercent:20,version:before.settings.version});assert.equal(saved.settings.dailyCents,1200000);assert.equal(saved.settings.version,before.settings.version+1);await assert.rejects(fundingSettings.fundingSettingsSave({dailyCents:1100000,monthlyCents:3300000,warningPercent:20,version:before.settings.version}),error=>error.code==='FUNDING_SETTINGS_CONFLICT');user=reviewer1;await assert.rejects(fundingSettings.fundingSettingsData(),error=>error.code==='FUNDING_SETTINGS_FORBIDDEN');selected=B;user=owner;const other=await fundingSettings.fundingSettingsData();assert.equal(other.settings.dailyCents,1000000);selected=A;user=owner;const current=await fundingSettings.fundingSettingsData();await fundingSettings.fundingSettingsSave({dailyCents:1000000,monthlyCents:3000000,warningPercent:20,version:current.settings.version});});
test('funding risk events persist, deduplicate and close with audit state',async()=>{selected=A;user=owner;const correlation='risk-qa-'+crypto.randomUUID();const insert=fundingRisk.fundingRiskEventStatement({tenantId:A,eventType:'funding_regulatory_warning',severity:'warning',snapshot:{dailyRemainingCents:200000,monthlyRemainingCents:1200000},reason:'Synthetic funding warning evidence',correlationId:correlation,actor:'owner'});await insert.run();await fundingRisk.fundingRiskEventStatement({tenantId:A,eventType:'funding_regulatory_warning',severity:'warning',snapshot:{dailyRemainingCents:200000},reason:'Synthetic duplicate warning',correlationId:correlation,actor:'owner'}).run();assert.equal(sql.prepare('SELECT count(*) AS n FROM team_funding_risk_events WHERE tenant_id=? AND correlation_id=?').get(A,correlation).n,1);const row=sql.prepare('SELECT id FROM team_funding_risk_events WHERE tenant_id=? AND correlation_id=?').get(A,correlation);assert.equal((await fundingRisk.fundingRiskList()).find((x)=>x.id===row.id).status,'open');const acknowledged=await fundingRisk.fundingRiskTransition(row.id,'acknowledge','Synthetic acknowledgement evidence');assert.equal(acknowledged.status,'acknowledged');const resolved=await fundingRisk.fundingRiskTransition(row.id,'resolve','Synthetic resolution evidence');assert.equal(resolved.status,'resolved');await assert.rejects(fundingRisk.fundingRiskTransition(row.id,'resolve','Repeated close evidence'),error=>error.code==='FUNDING_RISK_STATE_CONFLICT');});
test('scoped customer report export is redacted and audited',async()=>{selected=A;user=owner;const result=await reports.exportCustomerSummary({report:'customer_summary',requestId:'report-export-1'});assert.match(result.csv,/customer_id_masked,phone_masked/);assert.equal(typeof result.count,'number');const event=sql.prepare("SELECT action,detail FROM team_audit WHERE tenant_id=? AND action='report_export' ORDER BY created_at DESC LIMIT 1").get(A);assert(event);assert.match(event.detail,/\"redacted\":true/)});
test('operational report exports remain scoped and audited',async()=>{selected=A;user=owner;for(const report of ['kyc_funnel','loan_cashflow','collections']){const result=await reports.exportCustomerSummary({report,requestId:'report-'+report});assert.match(result.csv,/\r?\n/);assert.match(result.filename,new RegExp(report));}assert.equal(sql.prepare("SELECT count(*) AS n FROM team_audit WHERE tenant_id=? AND action='report_export'").get(A).n,4)});
test('audit records are append-only at database level',()=>{const row=sql.prepare("SELECT id FROM team_audit WHERE tenant_id=? LIMIT 1").get(A);assert(row);assert.throws(()=>sql.prepare('UPDATE team_audit SET detail=? WHERE id=?').run('tampered',row.id),/append-only/);assert.throws(()=>sql.prepare('DELETE FROM team_audit WHERE id=?').run(row.id),/append-only/)})
async function member(tenant,role,email,unit){selected=tenant;user=owner;await team.manage({action:'create_member',role,email,unitId:unit});user={userId:email,email};await team.staff();return {...user}}
selected=A;user=owner;await team.manage({action:'add_unit',kind:'institution',name:'机构 A'});await team.manage({action:'add_unit',kind:'department',name:'运营二部'});
const units=sql.prepare('SELECT * FROM team_units WHERE tenant_id=?').all(A),dept=sql.prepare('SELECT default_department FROM team_companies WHERE id=?').get(A).default_department,dept2=units.find(u=>u.kind==='department'&&u.id!==dept).id,inst=units.find(u=>u.kind==='institution').id;
const reviewer1=await member(A,'kyc','reviewer1@example.test',dept),reviewer2=await member(A,'kyc','reviewer2@example.test',dept),deptManager=await member(A,'dept_admin','manager@example.test',dept),otherReviewer=await member(A,'kyc','other@example.test',dept2),lender=await member(A,'lender','lender@example.test',inst),checker=await member(A,'checker','checker@example.test',inst),finance=await member(A,'finance','finance@example.test',inst),financeChecker=await member(A,'finance_checker','cashcheck@example.test',inst);
selected=A;user=owner;await team.manage({action:'kyc_field_permission',memberId:sql.prepare('SELECT id FROM team_members WHERE email=?').get(reviewer1.email).id,fieldGroup:'identity',enabled:true,reason:'Synthetic QA: authorized identity correction'});
await team.ensureAssignment(A,'customer-1');await team.ensureAssignment(A,'customer-2');
test('automatic assignment balances active reviewers and assigns institution',async()=>{const a=await team.assignment(A,'customer-1'),b=await team.assignment(A,'customer-2');assert(a.reviewer_id);assert.notEqual(a.reviewer_id,b.reviewer_id);assert.equal(a.institution_id,inst)});
test('organization units support audited rename and safe lifecycle',async()=>{selected=A;user=owner;const created=await team.manage({action:'add_unit',kind:'institution',name:'Lifecycle institution'}),unit=sql.prepare("SELECT id,active FROM team_units WHERE tenant_id=? AND name='Lifecycle institution'").get(A);assert.equal(unit.active,1);await assert.rejects(team.manage({action:'add_unit',kind:'institution',name:' lifecycle institution '}),/同类型机构或部门名称已存在/);await team.manage({action:'update_unit',unitId:unit.id,name:'Lifecycle institution renamed',active:true,reason:'Synthetic rename'});assert.equal(sql.prepare('SELECT name FROM team_units WHERE id=?').get(unit.id).name,'Lifecycle institution renamed');await team.manage({action:'update_unit',unitId:unit.id,name:'Lifecycle institution renamed',active:false,reason:'Synthetic retirement'});assert.equal(sql.prepare('SELECT active FROM team_units WHERE id=?').get(unit.id).active,0);await assert.rejects(team.manage({action:'create_member',role:'lender',email:'inactive-unit@example.test',unitId:unit.id}));const audit=sql.prepare("SELECT detail FROM team_audit WHERE tenant_id=? AND action='update_unit' ORDER BY created_at DESC LIMIT 1").get(A);assert.match(audit.detail,/Synthetic retirement/);await assert.rejects(team.manage({action:'update_unit',unitId:dept,name:'Default department',active:false,reason:'Must remain default'}),/默认部门不能停用/);void created});
test('employee list API enforces admin access and preserves server filters',async()=>{const route=await mod('@/app/api/team/members/route');const request=(params='')=>new Request(`http://localhost/api/team/members${params?`?${params}`:''}`,{headers:{origin:'http://localhost'}});selected=A;user=reviewer1;const forbidden=await route.GET(request('role=kyc'));assert.equal(forbidden.status,403);user=owner;const response=await route.GET(request(`page=1&pageSize=5&role=kyc&unitId=${encodeURIComponent(dept)}&active=1`));assert.equal(response.status,200);const body=await response.json();assert.equal(body.page,1);assert.equal(body.pageSize,5);assert(body.items.every((m)=>m.role==='kyc'&&m.unit_id===dept&&m.active===1));});
test('database rejects cross-company units, staff and assignment references',()=>{const bdept=sql.prepare('SELECT default_department FROM team_companies WHERE id=?').get(B).default_department;assert.throws(()=>sql.prepare('UPDATE team_assignments SET department_id=? WHERE tenant_id=?').run(bdept,A),/tenant scope/);assert.throws(()=>sql.prepare('UPDATE team_members SET unit_id=? WHERE email=?').run(bdept,reviewer1.email),/tenant scope/)});
test('department administrator can reassign within department with reason; cannot cross departments',async()=>{selected=A;user=deptManager;const a=await team.assignment(A,'customer-1'),r=sql.prepare('SELECT id FROM team_members WHERE email=?').get(reviewer1.email);await flow.assignCustomer({customerId:'customer-1',departmentId:dept,institutionId:inst,reviewerId:r.id,reason:'Synthetic reassignment',version:a.version});const updated=await team.assignment(A,'customer-1');assert.equal(updated.reviewer_id,r.id);await assert.rejects(flow.assignCustomer({customerId:'customer-1',departmentId:dept2,institutionId:inst,reason:'cross',version:updated.version}));await assert.rejects(flow.assignCustomer({customerId:'customer-1',departmentId:dept,institutionId:inst,reason:'',version:updated.version}));});
test('employee identity cannot access another company or another reviewer case; admin and KYC supervisor can review within own scope',async()=>{selected=B;user=reviewer1;await assert.rejects(team.staff());selected=A;user=reviewer2;await assert.rejects(team.guardKyc(A,'customer-1',true));user=owner;await team.guardKyc(A,'customer-1',true);await assert.rejects(team.guardKyc(B,'customer-1',true));user=reviewer1;await team.guardKyc(A,'customer-1',true);user=deptManager;await team.guardKyc(A,'customer-1',true)});
let caseRow;
async function profile(){const p=core.emptyProfile();p.consent=true;for(const f of core.fields.filter(x=>x.required))p.values[f.id]=f.options?.[0].value||(f.kind==='phone'?'+1202555010'+(f.id.includes('1')?'1':'2'):'SYNTHETIC TEST');p.values.contact2Relation='朋友';p.values.district=core.regions[0].districts[0].value;const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64'));for(const slot of core.slots.filter(x=>x.required&&x.id!=='signature'))p.files[slot.id]=await kyc.recordFile(A,'customer-1',slot.id,bytes,'image/png');return p}
test('KYC is reviewed independently before any loan; reviewer amendments require resubmission',async()=>{selected=A;user=reviewer1;await assert.rejects(store.mutate(A,{action:'create',name:'SYNTHETIC',amount:5000,consent:true,requestId:crypto.randomUUID()},{id:'customer-1',phoneMasked:'test'}),/KYC/);caseRow=await kyc.initialize(A,'customer-1',false);const first=await profile();assert.deepEqual(Array.from(core.missing(first)),[]);assert.equal(first.files.signature,undefined);caseRow=await kyc.transition(caseRow,'submitted',{profile:first,phoneVerified:false,ruleVersion:'test'},'submit','customer-1');const old=await kyc.payload(caseRow),values={...old.profile.values,givenName:'CORRECTED'};const updated=await kyc.decide(req({action:'amend',id:caseRow.id,revision:caseRow.revision,values,reason:'Correct synthetic spelling'}));assert.equal(updated.status,'needs_info');assert.equal(updated.profile.consent,false);assert.equal(updated.profile.files.signature,undefined);caseRow=await kyc.getCase(A,caseRow.id);caseRow=await kyc.transition(caseRow,'submitted',{profile:await profile(),phoneVerified:false,ruleVersion:'test'},'submit','customer-1');await kyc.decide(req({id:caseRow.id,revision:caseRow.revision,decision:'approved',reason:'Synthetic manual checks',checklist:Object.fromEntries(core.sections.map(x=>[x.id,true]))}));assert.equal((await store.readState(A)).state.loans.length,0);});

let loanId;
test('KYC approval → amount application → fee confirmation → signature → approval → funding',async()=>{selected=A;user=owner;const c={id:'customer-1',phoneMasked:'+1***01'},created=await store.mutate(A,{action:'create',name:'SYNTHETIC',amount:5000,consent:true,requestId:crypto.randomUUID()},c);loanId=created.state.loans[0].id;assert.equal(created.state.loans[0].status,'kyc_approved');await assert.rejects(store.mutate(A,{action:'confirm_bill',loanId,billConfirmed:true,quoteId:'stale',requestId:crypto.randomUUID()},c));const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64'));await assert.rejects(signing.saveLoanSignature(A,c.id,loanId,bytes),/确认费用/);await store.mutate(A,{action:'confirm_bill',loanId,billConfirmed:true,quoteId:created.state.loans[0].billing.quoteId,requestId:crypto.randomUUID()},c);const before=await kyc.findCase(A,c.id);await signing.saveLoanSignature(A,c.id,loanId,bytes);assert.equal((await kyc.findCase(A,c.id)).revision,before.revision);assert.equal((await kyc.payload(await kyc.findCase(A,c.id))).profile.files.signature,undefined);await store.mutate(A,{action:'apply',loanId,billConfirmed:true,quoteId:created.state.loans[0].billing.quoteId,requestId:crypto.randomUUID()},c);assert((await store.readState(A)).state.loans.find(l=>l.id===loanId).signedAt);user=reviewer1;await assert.rejects(flow.staffAction({action:'approve',loanId,requestId:crypto.randomUUID()}));user=lender;await flow.staffAction({action:'approve',loanId,requestId:crypto.randomUUID()});await assert.rejects(flow.staffAction({action:'approval_check',loanId,requestId:crypto.randomUUID()}));user=checker;await flow.staffAction({action:'approval_check',loanId,requestId:crypto.randomUUID()});assert.equal((await flow.scopedState()).state.loans[0].status,'signed');user=finance;await flow.staffAction({action:'disburse_request',loanId,requestId:crypto.randomUUID()});await assert.rejects(flow.staffAction({action:'disburse',loanId,requestId:crypto.randomUUID()}));user=financeChecker;const funded=await flow.staffAction({action:'disburse',loanId,requestId:crypto.randomUUID()});assert.equal(funded.state.loans[0].status,'active');assert.equal(funded.state.loans[0].wallet,4465);assert.equal(funded.state.loans[0].billing.interest,35);assert.equal(funded.state.loans[0].billing.total,5000);selected=B;user=owner;const isolated=await flow.scopedState();assert.equal(isolated.state.loans.length,0);selected=A;user=deptManager;const a=await team.assignment(A,'customer-1');await assert.rejects(flow.assignCustomer({customerId:'customer-1',departmentId:dept,institutionId:inst,reason:'not allowed after funding',version:a.version}));});
test('admin directly creates, changes, disables and re-enables members; old invitations are rejected',async()=>{
 selected=A;user=owner;
 const m=sql.prepare('SELECT * FROM team_members WHERE email=?').get(reviewer1.email);
 const update={action:'update_member',memberId:m.id,role:'kyc',unitId:dept,active:false,version:m.version,reason:'Synthetic disable'};
 await team.manage(update);user=reviewer1;await assert.rejects(team.staff());
 user=owner;await assert.rejects(team.manage(update));
 await team.manage({...update,active:true,version:m.version+1});user=reviewer1;await team.staff();
 assert.equal((await team.assignment(A,'customer-1')).reviewer_id,null);
 await assert.rejects(team.manage({action:'create_member',role:'admin',email:'new@example.test'}));
 user=owner;await assert.rejects(team.manage({action:'create_member',role:'kyc',email:reviewer1.email.toUpperCase(),unitId:dept}));
 const own=sql.prepare('SELECT * FROM team_members WHERE tenant_id=? AND user_id=?').get(A,'owner');
 await assert.rejects(team.manage({...update,memberId:own.id,version:own.version}));
 await assert.rejects(team.manage({action:'invite',role:'kyc',email:'intended@example.test',unitId:dept}));
 await assert.rejects(team.manage({action:'accept_invite',token:'old-token'}));
 await team.manage({action:'create_member',role:'audit',email:'pending@example.test'});
 user={userId:'wrong',email:'wrong@example.test'};await assert.rejects(team.staff());
 user={userId:'correct',email:'pending@example.test'};assert.equal((await team.staff()).member.role,'audit');
 user={userId:'different',email:'pending@example.test'};await assert.rejects(team.staff());
});
test('same-person checks remain forbidden even if their role changes',async()=>{const policy=await mod('@/lib/team/policy');assert.throws(()=>policy.requireDifferent('same','same'));assert.throws(()=>policy.requireDifferent('same',undefined));assert.doesNotThrow(()=>policy.requireDifferent('checker','maker'))});
test('independent loan signature remains bound to the reviewed profile and bill',async()=>{selected=A;user=owner;const row=await kyc.findCase(A,'customer-1'),data=await kyc.payload(row),loan=(await store.readState(A)).state.loans.find(l=>l.id===loanId);const contract=await signing.validLoanContract(A,loan,row);assert.equal(contract.loanId,loanId);await assert.rejects(signing.validLoanContract(A,{...loan,amount:loan.amount+1},row));await assert.rejects(signing.validLoanContract(A,{...loan,kycRevision:row.revision+1},row));});
test('company B has no attachment access to company A even with a known file ID',async()=>{const row=await kyc.getCase(A,caseRow.id),p=await kyc.payload(row);await assert.rejects(kyc.fileRow(B,p.profile.files.idFront.id,'customer-1'),/不可访问/)});
test('KYC file replacement does not consume the 40-file quota',async()=>{selected=A;user=owner;const customer='quota-customer',sample=sql.prepare('SELECT metadata FROM kyc_files WHERE owner=? LIMIT 1').get(A).metadata;for(let i=0;i<39;i++)sql.prepare('INSERT INTO kyc_files (id,owner,customer_id,slot,metadata,ready,created_at) VALUES (?,?,?,?,?,1,?)').run(crypto.randomUUID(),A,customer,`dummy-${i}`,sample,new Date().toISOString());const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64'));const first=await kyc.recordFile(A,customer,'idFront',bytes,'image/png'),second=await kyc.recordFile(A,customer,'idFront',Uint8Array.from([...bytes,0]),'image/png');assert.notEqual(first.id,second.id);assert(sql.prepare('SELECT superseded_at FROM kyc_files WHERE id=?').get(first.id).superseded_at);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM kyc_files WHERE owner=? AND customer_id=? AND ready=1 AND superseded_at IS NULL').get(A,customer).n,40)});
async function approvedCustomer(id){const row=await kyc.initialize(A,id,false);if(row.status!=='approved')await kyc.transition(row,'approved',await kyc.payload(row),'test-fixture','test');}
test('company fee settings are admin-only, isolated, versioned; existing bills remain unchanged',async()=>{
 selected=A;user=owner;const before=await team.pricingFor(A);const savedLoan=(await store.readState(A)).state.loans[0];
 await team.manage({action:'pricing_save',...before,interestTiming:'repayment'});
 assert.equal((await team.pricingFor(B)).interestTiming,'upfront');
 await assert.rejects(team.manage({action:'pricing_save',...before,interestTiming:'repayment'}));
 user=reviewer1;await assert.rejects(team.manage({action:'pricing_save',...before,version:before.version+1}));
 user=owner;await approvedCustomer('pricing-customer');const created=await store.mutate(A,{action:'create',name:'PRICE QA',amount:10000,botId:'bot-1',consent:true,billing:{net:999999},requestId:crypto.randomUUID()},{id:'pricing-customer',phoneMasked:'TEST'});
 const l=created.state.loans[0];assert.equal(l.billing.net,9000);assert.equal(l.billing.total,10069);assert.equal(l.billing.interestTiming,'repayment');
 assert.deepEqual((await store.readState(A)).state.loans.find(l=>l.id===savedLoan.id).billing,savedLoan.billing);
});

test('postloan roles, tenant/department isolation, task notes and settlement',async()=>{
 const post=await mod('@/lib/postloan/server');selected=A;user=owner;await post.ensurePostDepartment(A);await post.ensurePostDepartment(B);
 const pd='postloan:'+A,pb='postloan:'+B;
 await assert.rejects(team.manage({action:'create_member',role:'collector',email:'badcol@example.test',unitId:dept}));
 const ca=await member(A,'collector','collector-a@example.test',pd),cb=await member(A,'collector','collector-b@example.test',pd),cm=await member(A,'collection_admin','collection-manager@example.test',pd),bc=await member(B,'collector','collector-other-company@example.test',pb);
 const now=new Date().toISOString(),r=await store.readState(A),l=r.state.loans.find(l=>l.id===loanId);l.dueAt=now;sql.prepare('UPDATE demo_workspaces SET payload=? WHERE owner=?').run(JSON.stringify(r.state),A);
 await post.runCompany(A,now);selected=A;user=owner;const d=await post.postloanData();assert.equal(d.tasks.length,1);const t=d.tasks[0],assignee=t.assigneeId===sql.prepare('SELECT id FROM team_members WHERE email=?').get(ca.email).id?ca:cb,other=assignee===ca?cb:ca;
 selected=B;user=bc;assert.equal((await post.postloanData()).tasks.length,0);await assert.rejects(post.postloanAction({action:'note',taskId:t.id,note:'cross tenant'}));
 selected=A;user=other;assert.equal((await post.postloanData()).tasks.length,0);await assert.rejects(post.postloanAction({action:'note',taskId:t.id,note:'not assigned'}));
 user=assignee;assert.equal((await post.postloanData()).tasks.length,1);await assert.rejects(team.guardKyc(A,'customer-1'));const p={action:'note',taskId:t.id,version:t.updatedAt,requestId:crypto.randomUUID(),outcome:'contacted',note:'Synthetic customer contacted'};await post.postloanAction(p);await post.postloanAction(p);assert.equal((await post.postloanData()).tasks[0].records.filter(r=>r.note.includes('Synthetic customer')).length,1);
 await assert.rejects(post.postloanAction({...p,requestId:crypto.randomUUID(),version:'stale'}));await assert.rejects(post.postloanAction({...p,action:'reassign',requestId:crypto.randomUUID(),assigneeId:'bad'}));
 user=cm;const task=(await post.postloanData()).tasks[0];await post.postloanAction({action:'reassign',taskId:t.id,version:task.updatedAt,requestId:crypto.randomUUID(),assigneeId:sql.prepare('SELECT id FROM team_members WHERE email=?').get(other.email).id,note:'balance work'});
 user=assignee;assert.equal((await post.postloanData()).tasks.length,0);user=reviewer1;await assert.rejects(post.postloanData());
 user=owner;await store.mutate(A,{action:'repay',loanId,cents:l.amount+l.fee-l.paid,requestId:crypto.randomUUID()},{id:l.customerId,phoneMasked:'TEST'},{allowInternalSettlement:true});assert.equal((await post.postloanData()).tasks[0].status,'closed');
 assert.equal(await post.jobAuthorized(new Request('https://test/api/jobs/postloan')),false);env.POSTLOAN_JOB_SECRET='secret-test-'.repeat(4);assert.equal(await post.jobAuthorized(new Request('https://test/api/jobs/postloan',{headers:{authorization:'Bearer '+env.POSTLOAN_JOB_SECRET}})),true);assert.equal(await post.jobAuthorized(new Request('https://test/api/jobs/postloan',{headers:{authorization:'Bearer wrong'}})),false);
});

test('customer selects 14 or 28 days; authoritative bills ignore spoofed pricing and reject other terms',async()=>{
 selected=A;user=owner;
 for(const termDays of [14,28]){await approvedCustomer('term-customer-'+termDays);const c={id:'term-customer-'+termDays,phoneMasked:'TEST'},created=await store.mutate(A,{action:'create',name:'TERM QA',amount:10000,botId:'bot-1',consent:true,termDays,billing:{termDays:1,interest:0},requestId:crypto.randomUUID()},c),l=created.state.loans[0];assert.equal(l.billing.termDays,termDays);assert.equal(l.billing.interest,termDays===14?69:138);assert.equal(l.billing.service,1000);assert.equal(l.billing.net,9000);assert.equal(l.billing.total,termDays===14?10069:10138)}
 await approvedCustomer('invalid-term');for(const termDays of [0,7,15,365,'28',null]){if(termDays===null)continue;await assert.rejects(store.mutate(A,{action:'create',name:'BAD TERM',amount:10000,botId:'bot-1',consent:true,termDays,requestId:crypto.randomUUID()},{id:'invalid-term',phoneMasked:'TEST'}))}
});

test('Telegram signed subscription, tenant isolation, one-time delivery and unsubscribe',async()=>{
 const notify=await mod('@/lib/notifications/server'),post=await mod('@/lib/postloan/server'),ncore=await mod('@/lib/notifications/core');selected=A;user=owner;
 const token='synthetic-token',customerId='term-customer-14',botId='bot-1';env[ncore.tokenKey(A,botId)]=token;
 const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123456,first_name:'Synthetic'})};const text=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),secret=createHmac('sha256','WebAppData').update(token).digest(),hash=createHmac('sha256',secret).update(text).digest('hex'),initData=new URLSearchParams({...fields,hash}).toString();
 await assert.rejects(notify.bindNotifications(A,customerId,{action:'subscribe',botId,consent:false,initData}));await assert.rejects(notify.bindNotifications(A,customerId,{action:'subscribe',botId,consent:true,initData:initData+'bad'}));
 await notify.bindNotifications(A,customerId,{action:'subscribe',botId,consent:true,initData});assert((await notify.notificationSettings(A,customerId)).channels.find(b=>b.id===botId).bound);await assert.rejects(notify.bindNotifications(A,'different-customer',{action:'subscribe',botId,consent:true,initData}));
 const current=await store.readState(A),l=current.state.loans.find(l=>l.customerId===customerId);l.status='active';l.dueAt=new Date(Date.now()+3*86400000).toISOString();sql.prepare('UPDATE demo_workspaces SET payload=? WHERE owner=?').run(JSON.stringify(current.state),A);await post.runCompany(A);
 let calls=0;context.fetch=async(url,init)=>{calls++;assert.equal(JSON.parse(init.body).chat_id,123456);return Response.json({ok:true,result:{message_id:11,chat:{id:123456}}})};
 await notify.dispatchCompany(B);assert.equal(calls,0);await notify.dispatchCompany(A);await notify.dispatchCompany(A);assert.equal(calls,1);assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM telegram_outbox WHERE owner=? AND status='sent'").get(A).n,1);
 const reminderLoan=l,resubscribeNotification=`postloan-reminder:${reminderLoan.id}:resubscribe`;const withSecondReminder=await store.readState(A);withSecondReminder.state.notifications.push({id:resubscribeNotification,loanId:reminderLoan.id,createdAt:new Date().toISOString()});sql.prepare('UPDATE demo_workspaces SET payload=? WHERE owner=?').run(JSON.stringify(withSecondReminder.state),A);sql.prepare("INSERT INTO telegram_outbox (id,owner,notification_id,loan_id,subscription_id,status,attempts,next_at,updated_at,reason) VALUES (?,?,?,?,?,'pending',0,0,?,'测试待发送')").run(crypto.randomUUID(),A,resubscribeNotification,reminderLoan.id,`${A}:${customerId}:${botId}`,new Date().toISOString());
 await notify.bindNotifications(A,customerId,{action:'unsubscribe',botId});assert.equal((await notify.notificationSettings(A,customerId)).channels.find(b=>b.id===botId).bound,false);
 // Re-subscribing must reactivate the cancelled outbox row despite the
 // unique (owner, notification_id) index, otherwise the same reminder is
 // silently lost forever after an unsubscribe/subscribe cycle.
 const fieldsAgain={...fields,query_id:'resubscribe-qa'};const textAgain=Object.entries(fieldsAgain).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const hashAgain=createHmac('sha256',secret).update(textAgain).digest('hex');const initDataAgain=new URLSearchParams({...fieldsAgain,hash:hashAgain}).toString();
 await notify.bindNotifications(A,customerId,{action:'subscribe',botId,consent:true,initData:initDataAgain});await notify.dispatchCompany(A);assert.equal(calls,2);assert.equal(sql.prepare("SELECT status FROM telegram_outbox WHERE owner=? AND notification_id=?").get(A,resubscribeNotification).status,'sent');
 user=reviewer1;await assert.rejects(notify.notificationAdmin());user=owner;
});

 test('business bot switch is admin-only, company-isolated, and overrides customer-supplied channels',async()=>{
 selected=A;user=reviewer1;await assert.rejects(flow.staffAction({action:'bot_switch',botId:'bot-2',previousBotId:'bot-1',requestId:crypto.randomUUID()}));
 user=owner;const before=await store.readState(A),existing=before.state.loans.map(l=>[l.id,l.botId]);await flow.staffAction({action:'bot_switch',botId:'bot-2',previousBotId:'bot-1',requestId:crypto.randomUUID()});
 assert.equal((await store.readState(A)).state.activeBotId,'bot-2');assert.equal((await store.readState(B)).state.activeBotId,undefined);assert.deepEqual((await store.readState(A)).state.loans.map(l=>[l.id,l.botId]),existing);
 await assert.rejects(flow.staffAction({action:'bot_switch',botId:'bot-1',previousBotId:'bot-1',requestId:crypto.randomUUID()}));
 await approvedCustomer('channel-customer');const result=await store.mutate(A,{action:'create',name:'Channel test',amount:5000,botId:'forged-channel',consent:true,requestId:crypto.randomUUID()},{id:'channel-customer',phoneMasked:'test'});assert.equal(result.state.loans[0].botId,'bot-2');
 });

test('channel registration switches are isolated, account-bound and enforced by account API',async()=>{
 selected=A;user=owner;
 const route=await mod('@/app/api/h5/auth/account/route'),policy=await mod('@/lib/registration-policy');
 const browser='b'.repeat(64),request=(body,token='')=>new Request('http://localhost/api/h5/auth/account',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json',cookie:'payease_h5_browser='+browser+(token?'; payease_h5_session='+token:'')},body:JSON.stringify(body)});
 let response=await route.POST(request({action:'register',phone:'+85599123456'}));assert.equal(response.status,200);const d=await response.json(),token=response.headers.get('set-cookie').match(/payease_h5_session=([a-f0-9]+)/)[1];assert.equal(d.policy.channelId,'bot-2');assert.equal(d.session.phoneVerified,false);
 await flow.staffAction({action:'bot_save',botId:'bot-2',label:'Channel two',username:'',enabled:true,phoneVerification:false,passwordSetup:false,requestId:crypto.randomUUID()});
 assert.equal((await policy.registrationPolicy({db:DB},A,d.session.customerId)).passwordSetup,false);
 response=await route.POST(request({action:'set_password',password:'Synthetic-password-123',passwordSetup:true},token));assert.equal(response.status,403);
 await assert.rejects(policy.requireRegistrationStep({db:DB},A,d.session.customerId,'phoneVerification'));
 await flow.staffAction({action:'bot_switch',botId:'bot-1',previousBotId:'bot-2',requestId:crypto.randomUUID()});
 assert.equal((await policy.registrationPolicy({db:DB},A,d.session.customerId)).phoneVerification,false);assert.equal((await policy.registrationPolicy({db:DB},A)).phoneVerification,true);assert.equal((await policy.registrationPolicy({db:DB},B)).passwordSetup,true);
 user=reviewer1;await assert.rejects(flow.staffAction({action:'bot_save',botId:'bot-2',label:'Forbidden',username:'',enabled:true,passwordSetup:true,requestId:crypto.randomUUID()}));
});

test('enabled registration requirements block customer and KYC access until fulfilled; disabled requirements do not',async()=>{
 selected=A;user=owner;const auth=await mod('@/lib/h5-auth-core'),access=await mod('@/lib/h5-auth');const runtime={db:DB,config:{mode:'demo',secret:env.PAYEASE_AUTH_SECRET,allowDemo:true}};
 const a=await auth.registerPhone(runtime,A,'c'.repeat(64),{phone:'+12025550188'},'bot-1'),request=new Request('http://localhost/api/h5/state',{headers:{cookie:'payease_h5_session='+a.token}});
 const config=async(phoneVerification,passwordSetup)=>flow.staffAction({action:'bot_save',botId:'bot-1',label:'Main',username:'',enabled:true,phoneVerification,passwordSetup,requestId:crypto.randomUUID()});
 await config(true,true);await assert.rejects(access.customer(request),/手机号验证/);await assert.rejects(kyc.context(request),/手机号验证/);
 await config(false,true);await assert.rejects(access.customer(request),/设置密码/);
 await config(false,false);assert.equal((await access.customer(request)).session.phoneVerified,false);
 await config(true,false);await assert.rejects(access.customer(request),/手机号验证/);
 const challenge=await auth.sendCode(runtime,A,'c'.repeat(64),{phone:'+12025550188',consent:true}),verified=await auth.verifyCode(runtime,A,'c'.repeat(64),{challengeId:challenge.challengeId,code:challenge.demoCode},a.session.customerId);
 const verifiedRequest=new Request('http://localhost/api/h5/state',{headers:{cookie:'payease_h5_session='+verified.token}});assert.equal((await kyc.context(verifiedRequest)).verified,false);
 await config(true,true);await assert.rejects(access.customer(verifiedRequest),/设置密码/);await auth.setPassword(runtime,A,verified.token,{password:'Synthetic-required-password-123'});assert.equal((await access.customer(verifiedRequest)).session.hasPassword,true);
});

test('signature requires confirmed fees; unsigned applications cannot reach loan approval',async()=>{
 selected=A;user=owner;await approvedCustomer('signing-order-test');const c={id:'signing-order-test',phoneMasked:'test'},created=await store.mutate(A,{action:'create',name:'Order test',amount:5000,consent:true,requestId:crypto.randomUUID()},c),loan=created.state.loans[0],row=await kyc.initialize(A,c.id,false),data=await kyc.payload(row),p=structuredClone(data.profile);p.consent=true;p.files.signature={id:'not-uploaded'};await assert.rejects(kyc.signedContract(row,p,data),/确认.*费用/);
 await store.mutate(A,{action:'confirm_bill',loanId:loan.id,billConfirmed:true,quoteId:loan.billing.quoteId,requestId:crypto.randomUUID()},c);await assert.rejects(store.mutate(A,{action:'apply',loanId:loan.id,billConfirmed:true,quoteId:loan.billing.quoteId,requestId:crypto.randomUUID()},c),/手写签约/);assert.equal((await store.readState(A)).state.loans.find(l=>l.id===loan.id).status,'kyc_approved');
});


test('company bot Token: verified metadata, encrypted isolation, rotation and permission checks',async()=>{
 const bots=await mod('@/lib/bot-credentials');selected=A;user=owner;
 const token='987654321:'+ 'a'.repeat(35), rotated='987654321:'+ 'b'.repeat(35);
 context.fetch=async()=>Response.json({ok:true,result:{id:987654321,is_bot:true,first_name:'Synthetic bot',username:'synthetic_bot'}});
 await assert.rejects(bots.configureBot({botId:'bot-1',token}),/已有机器人凭据/);const ncore=await mod('@/lib/notifications/core');env[ncore.tokenKey(A,'bot-1')]=token;
 const result=await bots.configureBot({botId:'bot-1',token});assert.equal(result.username,'synthetic_bot');assert(!JSON.stringify(result).includes(token));
 assert.equal(await bots.channelToken(A,'bot-1'),token);assert.equal(await bots.channelToken(B,'bot-1'),'');
 const stored=sql.prepare('SELECT * FROM telegram_bot_credentials WHERE owner=?').get(A);assert(!JSON.stringify(stored).includes(token));
 const state=(await store.readState(A)).state;assert.equal(state.bots[0].label,'Synthetic bot');assert.equal(state.bots[0].tokenConfigured,true);assert.equal((await flow.scopedState()).state.bots[0].username,'synthetic_bot');assert(!JSON.stringify(state).includes(token));
 assert(!JSON.stringify(sql.prepare('SELECT * FROM team_audit').all()).includes(token));
 user=reviewer1;await assert.rejects(bots.configureBot({botId:'bot-1',token}),/管理员/);
 selected=B;user=owner;await assert.rejects(bots.configureBot({botId:'bot-1',token}),/其他业务渠道/);
 selected=A;await bots.configureBot({botId:'bot-1',token:rotated});assert.equal(await bots.channelToken(A,'bot-1'),rotated);
 context.fetch=async()=>Response.json({ok:true,result:{id:987654322,is_bot:true,first_name:'Another',username:'another_bot'}});
 await assert.rejects(bots.configureBot({botId:'bot-1',token:'987654322:'+ 'c'.repeat(35)}),/新增渠道/);assert.equal(await bots.channelToken(A,'bot-1'),rotated);
 context.fetch=async()=>{throw Error('https://api.telegram.org/bot'+token)};
 await assert.rejects(bots.configureBot({botId:'bot-1',token}),e=>!e.message.includes(token)&&e.message.includes('校验失败'));
 context.fetch=async()=>{const actor=sql.prepare("SELECT * FROM team_members WHERE tenant_id=? AND user_id='owner'").get(A);sql.prepare('UPDATE team_members SET version=version+1 WHERE id=?').run(actor.id);return Response.json({ok:true,result:{id:987654321,is_bot:true,first_name:'Changed',username:'changed_bot'}})};
 await assert.rejects(bots.configureBot({botId:'bot-1',token}),/权限已变化/);assert.equal(await bots.channelToken(A,'bot-1'),rotated);
});

test('assignment workspace exposes scoped KYC metadata without identity documents or cross-company cases',async()=>{
 selected=A;user=owner;const all=await flow.scopedState();assert(all.kycOrders.length>0);for(const k of all.kycOrders)assert.deepEqual(Object.keys(k).sort(),['customer_id','customer_ref','id','phone_mask','public_ref','registered_at','revision','status','updated_at']);
 selected=B;const other=await flow.scopedState();assert(!other.kycOrders.some(k=>all.kycOrders.some(a=>a.id===k.id)));
 selected=A;user=reviewer1;const assigned=await flow.scopedState();const member=await team.staff();for(const k of assigned.kycOrders)assert.equal((await team.assignment(A,k.customer_id)).reviewer_id,member.member.id);
 user=owner;
});

test('test registration cleanup matches full phone across workspaces, preserves mask collisions, denies non-admin and stale previews',async()=>{
 const cleanup=await mod('@/lib/customer-cleanup'),auth=await mod('@/lib/h5-auth-core');user=owner;selected=A;
 const runtime={db:DB,config:{mode:'demo',secret:env.PAYEASE_AUTH_SECRET,allowDemo:true}},phone='+85512349876';
 const a=await auth.registerPhone(runtime,A,'d'.repeat(64),{phone}),b=await auth.registerPhone(runtime,'owner','e'.repeat(64),{phone}),other=await auth.registerPhone(runtime,A,'f'.repeat(64),{phone:'+85599999876'});
 await kyc.initialize(A,a.session.customerId,false);
 const preview=await cleanup.customerCleanup({action:'preview',phone});assert.equal(preview.records.length,2);
 user=reviewer1;await assert.rejects(cleanup.customerCleanup({action:'clear',phone,version:preview.version,confirm:true}),/平台管理员/);user=owner;
 await assert.rejects(cleanup.customerCleanup({action:'clear',phone,version:'stale',confirm:true}));
 assert.equal((await cleanup.customerCleanup({action:'clear',phone,version:preview.version,confirm:true})).cleared,2);
 assert.equal(await auth.getSession(runtime,A,a.token),null);assert.equal(await auth.getSession(runtime,'owner',b.token),null);assert(await auth.getSession(runtime,A,other.token));assert.equal(await kyc.findCase(A,a.session.customerId),null);
 assert.equal((await cleanup.customerCleanup({action:'preview',phone})).records.length,0);
});

test('KYC followups preserve review status, are idempotent and scoped by company and reviewer',async()=>{
 const f=await mod('@/lib/kyc/followups');selected=A;user=owner;const row=await kyc.findCase(A,'customer-1');const p={status:'waiting',note:'Synthetic followup: awaiting clarification',requestId:crypto.randomUUID()};
 const saved=await f.kycFollowups(row.id,p);assert.equal(saved.records.length,1);assert.equal(saved.order.status,row.status);assert.equal((await f.kycFollowups(row.id,p)).records.length,1);
 await assert.rejects(f.kycFollowups(row.id,{...p,note:'',requestId:crypto.randomUUID()}));
 selected=B;await assert.rejects(f.kycFollowups(row.id));selected=A;user=reviewer2;await assert.rejects(f.kycFollowups(row.id));user={userId:'correct',email:'pending@example.test'};assert.equal((await f.kycFollowups(row.id)).records.length,1);await assert.rejects(f.kycFollowups(row.id,{...p,requestId:crypto.randomUUID()}),/只可查看/);user=owner;
});

test('completed followup exposes review capability only to assigned reviewer and never approves automatically',async()=>{
 const f=await mod('@/lib/kyc/followups');selected=A;user=owner;
 const row=await kyc.findCase(A,'customer-1');
 const saved=await f.kycFollowups(row.id,{status:'resolved',note:'Synthetic followup complete',requestId:crypto.randomUUID()});
 assert.equal(saved.canReview,true);assert.equal(saved.order.status,row.status);
 const reviewer=await member(A,'kyc','followup-reviewer@example.test',dept);
 const m=await team.staff();
 sql.prepare('UPDATE team_assignments SET reviewer_id=? WHERE tenant_id=? AND customer_id=?').run(m.member.id,A,row.customer_id);
 assert.equal((await f.kycFollowups(row.id)).canReview,true);
 user={userId:'correct',email:'pending@example.test'};assert.equal((await f.kycFollowups(row.id)).canReview,false);
 user=owner;assert.equal((await kyc.findCase(A,row.customer_id)).status,row.status);
});

test('Admin confirms KYC with complete checks and audit trail, but cannot amend or bypass validation',async()=>{
 selected=A;user=owner;
 let row=await kyc.findCase(A,'customer-1');
 row=await kyc.transition(row,'submitted',{profile:await profile(),phoneVerified:false,ruleVersion:'test'},'submit','customer-1');
 const p={id:row.id,revision:row.revision,decision:'approved',reason:'Synthetic admin manual review',checklist:Object.fromEntries(core.sections.map(s=>[s.id,true]))};
 await assert.rejects(kyc.decide(req({...p,checklist:{}})));
 await assert.rejects(kyc.decide(req({...p,action:'amend'})),/仅可确认/);
 await assert.rejects(kyc.decide(req({...p,decision:'rejected'})),/仅可确认/);
 selected=B;await assert.rejects(kyc.decide(req(p)));selected=A;
 const result=await kyc.decide(req(p));assert.equal(result.status,'approved');
 const stored=await kyc.payload(await kyc.findCase(A,'customer-1'));assert.equal(stored.review.actor,owner.userId);
 await assert.rejects(kyc.decide(req(p)),/资料已更新/);
});

test('registered account keeps the same KYC and linked orders across sessions and isolates other users',async()=>{
 const auth=await mod('@/lib/h5-auth-core'),f=await mod('@/lib/kyc/followups');
 selected=A;user=owner;const runtime={db:DB,config:{mode:'demo',secret:env.PAYEASE_AUTH_SECRET,allowDemo:true}},phone='+12025550991',browser='9'.repeat(64);
 const first=await auth.registerPhone(runtime,A,browser,{phone});
 const row=await kyc.initialize(A,first.session.customerId,false);
 runtime.now=()=>Date.now()+61000;
 const again=await auth.registerPhone(runtime,A,browser,{phone});
 assert.equal(first.session.customerId,again.session.customerId);
 assert.equal((await kyc.initialize(A,again.session.customerId,false)).id,row.id);
 runtime.now=()=>Date.now()+122000;
 const other=await auth.registerPhone(runtime,A,browser,{phone:'+12025550992'});
 assert.notEqual(other.session.customerId,first.session.customerId);
 const data=await f.kycFollowups(row.id);assert.equal(data.account.phone_mask,first.session.phoneMasked);assert.equal(data.loans.length,0);
 const existing=await kyc.findCase(A,'customer-1'),linked=await f.kycFollowups(existing.id);
 assert(linked.loans.some(l=>l.id===loanId));assert(!data.loans.some(l=>l.id===loanId));
 await assert.rejects(store.mutate(A,{action:'repay',loanId,amount:1,requestId:crypto.randomUUID()},{id:other.session.customerId,phoneMasked:other.session.phoneMasked}));
 selected=B;await assert.rejects(f.kycFollowups(row.id));selected=A;
});

test('service routing validates company, fills missing assignments and honors automatic switch',async()=>{
 const service=await mod('@/lib/team/servicing');selected=A;user=owner;
 await team.manage({action:'add_unit',kind:'institution',name:'Repayment service'});
 await team.manage({action:'add_unit',kind:'postloan',name:'Collection service'});
 const repay=sql.prepare("SELECT id FROM team_units WHERE tenant_id=? AND name='Repayment service'").get(A).id,collection=sql.prepare("SELECT id FROM team_units WHERE tenant_id=? AND name='Collection service'").get(A).id;
 const p={fundingId:inst,repaymentId:repay,collectionId:collection,enabled:true,version:-1};
 selected=B;await assert.rejects(service.servicingSave(p));selected=A;user=reviewer2;await assert.rejects(service.servicingSave(p));user=owner;
 await service.servicingSave(p);const a=await team.assignment(A,'customer-1');assert.equal(a.funding_institution_id,inst);assert.equal(a.repayment_institution_id,repay);assert.equal(a.collection_unit_id,collection);
 await assert.rejects(service.servicingSave(p),/配置已变化/);
 const foreign=sql.prepare('SELECT default_department FROM team_companies WHERE id=?').get(B).default_department;
 assert.throws(()=>sql.prepare('UPDATE team_assignments SET collection_unit_id=? WHERE tenant_id=?').run(foreign,A),/scope/);
 await service.servicingSave({...p,enabled:false,version:0});await team.ensureAssignment(A,'routing-off');assert.equal((await team.assignment(A,'routing-off')).funding_institution_id,null);
 await service.servicingSave({...p,enabled:true,version:1});assert.equal((await team.assignment(A,'routing-off')).funding_institution_id,inst);
});

test('Admin funding and repayment require prior approval, enforce isolation and deduplicate receipts; settlement closes collection',async()=>{
 selected=A;user=owner;const customerId='admin-funds-customer';await approvedCustomer(customerId);
 const c={id:customerId,phoneMasked:'SYNTHETIC'},created=await store.mutate(A,{action:'create',name:'SYNTHETIC ADMIN FUNDS',amount:5000,consent:true,requestId:crypto.randomUUID()},c),l=created.state.loans[0];
 const fund={action:'admin_disburse',loanId:l.id,note:'Synthetic admin funding evidence',requestId:crypto.randomUUID()};
 await assert.rejects(flow.staffAction(fund),/贷款初审/);
 await store.mutate(A,{action:'confirm_bill',loanId:l.id,billConfirmed:true,quoteId:l.billing.quoteId,requestId:crypto.randomUUID()},c);
 const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64'));
 await signing.saveLoanSignature(A,c.id,l.id,bytes);
 await store.mutate(A,{action:'apply',loanId:l.id,billConfirmed:true,quoteId:l.billing.quoteId,requestId:crypto.randomUUID()},c);
 sql.prepare('UPDATE team_assignments SET institution_id=? WHERE tenant_id=? AND customer_id=?').run(inst,A,c.id);
 user=lender;await flow.staffAction({action:'approve',loanId:l.id,requestId:crypto.randomUUID()});
 user=checker;await flow.staffAction({action:'approval_check',loanId:l.id,requestId:crypto.randomUUID()});
 user=reviewer2;await assert.rejects(flow.staffAction(fund));user=owner;selected=B;await assert.rejects(flow.staffAction(fund));selected=A;
 await assert.rejects(flow.staffAction({...fund,note:''}),/操作依据/);
 await flow.staffAction(fund);await flow.staffAction(fund);
 let saved=(await store.readState(A)).state;assert.equal(saved.loans.find(x=>x.id===l.id).status,'active');assert.equal(saved.entries.filter(e=>e.loanId===l.id&&e.kind==='测试放款').length,1);
 const receipt={action:'admin_repay',loanId:l.id,cents:1000,reference:'UAT-RECEIPT-001',note:'Synthetic receipt checked',requestId:crypto.randomUUID()};
 await flow.staffAction(receipt);await flow.staffAction({...receipt,requestId:crypto.randomUUID()});
 saved=(await store.readState(A)).state;assert.equal(saved.loans.find(x=>x.id===l.id).paid,1000);
 const emergency=await mod('@/lib/team/emergency'),verifiedRef='UAT-PROD-001',verifiedCents=500,ownerCookies=extraCookies;
 const emergencyRequest=await emergency.emergencyRequest({scope:['funding'],loanId:l.id,cents:verifiedCents,reason:'Synthetic verified receipt production-path check'});
 user={userId:'emergency-admin',email:'emergency-admin@example.test'};extraCookies=ownerCookies;await emergency.emergencyApprove(emergencyRequest.id);user=owner;extraCookies=ownerCookies;
 sql.prepare('INSERT INTO team_repayment_receipts(tenant_id,reference,loan_id,cents,actor,created_at,verified) VALUES (?,?,?,?,?,?,1)').run(A,verifiedRef,l.id,verifiedCents,'institution-verified',new Date().toISOString());
 const auth=await mod('@/lib/team/auth'),ownerMember=sql.prepare('SELECT id FROM team_members WHERE tenant_id=? AND user_id=?').get(A,owner.userId),ownerSession=await auth.createSsoSession(ownerMember.id,owner.userId);extraCookies=`; payease_staff_mode=sso; payease_staff_session=${ownerSession.token}; payease_staff_company=${A}`;
 env.KHMERX_TEST_MODE='false';
 try{await flow.staffAction({...receipt,cents:verifiedCents,reference:verifiedRef,emergencyId:emergencyRequest.id,requestId:crypto.randomUUID()});}
 finally{env.KHMERX_TEST_MODE='true';}
 saved=(await store.readState(A)).state;assert.equal(saved.loans.find(x=>x.id===l.id).paid,1500);
 await assert.rejects(flow.staffAction({...receipt,cents:1001,requestId:crypto.randomUUID()}),/流水号/);
 await assert.rejects(flow.staffAction({...receipt,cents:999999,reference:'UAT-TOO-MUCH',requestId:crypto.randomUUID()}),/还款金额/);
 const post=await mod('@/lib/postloan/server'),target=saved.loans.find(x=>x.id===l.id);
 await post.runCompany(A,new Date(Date.parse(target.dueAt)+86400000).toISOString());
 let task=(await post.postloanData()).tasks.find(t=>t.loanId===l.id);assert(task);assert.equal(task.departmentId,(await team.assignment(A,c.id)).collection_unit_id);
 await post.postloanAction({action:'note',taskId:task.id,version:task.updatedAt,requestId:crypto.randomUUID(),outcome:'contacted',note:'Synthetic Admin collection followup'});
 await flow.staffAction({...receipt,cents:target.amount+target.fee-1500,reference:'UAT-RECEIPT-002',requestId:crypto.randomUUID()});
 task=(await post.postloanData()).tasks.find(t=>t.loanId===l.id);assert.equal(task.status,'closed');assert.equal(task.balance,0);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM team_repayment_receipts WHERE tenant_id=? AND loan_id=?').get(A,l.id).n,3);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM team_repayment_ledger WHERE tenant_id=? AND loan_id=?').get(A,l.id).n,3);
});
test('independent staff password login, tenant scope, logout, expiry and disabled accounts',async()=>{
 selected=A;user=owner;extraCookies='';const auth=await mod('@/lib/team/auth');
 const created=await team.manage({action:'create_member',role:'lender',email:'password-lender@example.test',unitId:inst,passwordLogin:true});
 const d=created.loginDetails;assert(d.password.length>=24);const input={company:d.company,email:d.email,password:d.password};
 const m=sql.prepare('SELECT * FROM team_members WHERE tenant_id=? AND email=?').get(A,d.email);
 assert(m.user_id.startsWith('local:'));assert(!sql.prepare('SELECT password_hash FROM team_staff_credentials WHERE member_id=?').get(m.id).password_hash.includes(d.password));
 await assert.rejects(auth.passwordLogin({...input,password:'incorrect'},owner.userId),/不正确/);
 const login=await auth.passwordLogin(input,owner.userId);extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=${A}`;
 assert.equal((await team.staff()).member.id,m.id);assert.equal((await team.staff()).member.role,'lender');
 await assert.rejects(team.manage({action:'add_unit',name:'forbidden',kind:'institution'}));await assert.rejects(team.platformAdmin());
 // Shared gateway owner must not confer its Admin identity on the password user.
 extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=${B}`;
 await assert.rejects(team.staff(),/没有此公司/);assert.equal((await team.customerCompany()).id,A);
 extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=${A}`;
 await auth.logoutStaff(extraCookies);await assert.rejects(team.identity(),/失效/);
 extraCookies='; payease_staff_mode=out';await assert.rejects(team.identity(),/退出/);
 extraCookies='; payease_staff_mode=password';await assert.rejects(team.identity(),/失效/);
 extraCookies='';const next=await auth.passwordLogin(input,owner.userId);extraCookies=`; payease_staff_mode=password; payease_staff_session=${next.token}; payease_staff_company=${A}`;
 user={userId:'another-site-user',email:'another@example.test'};await assert.rejects(team.identity(),/失效/);user=owner;
 sql.prepare('UPDATE team_staff_sessions SET expires_at=0 WHERE member_id=?').run(m.id);await assert.rejects(team.identity(),/失效/);
 extraCookies='';const third=await auth.passwordLogin(input,owner.userId);extraCookies=`; payease_staff_mode=password; payease_staff_session=${third.token}; payease_staff_company=${A}`;
 sql.prepare('UPDATE team_members SET active=0,version=version+1 WHERE id=?').run(m.id);await assert.rejects(team.identity(),/失效/);
 extraCookies='';await assert.rejects(auth.passwordLogin(input,owner.userId),/不正确/);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM team_audit WHERE action='staff_login' AND actor=?").get(d.email).n,3);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM team_audit WHERE action='staff_logout' AND actor=?").get(d.email).n,1);
 extraCookies=`; payease_staff_mode=sso; payease_staff_company=${A}`;const revokeCreated=await team.manage({action:'create_member',role:'lender',email:'session-revoke@example.test',unitId:inst,passwordLogin:true});
 const revokeInput=revokeCreated.loginDetails, revokeMember=sql.prepare('SELECT * FROM team_members WHERE tenant_id=? AND email=?').get(A,revokeInput.email);
 const activeOne=await auth.passwordLogin(revokeInput,owner.userId),activeTwo=await auth.passwordLogin(revokeInput,owner.userId);assert(activeOne.token&&activeTwo.token);assert.equal(sql.prepare('SELECT COUNT(*) n FROM team_staff_sessions WHERE member_id=?').get(revokeMember.id).n,2);
 extraCookies=`; payease_staff_mode=sso; payease_staff_company=${A}`;await assert.rejects(team.manage({action:'revoke_member_sessions',memberId:revokeMember.id,reason:''}),/会话原因/);
 const revoked=await team.manage({action:'revoke_member_sessions',memberId:revokeMember.id,reason:'Synthetic security review'});assert.equal(revoked.revokedSessions,2);assert.equal(sql.prepare('SELECT COUNT(*) n FROM team_staff_sessions WHERE member_id=?').get(revokeMember.id).n,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM team_audit WHERE action='revoke_member_sessions'").get().n,1);
 for(let i=0;i<5;i++)await assert.rejects(auth.passwordLogin({company:'synthetic-a',email:'missing@example.test',password:'wrong'},owner.userId),/不正确/);
 await assert.rejects(auth.passwordLogin({company:'synthetic-a',email:'missing@example.test',password:'wrong'},owner.userId),/尝试过多/);
});

test('staff auth HTTP logout, SSO choice, same-origin and company entry enforcement',async()=>{
 selected=A;user=owner;extraCookies='';const route=await mod('@/app/api/team/auth/route'),api=await mod('@/app/api/team/route');
 const make=(p,origin='http://localhost')=>new Request('http://localhost/api/team/auth',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(p)});
 const out=await route.POST(make({action:'logout'}));assert.equal(out.status,200);assert.match(out.headers.get('set-cookie'),/payease_staff_mode=out/);assert(!out.headers.get('set-cookie').includes('payease_h5_session'));
 assert.equal((await route.POST(make({action:'sso'},'https://evil.invalid'))).status,403);
 assert.equal((await route.POST(make({action:'sso'}))).status,200);env.KHMERX_TEST_MODE='false';extraCookies='';assert.equal((await api.GET()).status,401);env.KHMERX_TEST_MODE='true';
 user=lender;assert.equal((await api.POST(make({action:'enter',slug:'synthetic-b'}))).status,403);
 user=owner;extraCookies='';
});

test('service and lender portal selection enforces reviewer-only access',async()=>{
 selected=A;user=owner;extraCookies='';const auth=await mod('@/lib/team/auth');
 const checkerCreated=await team.manage({action:'create_member',role:'checker',email:'portal-checker@example.test',unitId:inst,passwordLogin:true});
 const financeCheckerCreated=await team.manage({action:'create_member',role:'finance_checker',email:'portal-finance-checker@example.test',unitId:inst,passwordLogin:true});
 const lenderCreated=await team.manage({action:'create_member',role:'lender',email:'portal-lender@example.test',unitId:inst,passwordLogin:true});
 const financeCreated=await team.manage({action:'create_member',role:'finance',email:'portal-finance@example.test',unitId:inst,passwordLogin:true});
 const serviceCreated=await team.manage({action:'create_member',role:'kyc',email:'portal-service@example.test',unitId:dept,passwordLogin:true});
 assert.equal((await auth.passwordLogin({...checkerCreated.loginDetails,portal:'lender'},owner.userId)).portal,'lender');
 assert.equal((await auth.passwordLogin({...financeCheckerCreated.loginDetails,portal:'lender'},owner.userId)).portal,'lender');
 await assert.rejects(auth.passwordLogin({...checkerCreated.loginDetails,portal:'business'},owner.userId),/不属于服务机构后台/);
 await assert.rejects(auth.passwordLogin({...financeCheckerCreated.loginDetails,portal:'business'},owner.userId),/不属于服务机构后台/);
 await assert.rejects(auth.passwordLogin({...lenderCreated.loginDetails,portal:'lender'},owner.userId),/持牌机构复核/);
 await assert.rejects(auth.passwordLogin({...financeCreated.loginDetails,portal:'lender'},owner.userId),/持牌机构复核/);
 await assert.rejects(auth.passwordLogin({...serviceCreated.loginDetails,portal:'lender'},owner.userId),/持牌机构复核/);
});

test('existing SSO Admin can use company password without inheriting other companies or platform access',async()=>{
 selected=A;user=owner;extraCookies='';const auth=await mod('@/lib/team/auth');
 const m=sql.prepare('SELECT id FROM team_members WHERE tenant_id=? AND user_id=?').get(A,owner.userId);
 const password='Synthetic-Admin-Password-Only';await sql.prepare('INSERT INTO team_staff_credentials(member_id,password_hash) VALUES (?,?)').run(m.id,await auth.makePassword(password));
 const login=await auth.passwordLogin({company:'synthetic-a',email:owner.email,password},owner.userId);
 extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=${A}`;
 assert.equal((await team.staff()).member.role,'admin');assert.equal((await team.teamData()).memberships.length,1);await assert.rejects(team.platformAdmin());
 const api=await mod('@/app/api/team/route');assert.equal((await api.POST(new Request('http://localhost/api/team',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action:'enter',slug:'synthetic-b'})}))).status,403);
 extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=${B}`;await assert.rejects(team.staff(),/没有此公司/);
 extraCookies=`; payease_staff_mode=password; payease_staff_session=${login.token}; payease_staff_company=none`;await assert.rejects(team.staff(),/请选择/);
 await auth.logoutStaff(extraCookies);await assert.rejects(team.identity(),/失效/);extraCookies='';assert.equal((await team.staff()).member.role,'admin');await team.platformAdmin();
});

test('SSO staff memberships remain switchable across companies without widening password sessions',async()=>{
 selected=A;user=owner;extraCookies='';const auth=await mod('@/lib/team/auth'),api=await mod('@/app/api/team/route');
 const session=await auth.createSsoSession(sql.prepare('SELECT id FROM team_members WHERE tenant_id=? AND user_id=?').get(A,owner.userId).id,owner.userId);
 extraCookies=`; payease_staff_mode=sso; payease_staff_session=${session.token}; payease_staff_company=${A}`;
 const data=await team.teamData();assert(data.memberships.length>=2);assert(data.memberships.some((m)=>m.tenant_id===A));assert(data.memberships.some((m)=>m.tenant_id===B));
 const entered=await api.POST(new Request('http://localhost/api/team',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action:'enter',slug:'synthetic-b'})}));assert.equal(entered.status,200);
 extraCookies=`; payease_staff_mode=sso; payease_staff_session=${session.token}; payease_staff_company=${B}`;selected=B;assert.equal((await team.staff()).tenant.id,B);assert.equal((await team.teamData()).company.id,B);
 await auth.logoutStaff(extraCookies);selected=A;extraCookies='';
});

test('team payload redacts MFA secret fields',async()=>{
 selected=A;user=owner;extraCookies='';
 const data=await team.teamData();
 assert.equal(Object.hasOwn(data.member||{},'mfa_secret'),false);
 assert.equal(Object.hasOwn(data.member||{},'pending_mfa_secret'),false);
 for(const membership of data.memberships||[]){
  assert.equal(Object.hasOwn(membership,'mfa_secret'),false);
  assert.equal(Object.hasOwn(membership,'pending_mfa_secret'),false);
 }
});

test('state mutation rejects non-JSON and malformed envelopes',async()=>{
 const api=await mod('@/app/api/state/route');selected='';user=owner;extraCookies='';
 const wrongType=await api.POST(new Request('http://localhost/api/state',{method:'POST',headers:{origin:'http://localhost','content-type':'text/plain'},body:'{}'}));
 assert.equal(wrongType.status,415);assert.equal((await wrongType.json()).code,'INVALID_REQUEST');
 const malformed=await api.POST(new Request('http://localhost/api/state',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'[]'}));
 assert.equal(malformed.status,400);assert.equal((await malformed.json()).code,'INVALID_REQUEST');
});

test('KYC encryption envelope carries key id and survives active-key rotation',async()=>{
 const previous=env.KYC_DATA_KEY_ID;
 try{
  env.KYC_DATA_KEY_ID='qa-key-a';const plain=Uint8Array.from([7,11,19,23]),encrypted=await kyc.encryptBytes(plain,'qa:file:context');
  assert.equal(encrypted[0],0x4b);assert.equal(encrypted[1],0x02);
  const keyLength=encrypted[2];assert.equal(new TextDecoder().decode(encrypted.slice(3,3+keyLength)),'qa-key-a');
  assert.deepEqual(Array.from(await kyc.decryptBytes(encrypted,'qa:file:context')),Array.from(plain));
  env.KYC_DATA_KEY_ID='qa-key-b';assert.deepEqual(Array.from(await kyc.decryptBytes(encrypted,'qa:file:context')),Array.from(plain));
 }finally{if(previous===undefined)delete env.KYC_DATA_KEY_ID;else env.KYC_DATA_KEY_ID=previous;}
});

test('invite binding cannot create non-admin SSO without MFA',async()=>{
 const auth=await mod('@/app/api/team/auth/route');const memberId='invite-mfa-'+crypto.randomUUID(),email='invite-mfa@example.test',token='invite-token-qa';
 sql.prepare("INSERT INTO team_members (id,tenant_id,user_id,email,role,active,version,mfa_enabled) VALUES (?,?,?,?,?,1,0,0)").run(memberId,A,'pending:invite-mfa',email,'ops');
 const issuer=sql.prepare('SELECT id FROM team_members WHERE tenant_id=? AND user_id=?').get(A,'owner').id;
 sql.prepare("INSERT INTO team_invites (token_hash,tenant_id,email,role,unit_id,issuer,expires_at,used) VALUES (?,?,?,?,?,?,?,0)").run(await (await mod('@/lib/h5-auth-core')).digest(token),A,email,'ops',null,issuer,Date.now()+3600000);
 user={userId:'invite-mfa-user',email};selected='';extraCookies='';
 const response=await auth.POST(new Request('http://localhost/api/team/auth',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action:'bind_invite',company:'synthetic-a',inviteToken:token,portal:'business'})}));
 assert.equal(response.status,403);assert.equal((await response.json()).code,'MFA_REQUIRED_FOR_INVITE');
 user=owner;
});
