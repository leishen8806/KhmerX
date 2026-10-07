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
const cfg=JSON.parse(readFileSync('/data/config.json','utf8'));
const mf=new Miniflare({modules,modulesRoot:moduleRoot,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],assets:{directory:'/app/dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},d1Databases:{DB:'payease'},d1Persist:'/data/d1',r2Buckets:{BUCKET:'payease'},r2Persist:'/data/r2',bindings:cfg.bindings,host:'127.0.0.1'});
const db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS standalone_migrations (name TEXT PRIMARY KEY)').run();
function splitSql(sql){const statements=[],push=current=>{const text=current.trim();if(text&&text.replace(/--[^\n]*/g,'').trim())statements.push(text)};let current='',quote=false;for(let i=0;i<sql.length;i++){const ch=sql[i];if(ch==="'"){if(quote&&sql[i+1]==="'"){current+=ch+sql[++i];continue}quote=!quote;current+=ch;continue}if(ch===';'&&!quote){push(current);current='';continue}current+=ch}push(current);return statements}
for(const name of readdirSync('/app/drizzle').filter(n=>/^\d.*\.sql$/.test(n)).sort()){
 if(await db.prepare('SELECT name FROM standalone_migrations WHERE name=?').bind(name).first())continue;
 const parts=splitSql(readFileSync('/app/drizzle/'+name,'utf8').replace(/--> statement-breakpoint/g,';'));
 await db.batch([...parts.map(s=>db.prepare(s)),db.prepare('INSERT INTO standalone_migrations VALUES (?)').bind(name)]);
}
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
const server=createServer(async(req,res)=>{try{
 const expected='Basic '+Buffer.from(cfg.accessUser+':'+cfg.accessPassword).toString('base64');
 const jobRequest=req.url==='/api/jobs/postloan'&&req.method==='POST'&&eq(req.headers.authorization||'','Bearer '+cfg.bindings.POSTLOAN_JOB_SECRET);
 const host=req.headers.host;
 if(![cfg.host,'admin.khmerx.org','api.khmerx.org','payease.khmerx.org','payeas.khmerx.org'].includes(host)){res.writeHead(400);return res.end('Invalid host');}
 const publicClient=host==='payease.khmerx.org'||host==='payeas.khmerx.org'||host==='api.khmerx.org'||host==='admin.khmerx.org';
 if(!jobRequest&&!publicClient&&!eq(req.headers.authorization||'',expected)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="PayEase private test"','Cache-Control':'no-store'});return res.end('Private test environment');}
 const secure=req.headers['x-forwarded-proto']==='https';
 if(host==='admin.khmerx.org'&&req.url==='/'){res.writeHead(302,{Location:'/team/login'});return res.end();}
 if(host==='api.khmerx.org'&&!req.url?.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'API endpoint required'}));}
 let cookies=req.headers.cookie||'',value=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith('payease_visitor='))?.slice(16),id=value?.split('.')[0];
 let fresh=false;if(!id||!/^[a-f0-9-]{36}$/.test(id)||!eq(value?.split('.')[1]||'',sign(id))){id=randomUUID();value=id+'.'+sign(id);fresh=true;}
 const headers=new Headers();for(const [k,v]of Object.entries(req.headers)){if(v&&!k.startsWith('oai-')&&!['host','authorization','connection','content-length','transfer-encoding','x-forwarded-proto','x-forwarded-host','x-payease-identity-proof'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);}
 if(jobRequest)headers.set('authorization',req.headers.authorization);
 const identityId='visitor:'+id, identityEmail=id+'@visitor.invalid';headers.set('oai-authenticated-user-id',identityId);headers.set('oai-authenticated-user-email',identityEmail);headers.set('x-payease-identity-proof',identitySign(identityId+'\n'+identityEmail));
 if(!/(?:^|;\s*)payease_company=/.test(cookies)){cookies+='; payease_company='+cfg.companies[0].id;headers.set('cookie',cookies);}
 const url=(secure?'https://':'http://')+host+(req.url||'/');
 const method=req.method||'GET';let body;
 if(!['GET','HEAD'].includes(method)){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>15*1024*1024){res.writeHead(413);return res.end('Request too large');}chunks.push(c);}body=Buffer.concat(chunks);}
 const response=await mf.dispatchFetch(url,{method,headers,body,redirect:'manual'});
 res.statusCode=response.status;for(const [k,v]of response.headers)if(!['set-cookie','transfer-encoding','connection'].includes(k))res.setHeader(k,v);
 const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(self), geolocation=(self), microphone=(self), payment=()','Content-Security-Policy':"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.khmerx.org https://api.telegram.org https://gatewayapi.telegram.org"};for(const [k,v] of Object.entries(securityHeaders))if(!res.hasHeader(k))res.setHeader(k,v);if(secure&&!res.hasHeader('Strict-Transport-Security'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
 const set=response.headers.getSetCookie();if(fresh)set.push('payease_visitor='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'+(secure?'; Secure':''));if(set.length)res.setHeader('Set-Cookie',set);
 if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 }catch(e){console.error(e.message);if(!res.headersSent)res.writeHead(503);res.end('Service temporarily unavailable');}});
server.listen(4300,'0.0.0.0',()=>console.log('PayEase test server ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(async()=>{await mf.dispose();process.exit(0)});});
