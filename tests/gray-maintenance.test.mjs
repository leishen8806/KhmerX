import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {maintenanceResponse} from '../deploy/standalone/maintenance.mjs';

test('closing the gray flag blocks business requests and reopening restores them',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'khmerx-maintenance-')),flag=join(directory,'closed');
 const server=createServer((req,res)=>{const response=maintenanceResponse(req,flag,300);if(response){res.writeHead(response.status,response.headers);res.end(response.body)}else{res.writeHead(200);res.end('ok')}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(origin+'/api/h5/state')).status,200);writeFileSync(flag,'');
  const response=await fetch(origin+'/api/h5/state'),body=await response.json();assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'300');assert.equal(body.code,'SERVICE_UNAVAILABLE');assert.equal(body.requestId,response.headers.get('X-Request-Id'));assert.equal(body.params.retryAfterSeconds,300);
  const page=await fetch(origin+'/'),html=await page.text();assert.equal(page.status,503);for(const locale of ['km','en','zh'])assert(html.includes(`lang="${locale}"`));
  assert.equal((await fetch(origin+'/healthz')).status,200);assert.equal((await fetch(origin+'/api/jobs/postloan',{method:'POST'})).status,503);
  assert.equal(maintenanceResponse({url:'/',method:'GET'},flag,Infinity).headers['Retry-After'],'300');assert.equal(maintenanceResponse({url:'/',method:'GET'},flag,99999).headers['Retry-After'],'3600');
  unlinkSync(flag);assert.equal((await fetch(origin+'/api/h5/state')).status,200);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert(directory.startsWith(join(tmpdir(),'khmerx-maintenance-')));rmSync(directory,{recursive:true,force:true})}
});
