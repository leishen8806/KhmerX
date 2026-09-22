// No customer data or secrets are printed. Host scheduler supplies the environment.
const origin=process.env.PAYEASE_SITE_URL;
const secret=process.env.POSTLOAN_JOB_SECRET;
if(!origin||!secret||secret.length<32)throw Error('Missing post-loan job configuration');
const base=new URL(origin);if(base.protocol!=='https:'||base.username||base.password)throw Error('HTTPS origin required');
const headers={authorization:'Bearer '+secret,'content-type':'application/json'};
// Owner-private Sites requires its separately managed dispatch credential as well.
if(process.env.SITES_DISPATCH_TOKEN)headers['OAI-Sites-Authorization']='Bearer '+process.env.SITES_DISPATCH_TOKEN;
let ok=false;
for(let attempt=0;attempt<3;attempt++){
 try{const r=await fetch(new URL('/api/jobs/postloan',base),{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(60000),redirect:'error'});if(!r.ok)throw Error('Job endpoint status '+r.status);const d=await r.json();if(d.ok!==true||typeof d.companies!=='number'||typeof d.checkedAt!=='string')throw Error('Unexpected job response');console.log(JSON.stringify({ok:true,companies:d.companies,checkedAt:d.checkedAt}));ok=true;break}catch(e){console.error('Post-loan run attempt failed:',attempt+1,e.name);if(attempt<2)await new Promise(r=>setTimeout(r,5000))}
}
if(!ok)process.exitCode=1;
