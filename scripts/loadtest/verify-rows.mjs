import {request as httpsRequest} from 'node:https';
import {readFileSync,writeFileSync,appendFileSync,readdirSync,mkdirSync,unlinkSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {request as httpRequest} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {Miniflare} from 'miniflare';
import {check,plan,prepare,target,validateManifest} from './fixture/core.mjs';
import {writer,privateFile} from './fixture/private-file.mjs';
import {cleanup} from './fixture/cleanup.mjs';
import {preflight,rowsTarget,grayLabel,declaredScales} from './rows-preflight.mjs';
import {analyze} from './analyze-rows.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),label='本地 harness，非灰度、非 600 客户实测';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function api(m,c,input,owner=m.target.tenantId,timeoutMs=15000){
 const transport=rowsTarget(m,m.target.baseUrl,process.env);
 if(transport.insecureSkipTLSVerify)return grayRequest(m,c,input,owner,timeoutMs);
 const response=await fetch(m.target.baseUrl+'/api/h5/state',{method:input?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{Origin:m.target.baseUrl,'Content-Type':'application/json','X-Request-Id':randomUUID(),Cookie:`payease_company=${owner}; payease_h5_session=${c.sessionToken}`,'oai-authenticated-user-id':'synthetic-rows-runner','oai-authenticated-user-email':'synthetic-rows@example.test'},...(input?{body:JSON.stringify(input)}:{})});
 return {status:response.status,body:await response.json()};
}
function grayRequest(m,c,input,owner,timeoutMs,drop=false){
 const transport=rowsTarget(m,m.target.baseUrl,process.env);check(transport.insecureSkipTLSVerify,'Gray transport required');
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(m.target.baseUrl+'/api/h5/state',{method:input?'POST':'GET',rejectUnauthorized:false,family:4,autoSelectFamily:false,lookup:(_host,_options,done)=>done(null,process.env.ORIGIN_IP,4),headers:{Origin:m.target.baseUrl,'Content-Type':'application/json','X-Request-Id':randomUUID(),Cookie:`payease_company=${owner}; payease_h5_session=${c.sessionToken}`}},res=>{
   if(drop){res.destroy();resolve();return}let text='';res.setEncoding('utf8');res.on('data',s=>text+=s);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(text)})}catch{reject(Error('Invalid gray JSON response'))}});res.on('error',reject);
  });
  if(drop)req.on('finish',()=>setImmediate(()=>{req.destroy();resolve()}));req.on('error',drop?()=>resolve():reject);req.setTimeout(timeoutMs,()=>req.destroy(Error('Gray request timed out')));req.end(input?JSON.stringify(input):undefined);
 });
}
export function databaseEvidence(raw,m){
 const keys=['customer_workspaces','loan_index','legacyLoans','assignments','audit','modeMatches','uniqueOps','foreignCustomers','assignmentsMatch'];
  check(Object.keys(raw).length===keys.length&&keys.every(k=>Object.hasOwn(raw,k)&&(k.endsWith('Match')||['modeMatches','uniqueOps','foreignCustomers'].includes(k)?typeof raw[k]==='boolean':Number.isSafeInteger(raw[k])&&raw[k]>=0)),'Invalid sanitized db-check artifact');
 const n=m.customers.length,on=m.target.customerRows==='on';check(raw.assignments===n&&raw.audit===n&&(on?raw.customer_workspaces===n&&raw.loan_index===n&&raw.legacyLoans===0:raw.customer_workspaces===0&&raw.loan_index===0&&raw.legacyLoans===n),'Database counts do not match manifest');return raw;
}
export async function verify({main,aux,wrongOwner,timeout,database,dbCheckFile,scales}){
 const gray=main.target.profile==='gray-config';if(gray)scales=declaredScales(scales);
 for(const m of [main,aux,wrongOwner,timeout]){rowsTarget(m,m.target.baseUrl,process.env);validateManifest(m);check(m.target.baseUrl===main.target.baseUrl&&m.target.profile===main.target.profile&&m.target.env===main.target.env&&m.target.customerRows===main.target.customerRows,'Verification target mismatch')}
 const result={label:gray?grayLabel+'; '+main.target.baseUrl+' → '+process.env.ORIGIN_IP+'; '+JSON.stringify(scales)+'; CUSTOMER_ROWS='+main.target.customerRows+'; synthetic fixture：非 Telegram 注册、非认证压测':label,scene:'rows',runId:main.runId,checks:{},mismatches:0,customers:main.customers.length};
 const loaded=[];
 for(const c of main.customers){const r=await api(main,c),loans=r.body.state?.loans;const valid=r.status===200&&loans?.length===1&&loans[0].customerId===c.customerId&&loans[0].status==='kyc_approved'&&!!loans[0].billConfirmedAt;if(!valid)result.mismatches++;loaded.push(r)}
 result.checks.readback=result.mismatches===0;
 result.checks.expiredAndRevoked=true;for(const c of aux.customers){const r=await api(aux,c);if(r.status!==401||r.body.code!=='AUTH_REQUIRED')result.checks.expiredAndRevoked=false}
 const a=main.customers[0],loan=loaded[0]?.body.state?.loans?.[0],b=main.customers[1];
 const bill=(id,quote,requestId)=>({action:'confirm_bill',role:'mini',loanId:id,billConfirmed:true,quoteId:quote,requestId});
 const create=c=>({action:'create',role:'mini',amount:5000,name:'SYNTH '+c.index,consent:true,termDays:14,requestId:`${main.runId}-${c.index}-create`});
 result.checks.crossCustomer=!!b&&!!loan&&(await api(main,b,bill(loan.id,loan.billing.quoteId,'synthetic-cross-customer'))).status===404;
 const wrong=await api(main,a,undefined,wrongOwner.target.tenantId);result.checks.wrongOwner=wrong.status===401&&wrong.body.code==='AUTH_REQUIRED';
 const replay=await api(main,a,create(a)),after=await api(main,a);result.checks.createReplay=replay.status===409&&replay.body.code==='CONFLICT'&&String(replay.body.error||'').includes('请先完成当前申请')&&after.body.revision===loaded[0].body.revision&&after.body.state?.loans?.length===1;
 if(loan){const r=await api(main,a,bill(loan.id,loan.billing.quoteId,`${main.runId}-${a.index}-bill`));const again=await api(main,a);result.billReplay={status:r.status,beforeRevision:after.body.revision,afterRevision:again.body.revision,billTimeUnchanged:again.body.state?.loans?.[0]?.billConfirmedAt===loan.billConfirmedAt};result.checks.billReplay=r.status===200&&again.body.revision===after.body.revision&&again.body.state?.loans?.[0]?.billConfirmedAt===loan.billConfirmedAt}else result.checks.billReplay=false;
 result.checks.timeoutReplay=true;result.timeoutResults=[];
 for(const c of timeout.customers){
  const payload={...create(c),requestId:`${timeout.runId}-${c.index}-create`};
  if(gray)await grayRequest(timeout,c,payload,timeout.target.tenantId,15000,true);else await new Promise(resolve=>{const req=httpRequest(timeout.target.baseUrl+'/api/h5/state',{method:'POST',headers:{'X-Request-Id':randomUUID(),Origin:timeout.target.baseUrl,'Content-Type':'application/json',Cookie:`payease_company=${timeout.target.tenantId}; payease_h5_session=${c.sessionToken}`,'oai-authenticated-user-id':'synthetic-rows-runner','oai-authenticated-user-email':'synthetic-rows@example.test'}},res=>{res.destroy();resolve()});req.on('finish',()=>setImmediate(()=>{req.destroy();resolve()}));req.on('error',()=>resolve());req.setTimeout(15000,()=>{req.destroy();resolve()});req.end(JSON.stringify(payload))});
  let found;const deadline=Date.now()+10000;while(Date.now()<deadline){found=await api(timeout,c,undefined,timeout.target.tenantId,Math.max(1,deadline-Date.now()));if(found.body.state?.loans?.length)break;await delay(Math.min(500,Math.max(0,deadline-Date.now())))}
  const committed=found.body.state?.loans?.length===1,repeated=await api(timeout,c,payload),state=await api(timeout,c);result.timeoutResults.push({index:c.index,committedBeforeReplay:committed,status:repeated.status,category:committed&&state.body.state?.loans?.length===1?'create_ok_after_replay':'create_missing'});if(!committed||![200,409].includes(repeated.status)||state.body.state?.loans?.length!==1||state.body.state.loans[0].customerId!==c.customerId)result.checks.timeoutReplay=false;
 }
 if(gray){
  const raw=databaseEvidence(JSON.parse(readFileSync(dbCheckFile,'utf8')),main);
  result.database={...raw};result.databaseEvidence='operator-supplied db-check JSON';result.checks.database=raw.modeMatches&&raw.uniqueOps&&!raw.foreignCustomers&&raw.assignmentsMatch;
 }else{const db=new DatabaseSync(database,{readOnly:true});try{
  const owner=main.target.tenantId,n=main.customers.length,count=(table,col='owner')=>db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${col}=?`).get(owner).n;
  const old=JSON.parse(db.prepare('SELECT payload FROM demo_workspaces WHERE owner=?').get(owner).payload).loans;
  result.database={mode:main.target.customerRows,customerRows:count('customer_workspaces'),loanIndex:count('loan_index'),legacyLoans:old.length,assignments:count('team_assignments','tenant_id'),audit:count('team_audit','tenant_id'),wrongDepartment:db.prepare('SELECT COUNT(*) n FROM team_assignments WHERE tenant_id=? AND department_id<>?').get(owner,main.opsDepartmentId).n};
  const d=result.database;result.checks.database=main.target.customerRows==='on'?d.customerRows===n&&d.loanIndex===n&&d.legacyLoans===0:d.customerRows===0&&d.legacyLoans===n;
  result.checks.database&&=d.assignments===n&&d.audit===n&&d.wrongDepartment===0;
 }finally{db.close()}}
 result.pass=Object.values(result.checks).every(Boolean);return result;
}
async function child(cmd,args,env,log){
 return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});writeFileSync(log,'');p.stdout.on('data',b=>appendFileSync(log,b));p.stderr.on('data',b=>appendFileSync(log,b));p.on('error',reject);p.on('close',code=>{resolve(code)})});
}
export async function localAcceptance(mode,count=50){
 check(['off','on'].includes(mode)&&Number.isSafeInteger(count)&&count>=2&&count<=50,'Local acceptance is limited to 2..50 clients');
 check(process.env.K6_BIN,'K6_BIN must name the installed k6 binary');
 process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';
 const run='rows-'+mode+'-'+Date.now(),baseUrl='http://127.0.0.1:8796',state=join(root,'.wrangler/state',run),reports=join(root,'scripts/loadtest/reports');mkdirSync(state,{recursive:true});mkdirSync(reports,{recursive:true});
 const bindings={PAYEASE_ENV:'local',KHMERX_TEST_MODE:'true',PAYEASE_AUTH_MODE:'demo',PAYEASE_AUTH_SECRET:randomBytes(32).toString('hex'),KYC_DATA_SECRET:randomBytes(32).toString('hex'),CUSTOMER_ROWS:mode,PAYEASE_LIMIT_SCALE:'1',PAYEASE_GATEWAY_RATE_SCALE:'1'};
 const moduleRoot=join(root,'dist/server'),modules=['index.js',...readdirSync(moduleRoot,{recursive:true}).filter(n=>/\.m?js$/.test(n)&&n!=='index.js')].map(n=>({type:'ESModule',path:join(moduleRoot,n)}));
 const config={host:'localhost',bindings},mf=new Miniflare({cf:false,modules,modulesRoot:moduleRoot,assets:{directory:join(root,'dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:8796,bindings,d1Databases:{DB:'00000000-0000-4000-8000-000000000000'},d1Persist:state,r2Buckets:{BUCKET:'synthetic-rows'},r2Persist:join(state,'r2')});
 const prepared=[];let database;
 try{
  console.log('Local Worker: starting');await Promise.race([mf.ready,delay(20000).then(()=>{throw Error('Local Worker startup timeout')})]);console.log('Local Worker: ready');await (await mf.getD1Database('DB')).prepare('SELECT 1').first();console.log('Local D1: ready');
  const files=[];function scan(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())scan(p);else if(name.endsWith('.sqlite')&&name!=='metadata.sqlite')files.push(p)}}scan(state);check(files.length===1,'Local D1 identity ambiguous');database=files[0];
  const db=new DatabaseSync(database);try{db.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(join(root,'drizzle',name),'utf8'))}finally{db.close()}
  const options={root,config,profile:'local-harness',baseUrl,database};target(options);
  for(const dataset of ['smoke','main','timeout','aux','wrong-owner']){
   const o={...options,runId:run+'-'+dataset,dataset,...(dataset==='main'?{count}:{})},file=join(root,'scripts/loadtest/manifests',o.runId+'.manifest.json'),output=writer(root,file);
   let m;try{m=prepare({...o,apply:true,confirm:plan(o).fingerprint,persist:output.persist}).manifest}catch(e){output.rollback();throw e}prepared.push({m,file});
  }
  const manifests=Object.fromEntries(prepared.map(x=>[x.m.dataset,x]));
  const gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),k6Version=execFileSync(process.env.K6_BIN,['version'],{encoding:'utf8'}).trim();
  for(const dataset of ['smoke','main']){
   const {m,file}=manifests[dataset],vus=m.customers.length,prefix=join(reports,run+'-'+dataset);preflight(m,{vus,baseUrl,mode,dataset},file);
   const env={ROWS_MANIFEST:file,BASE_URL:baseUrl,VUS:String(vus),START_AT:String(Date.now()+15000),ROWS_SUMMARY:prefix+'-summary.json',GIT_HEAD:gitHead,K6_CSV_TIME_FORMAT:'unix_nano'};
   const code=await child(process.env.K6_BIN,['run','--out','csv='+prefix+'.csv','scripts/loadtest/rows-flow.js'],env,prefix+'.log');check(code===0,'k6 failed; inspect local log');
   const summary=JSON.parse(readFileSync(prefix+'-summary.json')),report=analyze(readFileSync(prefix+'.csv','utf8'),summary);report.k6Version=k6Version;report.runtime={PAYEASE_ENV:'local',PAYEASE_AUTH_MODE:'demo',CUSTOMER_ROWS:mode,PAYEASE_LIMIT_SCALE:1,PAYEASE_GATEWAY_RATE_SCALE:1};report.baseUrl=baseUrl;writeFileSync(prefix+'.json',JSON.stringify(report,null,2));
   if(dataset==='smoke')check(summary.counts.completed===3,'Smoke failed; main clients not consumed');
  }
  const verification=await verify({main:manifests.main.m,aux:manifests.aux.m,wrongOwner:manifests['wrong-owner'].m,timeout:manifests.timeout.m,database});
  verification.gitHead=gitHead;verification.runId=run;const final=JSON.parse(readFileSync(join(reports,run+'-main-summary.json')));verification.checks.allPlannedCustomers=Object.values(final.counts).reduce((a,b)=>a+b,0)===count&&final.counts.completed+final.counts.create_ok_after_replay===count;verification.pass&&=verification.checks.allPlannedCustomers;writeFileSync(join(reports,run+'-verification.json'),JSON.stringify(verification,null,2));
  console.log(label);console.log(JSON.stringify({run,mode,pass:verification.pass,checks:verification.checks,mismatches:verification.mismatches}));return verification;
 }finally{
  await mf.dispose();
  for(const {m,file}of prepared){const o={root,config,profile:'local-harness',baseUrl,database};const p=cleanup(o,m),report=cleanup({...o,apply:true,confirm:p.fingerprint},m);writeFileSync(join(reports,m.runId+'-cleanup.json'),JSON.stringify({label,runId:m.runId,applied:report.applied,before:report.before,after:report.after,tombstone:report.tombstone,retainedAudit:report.retainedAudit,externalBefore:report.externalBefore,externalAfter:report.externalAfter},null,2));unlinkSync(file)}
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv[2]==='--gray'){
  const [main,aux,wrong,timeout,dbCheckFile,output,flag,scales]=process.argv.slice(3);check(flag==='--declared-scales','Declare actual scales');const load=file=>{privateFile(file);return JSON.parse(readFileSync(file,'utf8'))};const result=await verify({main:load(main),aux:load(aux),wrongOwner:load(wrong),timeout:load(timeout),dbCheckFile,scales});writeFileSync(output,JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
 }else if(process.argv[2]==='--local-acceptance'){const result=await localAcceptance(process.argv[3],Number(process.argv[4]||50));if(!result.pass)process.exitCode=1}else{
  const [main,aux,wrong,timeout,database,output]=process.argv.slice(2),load=file=>{privateFile(file);return JSON.parse(readFileSync(file,'utf8'))};const result=await verify({main:load(main),aux:load(aux),wrongOwner:load(wrong),timeout:load(timeout),database});writeFileSync(output,JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
 }}catch{console.error('Local rows verification failed; inspect sanitized reports. No production or gray execution authorized.');process.exitCode=1}
}
