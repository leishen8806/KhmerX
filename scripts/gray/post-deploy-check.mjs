#!/usr/bin/env node
// Read-only gray post-deploy probe. It sends GET requests only.
const base=process.argv[2];
const expected=process.env.EXPECTED_BUILD_ID||process.argv[3]||'';
if(!base){console.error('usage: post-deploy-check.mjs <base-url> [expected-build-id]');process.exit(2)}
let origin;
try{origin=new URL(base);if(!['http:','https:'].includes(origin.protocol))throw Error('unsupported protocol')}catch{console.error('FAIL invalid base URL');process.exit(2)}
const fail=(message)=>{console.error(`FAIL ${message}`);process.exitCode=1};
async function get(path){const url=new URL(path,origin);const response=await fetch(url,{method:'GET',redirect:'manual',headers:{accept:'application/json'}});let body;try{body=await response.json()}catch{body=null}return {response,body}}
try{
 const health=await get('/healthz');if(health.response.status!==200||health.body?.status!=='ok')fail('/healthz expected HTTP 200 and status=ok');else console.log('PASS /healthz');
 const ready=await get('/readyz');if(ready.response.status!==200||ready.body?.status!=='ready')fail('/readyz expected HTTP 200 and status=ready');else console.log('PASS /readyz');
 const version=await get('/version');const buildId=typeof version.body?.buildId==='string'?version.body.buildId:'';if(version.response.status!==200||version.body?.service!=='payease-api'||!buildId||(expected&&buildId!==expected))fail('/version expected payease-api and matching non-empty buildId');else console.log(`PASS /version buildId=${buildId}`);
 const auth=await get('/api/h5/auth');if(auth.response.status!==200||auth.body?.company!=='KhmerX Gray'||auth.body?.mode!=='demo')fail('/api/h5/auth expected company=KhmerX Gray and mode=demo');else if(Object.hasOwn(auth.body,'demoCode'))fail('/api/h5/auth must not expose demoCode');else console.log('PASS /api/h5/auth company=KhmerX Gray mode=demo');
}catch(error){fail(`request error: ${error instanceof Error?error.message:'unknown error'}`)}
if(process.exitCode)process.exit(1);
