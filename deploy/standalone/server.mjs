import {Miniflare} from 'miniflare';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHmac,timingSafeEqual,pbkdf2Sync} from 'node:crypto';
import {Readable} from 'node:stream';
const moduleRoot='/app/dist/server';
// macOS AppleDouble resource-fork files (._*.js) are not JavaScript. Exclude
// them so a copied release cannot make the Workers runtime fail at boot.
const modulePaths=readdirSync(moduleRoot,{recursive:true}).filter(n=>/\.m?js$/.test(n)&&!n.split('/').some(part=>part.startsWith('._')));
const modules=['index.js',...modulePaths.filter(n=>n!=='index.js')].map(n=>({type:'ESModule',path:moduleRoot+'/'+n}));
const buildId=existsSync(moduleRoot+'/BUILD_ID')?readFileSync(moduleRoot+'/BUILD_ID','utf8').trim():'unknown';
const cfg=JSON.parse(readFileSync('/data/config.json','utf8'));
// Keep the scanner credential outside the broad /data bind mount.  The
// scanner gateway runs as nobody, while /data is intentionally root-only.
// A dedicated secret mount lets the gateway enforce authorization without
// widening access to the database/object-store files in /data.
const scannerTokenPath=process.env.SCANNER_TOKEN_PATH||'/data/scanner-token';
writeFileSync(scannerTokenPath,String(cfg.bindings?.KYC_SCAN_TOKEN||''),{mode:0o640});
if(cfg.bindings?.KHMERX_TEST_MODE==='true')throw new Error('KHMERX_TEST_MODE must be disabled for standalone production boot');
if(cfg.bindings?.PAYEASE_IDENTITY_PROOF_REQUIRED!==undefined&&cfg.bindings.PAYEASE_IDENTITY_PROOF_REQUIRED!=='true')throw new Error('PAYEASE_IDENTITY_PROOF_REQUIRED must be true for standalone production boot');
const mf=new Miniflare({modules,modulesRoot:moduleRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],assets:{directory:'/app/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{DB:'payease'},d1Persist:'/data/d1',r2Buckets:{BUCKET:'payease'},r2Persist:'/data/r2',bindings:cfg.bindings,host:'127.0.0.1'});
const db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS standalone_migrations (name TEXT PRIMARY KEY)').run();
function splitSql(sql){const statements=[],push=current=>{const text=current.trim();if(text&&text.replace(/--[^\n]*/g,'').trim())statements.push(text)};let current='',quote=false,blockDepth=0;const wordAt=(i)=>{const m=sql.slice(i).match(/^[A-Za-z]+/);return m?m[0].toUpperCase():''};for(let i=0;i<sql.length;i++){const ch=sql[i];if(ch==="'"){if(quote&&sql[i+1]==="'"){current+=ch+sql[++i];continue}quote=!quote;current+=ch;continue}if(!quote){const word=wordAt(i);if(word==='BEGIN'){blockDepth++;current+=sql.slice(i,i+word.length);i+=word.length-1;continue}if(word==='END'){blockDepth=Math.max(0,blockDepth-1);current+=sql.slice(i,i+word.length);i+=word.length-1;continue}}if(ch===';'&&!quote&&blockDepth===0){push(current);current='';continue}current+=ch}push(current);return statements}
const migrationFiles=readdirSync('/app/drizzle').filter(n=>/^\d.*\.sql$/.test(n)).sort();
const migrationNames=new Set(migrationFiles);
const appliedMigrations=await db.prepare('SELECT name FROM standalone_migrations').all();
const migrationNumbers=new Set(migrationFiles.map(name=>name.match(/^\d+/)?.[0]).filter(Boolean));
const appliedNames=new Set((appliedMigrations.results||[]).map(row=>String(row.name)));
const appliedNumbers=new Set([...appliedNames].map(name=>name.match(/^\d+/)?.[0]).filter(Boolean));
const unknownMigrations=[...appliedNames].filter(name=>!migrationNames.has(name)&&!migrationNumbers.has(name.match(/^\d+/)?.[0]));
if(unknownMigrations.length)throw new Error(`Unknown standalone migrations: ${unknownMigrations.join(',')}`);
for(const name of migrationFiles){
 if(appliedNames.has(name)||appliedNumbers.has(name.match(/^\d+/)?.[0]))continue;
 const parts=splitSql(readFileSync('/app/drizzle/'+name,'utf8'));
 await db.batch([...parts.map(s=>db.prepare(s)),db.prepare('INSERT INTO standalone_migrations VALUES (?)').bind(name)]);
}
// Public references are operator-facing aliases. Historical rows may predate
// the alias columns, so backfill them on boot in an idempotent transaction-like
// sequence while preserving every internal UUID/hash and JSON payload field.
const PUBLIC_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const dateValue=value=>{if(typeof value==='number'&&Number.isFinite(value))return new Date(value<1e12?value*1000:value);const text=String(value??'').trim();if(/^\d{10,13}$/.test(text)){const number=Number(text);return new Date(text.length===10?number*1000:number)}return new Date(value)};
const publicDate=value=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dateValue(value));const get=t=>parts.find(p=>p.type===t)?.value||'';return get('year').slice(-2)+get('month')+get('day')};
const publicRef=(entity,channel,at)=>{let random='';while(random.length<7){for(const byte of randomBytes(32)){if(byte>=224)continue;random+=PUBLIC_ALPHABET[byte&31];if(random.length===7)break;}}return entity+channel+publicDate(at)+random};
async function claimPublicRef(entity,channel,internalId,tenantId,at){
 const found=await db.prepare('SELECT ref FROM public_identifiers WHERE entity_type=? AND internal_id=?').bind(entity,internalId).first();
 if(found?.ref)return String(found.ref);
 for(let attempt=0;attempt<6;attempt++){
  const ref=publicRef(entity,channel,at);
  try{const result=await db.prepare('INSERT INTO public_identifiers (ref,entity_type,internal_id,tenant_id,source_channel,created_at) VALUES (?,?,?,?,?,?)').bind(ref,entity,internalId,tenantId||null,channel,dateValue(at).toISOString()).run();if(result.meta.changes===1)return ref}catch(error){const retry=await db.prepare('SELECT ref FROM public_identifiers WHERE entity_type=? AND internal_id=?').bind(entity,internalId).first();if(retry?.ref)return String(retry.ref);if(attempt===5)throw error;}
 }
 throw new Error('public reference backfill failed');
}
const channelFor=(mode,channelId)=>mode==='telegram'?'TG':mode==='demo'?'H5':String(channelId||'').startsWith('api')?'IN':'SY';
async function backfillPublicIdentifiers(){
 let customers=0,kycs=0,files=0,tickets=0,audits=0,workspaces=0;
 const accountRows=(await db.prepare('SELECT customer_id,owner,mode,channel_id,customer_ref,source_channel,created_at FROM h5_accounts').all()).results||[];
 const accountMap=new Map();
 for(const row of accountRows){const channel=row.source_channel||channelFor(row.mode,row.channel_id),ref=await claimPublicRef('C',channel,row.customer_id,row.owner,row.created_at||new Date().toISOString());if(row.customer_ref!==ref||row.source_channel!==channel){await db.prepare('UPDATE h5_accounts SET customer_ref=?,source_channel=? WHERE owner=? AND customer_id=?').bind(ref,channel,row.owner,row.customer_id).run();customers++;}accountMap.set(row.owner+'|'+row.customer_id,channel)}
 for(const row of (await db.prepare('SELECT id,owner,customer_id,public_ref,source_channel,updated_at FROM kyc_cases').all()).results||[]){const channel=accountMap.get(row.owner+'|'+row.customer_id)||'SY',ref=await claimPublicRef('K',channel,row.id,row.owner,row.updated_at||new Date().toISOString());if(row.public_ref!==ref||row.source_channel!==channel){await db.prepare('UPDATE kyc_cases SET public_ref=?,source_channel=? WHERE id=? AND owner=?').bind(ref,channel,row.id,row.owner).run();kycs++;}}
 for(const row of (await db.prepare('SELECT id,owner,customer_id,public_ref,source_channel,created_at FROM kyc_files').all()).results||[]){const channel=accountMap.get(row.owner+'|'+row.customer_id)||'SY',ref=await claimPublicRef('F',channel,row.id,row.owner,row.created_at||new Date().toISOString());if(row.public_ref!==ref||row.source_channel!==channel){await db.prepare('UPDATE kyc_files SET public_ref=?,source_channel=? WHERE id=? AND owner=?').bind(ref,channel,row.id,row.owner).run();files++;}}
 for(const row of (await db.prepare('SELECT id,tenant_id,public_ref,source_channel,created_at FROM team_service_tickets').all()).results||[]){const ref=await claimPublicRef('T','AD',row.id,row.tenant_id,row.created_at||new Date().toISOString());if(row.public_ref!==ref||row.source_channel!=='AD'){await db.prepare('UPDATE team_service_tickets SET public_ref=?,source_channel=? WHERE id=? AND tenant_id=?').bind(ref,'AD',row.id,row.tenant_id).run();tickets++;}}
 // team_audit is append-only by database trigger. For historical rows keep the
 // original audit record untouched and store the operator-facing alias only in
 // the public_identifiers mapping table; new audit writes may populate columns.
 for(const row of (await db.prepare('SELECT id,tenant_id,actor,created_at FROM team_audit').all()).results||[]){const channel=row.actor==='system'?'SY':'AD';await claimPublicRef('A',channel,row.id,row.tenant_id,row.created_at||new Date().toISOString());audits++;}
 for(const row of (await db.prepare('SELECT owner,revision,payload FROM demo_workspaces').all()).results||[]){let state;try{state=JSON.parse(String(row.payload))}catch{continue}let changed=false;for(const loan of Array.isArray(state.loans)?state.loans:[]){const channel=loan.sourceChannel||accountMap.get(row.owner+'|'+String(loan.customerId||''))||'SY',order=await claimPublicRef('O',channel,loan.id,row.owner,loan.createdAt||new Date().toISOString());if(loan.publicRef!==order||loan.sourceChannel!==channel){loan.publicRef=order;loan.sourceChannel=channel;changed=true}if(loan.billing){const bill=await claimPublicRef('B',channel,loan.id+':bill',row.owner,loan.createdAt||new Date().toISOString());if(loan.billing.publicRef!==bill){loan.billing.publicRef=bill;changed=true}}}if(changed){await db.prepare('UPDATE demo_workspaces SET payload=? WHERE owner=? AND revision=?').bind(JSON.stringify(state),row.owner,row.revision).run();workspaces++;}}
 console.log(JSON.stringify({event:'public_reference_backfill',customers,kycs,files,tickets,audits,workspaces}));
}
await backfillPublicIdentifiers();
// Bind legacy JSON loans to an already approved KYC revision when one exists.
// Loans that cannot be proven are recorded as quarantined instead of being
// silently upgraded; the funding guard will continue to reject any new
// disbursement until an operator completes the review.
async function backfillLegacyLoanBindings(){
 let linked=0,quarantined=0,unscoped=0;
 for(const row of (await db.prepare('SELECT owner,revision,payload FROM demo_workspaces').all()).results||[]){
  let state;try{state=JSON.parse(String(row.payload))}catch{continue}
  let changed=false;
  for(const loan of Array.isArray(state.loans)?state.loans:[]){
   if(loan.kycCaseId&&loan.kycRevision!=null)continue;
   const processed=await db.prepare('SELECT outcome FROM legacy_loan_backfill WHERE tenant_id=? AND loan_id=?').bind(row.owner,loan.id).first();
   if(processed?.outcome==='linked'&&!loan.kycCaseId)continue;
   if(!loan.customerId){unscoped++;await db.prepare('INSERT OR IGNORE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,detail,processed_at) VALUES (?,?,?,?,?)').bind(row.owner,loan.id,'unscoped','历史贷款缺少客户绑定，需人工核对',new Date().toISOString()).run();continue}
   const kyc=await db.prepare("SELECT id,revision FROM kyc_cases WHERE owner=? AND customer_id=? AND status='approved' ORDER BY updated_at DESC LIMIT 1").bind(row.owner,loan.customerId).first();
   if(kyc){loan.kycCaseId=String(kyc.id);loan.kycRevision=Number(kyc.revision);changed=true;linked++;await db.prepare('INSERT OR REPLACE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,kyc_case_id,detail,processed_at) VALUES (?,?,?,?,?,?)').bind(row.owner,loan.id,'linked',kyc.id,'已绑定最近一次人工审核通过的 KYC 版本',new Date().toISOString()).run()}
   else{quarantined++;await db.prepare('INSERT OR IGNORE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,detail,processed_at) VALUES (?,?,?,?,?)').bind(row.owner,loan.id,'quarantined','历史贷款未找到可核验的已通过 KYC，禁止新增放款',new Date().toISOString()).run()}
  }
  if(changed)await db.prepare('UPDATE demo_workspaces SET payload=? WHERE owner=? AND revision=?').bind(JSON.stringify(state),row.owner,row.revision).run();
 }
 console.log(JSON.stringify({event:'legacy_loan_backfill',linked,quarantined,unscoped}));
}
await backfillLegacyLoanBindings();
for(const company of cfg.companies){
 const t=company.id,dept=t+':ops',institution=t+':institution',post=t+':postloan';
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO team_companies(id,name,slug,active,default_department,auto_assign) VALUES (?,?,?,1,?,1)').bind(t,company.name,company.slug,dept),
 ...[[dept,'运营审核部','department'],[institution,'测试承接机构','institution'],[post,'运营贷后部','postloan']].map(([id,name,kind])=>db.prepare('INSERT OR IGNORE INTO team_units(id,tenant_id,name,kind) VALUES (?,?,?,?)').bind(id,t,name,kind)),
 db.prepare('INSERT OR IGNORE INTO team_service_settings(tenant_id,auto_assign,funding_id,repayment_id,collection_id) VALUES (?,1,?,?,?)').bind(t,institution,institution,post),
 ]);
 for(const a of company.accounts){const id=t+':'+a.role;await db.batch([db.prepare('INSERT OR IGNORE INTO team_members(id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)').bind(id,t,'local:'+id,a.email,a.role,a.role==='admin'?null:a.role==='kyc'?dept:a.role==='collector'?post:institution),db.prepare('INSERT OR IGNORE INTO team_staff_credentials(member_id,password_hash) VALUES (?,?)').bind(id,a.hash)]);}
 const state={loans:[],bots:[{id:'bot-1',label:'PayEase 测试渠道',username:'',enabled:true,envKey:'TELEGRAM_BOT_TOKEN_1',phoneVerification:false,passwordSetup:false},{id:'bot-2',label:'PayEase 第二测试渠道',username:'',enabled:true,envKey:'TELEGRAM_BOT_TOKEN_2',phoneVerification:false,passwordSetup:false}],events:[],entries:[],notifications:[],requests:[]};
 await db.prepare('INSERT OR IGNORE INTO demo_workspaces(owner,revision,payload) VALUES (?,0,?)').bind(t,JSON.stringify(state)).run();
}
const sign=x=>createHmac('sha256',cfg.sessionSecret).update(x).digest('hex');
// Standalone requests carry a synthetic site identity so the local staff
// portal can authenticate without the hosted ChatGPT gateway. The proof must
// use the same secret that chatgpt-auth.ts uses for verification.
const identitySign=x=>createHmac('sha256',cfg.bindings.PAYEASE_IDENTITY_PROOF_SECRET||cfg.bindings.PAYEASE_AUTH_SECRET||cfg.sessionSecret).update(x).digest('hex');
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const rateBuckets=new Map();
const allowRate=(key,limit,windowMs)=>{const now=Date.now(),current=rateBuckets.get(key);if(!current||now-current.started>=windowMs){rateBuckets.set(key,{started:now,count:1});if(rateBuckets.size>10000){for(const [k,v]of rateBuckets)if(now-v.started>=windowMs)rateBuckets.delete(k)}return true}if(current.count>=limit)return false;current.count++;return true};
const server=createServer(async(req,res)=>{try{
 const expected='Basic '+Buffer.from(cfg.accessUser+':'+cfg.accessPassword).toString('base64');
 const jobRequest=req.url==='/api/jobs/postloan'&&req.method==='POST'&&eq(req.headers.authorization||'','Bearer '+cfg.bindings.POSTLOAN_JOB_SECRET);
 const host=req.headers.host;
 if(req.method==='GET'&&['/healthz','/readyz','/version'].includes(req.url)){
  if(req.url==='/healthz'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({status:'ok'}));
  }
  if(req.url==='/version'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({service:'payease-api',buildId}));
  }
  try{
   await db.prepare('SELECT 1 AS ok').first();
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({status:'ready',buildId}));
  }catch{
   res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({status:'not_ready'}));
  }
 }
 if(![cfg.host,'admin.khmerx.org','api.khmerx.org','payease.khmerx.org','payeas.khmerx.org'].includes(host)){res.writeHead(400);return res.end('Invalid host');}
 const publicClient=host==='payease.khmerx.org'||host==='payeas.khmerx.org'||host==='api.khmerx.org'||host==='admin.khmerx.org';
 if(!jobRequest&&!publicClient&&!eq(req.headers.authorization||'',expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="PayEase private test"','Cache-Control':'no-store'});return res.end('Private test environment');}
 const secure=true;
 if(host==='admin.khmerx.org'&&req.url==='/'){res.writeHead(302,{Location:'/team/login'});return res.end();}
 if(host==='api.khmerx.org'&&!req.url?.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'API endpoint required'}));}
 // Only trust the edge-provided address. x-real-ip/x-forwarded-for are
 // client-controlled when this listener is reached directly and would let a
 // caller rotate the limiter key on every request.
 const clientIp=String(req.headers['cf-connecting-ip']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 if(req.url?.startsWith('/api/')){const authRoute=/^\/api\/h5\/auth(?:\/|$)/.test(req.url),limit=authRoute?30:240,windowMs=authRoute?15*60*1000:60*1000;if(!allowRate((authRoute?'auth:':'api:')+clientIp,limit,windowMs)){res.writeHead(429,{'Content-Type':'application/json','Retry-After':String(Math.ceil(windowMs/1000))});return res.end(JSON.stringify({error:'请求过于频繁，请稍后重试',code:'RATE_LIMITED'}));}}
 let cookies=req.headers.cookie||'',value=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith('payease_visitor='))?.slice(16),id=value?.split('.')[0];
 let fresh=false;if(!id||!/^[a-f0-9-]{36}$/.test(id)||!eq(value?.split('.')[1]||'',sign(id))){id=randomUUID();value=id+'.'+sign(id);fresh=true;}
 const headers=new Headers();for(const [k,v]of Object.entries(req.headers)){if(v&&!k.startsWith('oai-')&&!['host','authorization','connection','content-length','transfer-encoding','x-forwarded-proto','x-forwarded-host','x-payease-identity-proof'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);}headers.set('host',host);
 if(jobRequest)headers.set('authorization',req.headers.authorization);
 const identityId='visitor:'+id, identityEmail=id+'@visitor.invalid',identityProofTs=Math.floor(Date.now()/1000).toString();headers.set('oai-authenticated-user-id',identityId);headers.set('oai-authenticated-user-email',identityEmail);headers.set('x-payease-identity-proof-ts',identityProofTs);headers.set('x-payease-identity-proof',identitySign(identityId+'\n'+identityEmail+'\n'+identityProofTs));
 if(!/(?:^|;\s*)payease_company=/.test(cookies)){cookies+='; payease_company='+cfg.companies[0].id;headers.set('cookie',cookies);}
 const url=(secure?'https://':'http://')+host+(req.url||'/');
 const method=req.method||'GET';let body;
 if(!['GET','HEAD'].includes(method)){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>15*1024*1024){res.writeHead(413);return res.end('Request too large');}chunks.push(c);}body=Buffer.concat(chunks);}
 const response=await mf.dispatchFetch(url,{method,headers,body,redirect:'manual'});
 res.statusCode=response.status;for(const [k,v]of response.headers)if(!['set-cookie','transfer-encoding','connection'].includes(k))res.setHeader(k,v);
 const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(self), geolocation=(self), microphone=(self), payment=()','Content-Security-Policy':"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' https://telegram.org 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.khmerx.org https://api.telegram.org https://gatewayapi.telegram.org"};for(const [k,v] of Object.entries(securityHeaders))if(!res.hasHeader(k))res.setHeader(k,v);if(secure&&!res.hasHeader('Strict-Transport-Security'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
 const set=response.headers.getSetCookie();if(fresh)set.push('payease_visitor='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'+(secure?'; Secure':''));if(set.length)res.setHeader('Set-Cookie',set);
 if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 }catch(e){console.error(e.message);if(!res.headersSent)res.writeHead(503);res.end('Service temporarily unavailable');}});
server.listen(4300,'0.0.0.0',()=>console.log('PayEase test server ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(async()=>{await mf.dispose();process.exit(0)});});
