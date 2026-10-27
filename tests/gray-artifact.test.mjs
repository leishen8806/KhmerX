// Requires Linux Docker, Node 22.22.1, offline Git and executable /tmp (--tmpfs /tmp:exec).
// Unmet prerequisites are skips, never passing build evidence. All builds below are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync,symlinkSync,unlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';

const root=resolve('.'),build=join(root,'scripts/build-gray-artifact.sh'),verify=join(root,'deploy/standalone/gray/verify-artifact.sh');
function prerequisites(){
 if(process.platform!=='linux'||!existsSync('/.dockerenv')||process.version!=='v22.22.1'||spawnSync('git',['--version']).status!==0)return false;
 const folder=mkdtempSync(join(tmpdir(),'gray-exec-')),probe=join(folder,'probe');
 try{writeFileSync(probe,'#!/bin/sh\nexit 0\n',{mode:0o755});return spawnSync(probe).status===0;}finally{rmSync(folder,{recursive:true,force:true});}
}
const available=prerequisites();
const gate=(name,fn)=>test(name,{skip:!available},fn);
function fixture(){
 const folder=mkdtempSync(join(tmpdir(),'gray-artifact-')),repo=join(folder,'repo'),bin=join(folder,'bin');mkdirSync(repo);mkdirSync(bin);
 const env={...process.env,PATH:bin+':'+process.env.PATH,GRAY_ARTIFACT_REUSE_DEPS:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:repo,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()};
 git('init','-q');git('config','user.name','Synthetic Builder');git('config','user.email','builder@example.test');git('config','core.autocrlf','false');
 writeFileSync(join(repo,'.gitignore'),'dist/\nnode_modules/\n');writeFileSync(join(repo,'package-lock.json'),JSON.stringify({packages:{'':{},'node_modules/example':{version:'1.0.0',resolved:'synthetic:example',integrity:'synthetic-example'},'node_modules/linux-binding':{version:'1.0.0',resolved:'synthetic:linux-binding',integrity:'synthetic-linux-binding',optional:true,os:['linux'],cpu:['x64']},'node_modules/linux-binding-musl':{version:'1.0.0',optional:true,os:['linux'],cpu:['x64']},'node_modules/windows-binding':{version:'1.0.0',optional:true,os:['win32']}}}));writeFileSync(join(repo,'source.txt'),'synthetic source\n');
 git('add','.gitignore','package-lock.json','source.txt');git('commit','-qm','synthetic baseline');const sha=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',sha);
 writeFileSync(join(bin,'npm'),`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TRACE"
[[ "\${FAIL_STEP:-}" != "$1" ]] || exit 9
if [[ "$1" == ci ]]; then
 mkdir -p node_modules/example node_modules/linux-binding
 printf '{"version":"1.0.0"}' > node_modules/example/package.json
 printf '{"version":"1.0.0"}' > node_modules/linux-binding/package.json
 printf '{"packages":{"node_modules/example":{"version":"1.0.0","resolved":"synthetic:example","integrity":"synthetic-example"},"node_modules/linux-binding":{"version":"1.0.0","resolved":"synthetic:linux-binding","integrity":"synthetic-linux-binding"}}}' > node_modules/.package-lock.json
fi
if [[ "$1" == run ]]; then
 mkdir -p dist/server
 printf 'synthetic-build\n' > dist/server/BUILD_ID
 printf 'synthetic payload\n' > 'dist/server/payload with space.js'
fi
`,{mode:0o755});env.TRACE=join(folder,'trace');
 const run=(script,args=[sha],extra={})=>spawnSync('bash',[script,...args],{cwd:repo,env:{...env,...extra},encoding:'utf8'});
 const info=()=>JSON.parse(readFileSync(join(repo,'dist/BUILD_INFO.json'),'utf8'));
 const setInfo=value=>writeFileSync(join(repo,'dist/BUILD_INFO.json'),JSON.stringify(value));
 return {folder,repo,bin,env,sha,git,run,info,setInfo,close(){rmSync(folder,{recursive:true,force:true})}};
}

gate('gray artifact scripts: offline synthetic build, stable inventory, metadata and read-only verification',()=>{
 const f=fixture();try{
  assert.equal(f.run(build).status,0);const first=f.info(),manifest=readFileSync(join(f.repo,'dist/dist.sha256'),'utf8');
  assert.deepEqual(Object.keys(first).sort(),['gitSha','builtAt','nodeVersion','lockfileSha256','buildId','fileCount'].sort());assert.equal(first.gitSha,f.sha);assert.equal(first.fileCount,3);assert.equal(first.nodeVersion,'v22.22.1');assert.equal(first.buildId,'synthetic-build');assert.match(first.lockfileSha256,/^[a-f0-9]{64}$/);
  const metadata=readFileSync(join(f.repo,'dist/BUILD_INFO.json'),'utf8');assert.equal(f.run(verify).status,0);assert.equal(readFileSync(join(f.repo,'dist/BUILD_INFO.json'),'utf8'),metadata);
  rmSync(join(f.repo,'dist'),{recursive:true});assert.equal(f.run(build).status,0);assert.equal(f.info().buildId,first.buildId);assert.equal(readFileSync(join(f.repo,'dist/dist.sha256'),'utf8'),manifest);assert.equal(f.git('status','--porcelain'),'');
  assert.deepEqual(readFileSync(f.env.TRACE,'utf8').trim().split('\n'),['ci','run build','ci','run build']);
 }finally{f.close()}
});

gate('gray artifact build rejects dirty worktree, wrong SHA, non-main ancestry and wrong Node',()=>{
 const f=fixture();try{
  writeFileSync(join(f.repo,'untracked.txt'),'synthetic');assert.notEqual(f.run(build).status,0);unlinkSync(join(f.repo,'untracked.txt'));
  writeFileSync(join(f.repo,'source.txt'),'dirty');assert.notEqual(f.run(build).status,0);writeFileSync(join(f.repo,'source.txt'),'synthetic source\n');
  assert.notEqual(f.run(build,['0'.repeat(40)]).status,0);
  writeFileSync(join(f.bin,'node'),'#!/bin/sh\nprintf "v20.0.0\\n"\n',{mode:0o755});assert.notEqual(f.run(build).status,0);unlinkSync(join(f.bin,'node'));
  writeFileSync(join(f.repo,'source.txt'),'synthetic branch');f.git('add','source.txt');f.git('commit','-qm','non-main commit');const branch=f.git('rev-parse','HEAD');assert.notEqual(f.run(build,[branch]).status,0);
 }finally{f.close()}
});

gate('gray artifact install/build failures propagate; dependency reuse is explicit',()=>{
 const f=fixture();try{
  assert.equal(f.run(build,[f.sha],{FAIL_STEP:'ci'}).status,9);assert.equal(f.run(build,[f.sha],{FAIL_STEP:'run'}).status,9);
  rmSync(join(f.repo,'node_modules'),{recursive:true,force:true});assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);mkdirSync(join(f.repo,'node_modules'));
  assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);assert.equal(f.run(build).status,0);rmSync(join(f.repo,'dist'),{recursive:true});assert.equal(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'invalid'}).status,0);
 }finally{f.close()}
});

gate('gray artifact verification rejects payload, inventory, SHA, BUILD_ID and file-count tampering',()=>{
 const f=fixture();try{
  assert.equal(f.run(build).status,0);const original=f.info(),payload=join(f.repo,'dist/server/payload with space.js');
  writeFileSync(payload,'tampered');assert.notEqual(f.run(verify).status,0);writeFileSync(payload,'synthetic payload\n');
  const extra=join(f.repo,'dist/extra.js');writeFileSync(extra,'extra');assert.notEqual(f.run(verify).status,0);unlinkSync(extra);
  f.setInfo({...original,gitSha:'0'.repeat(40)});assert.notEqual(f.run(verify).status,0);f.setInfo(original);
  f.setInfo({...original,fileCount:99});assert.notEqual(f.run(verify).status,0);f.setInfo(original);
  writeFileSync(join(f.repo,'dist/server/BUILD_ID'),'different');assert.notEqual(f.run(verify).status,0);
  rmSync(join(f.repo,'dist'),{recursive:true});assert.equal(f.run(build).status,0);symlinkSync(payload,join(f.repo,'dist/link.js'));assert.notEqual(f.run(verify).status,0);
 }finally{f.close()}
});

gate('gray artifact --running compares only local HTTP buildId and rejects a mismatched version',async()=>{
 const f=fixture();let buildId='synthetic-build';const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'synthetic',buildId}))});
 try{
  assert.equal(f.run(build).status,0);await new Promise(resolve=>server.listen(4300,'127.0.0.1',resolve));
  const run=()=>new Promise((resolve,reject)=>{const child=spawn('bash',[verify,f.sha,'--running'],{cwd:f.repo,env:f.env,stdio:'ignore'});child.on('error',reject);child.on('close',resolve)});
  assert.equal(await run(),0);buildId='different';assert.notEqual(await run(),0);
 }finally{if(server.listening)await new Promise(resolve=>server.close(resolve));f.close()}
});


gate('gray artifact reuse checks installed locks, package metadata and platform bindings',()=>{
 const f=fixture();try{
  const installed=join(f.repo,'node_modules/.package-lock.json');
  assert.equal(f.run(build).status,0);rmSync(join(f.repo,'dist'),{recursive:true});
  const original=JSON.parse(readFileSync(installed,'utf8'));writeFileSync(installed,'{"packages":{}}');assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);writeFileSync(installed,JSON.stringify(original));
  const run=()=>f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'});
  for(const [name,entry] of Object.entries(original.packages)){
   for(const mutation of [undefined,{...entry,version:'9.0.0'},{...entry,resolved:'wrong'},{...entry,integrity:'wrong'}]){
    const lock={packages:{...original.packages}};if(mutation)lock.packages[name]=mutation;else delete lock.packages[name];
    // Compare resolved/integrity when both locks provide them.
    writeFileSync(installed,JSON.stringify(lock));assert.notEqual(run().status,0,name);assert.equal(existsSync(join(f.repo,'dist')),false);
   }
  }
  writeFileSync(installed,JSON.stringify(original));rmSync(join(f.repo,'node_modules/linux-binding'),{recursive:true});assert.notEqual(run().status,0);
  mkdirSync(join(f.repo,'node_modules/linux-binding'));writeFileSync(join(f.repo,'node_modules/linux-binding/package.json'),'{"version":"1.0.0"}');
  assert.equal(run().status,0);const deps=JSON.parse(readFileSync(join(f.repo,'dist/BUILD_DEPS.json'),'utf8'));
  assert.equal(deps.mode,'reused');assert.equal(deps.lockfileSha256,f.info().lockfileSha256);assert.equal(deps.installedPackages,2);assert.equal(deps.checkedPackages,2);assert.match(deps.installedLockSha256,/^[a-f0-9]{64}$/);
 }finally{f.close()}
});

gate('gray artifact refuses stale dist and requires checksummed dependency provenance',()=>{
 const f=fixture();try{
  mkdirSync(join(f.repo,'dist/server'),{recursive:true});writeFileSync(join(f.repo,'dist/server/stale.js'),'stale');
  assert.notEqual(f.run(build).status,0);assert.equal(existsSync(f.env.TRACE),false);
  rmSync(join(f.repo,'dist'),{recursive:true});assert.equal(f.run(build).status,0);
  const path=join(f.repo,'dist/BUILD_DEPS.json'),deps=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(deps.mode,'npm-ci');assert.equal(readFileSync(join(f.repo,'dist/dist.sha256'),'utf8').includes('stale.js'),false);
  unlinkSync(path);assert.notEqual(f.run(verify).status,0);
  for(const change of [{lockfileSha256:'0'.repeat(64)},{mode:'unknown'}]){
   writeFileSync(path,JSON.stringify({...deps,...change}));
   // Recompute hashes so semantic validation, not only the checksum, must reject it.
   const result=spawnSync('bash',['-c',"find dist -type f ! -path dist/BUILD_INFO.json ! -path dist/dist.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > dist/dist.sha256"],{cwd:f.repo});assert.equal(result.status,0);
   assert.notEqual(f.run(verify).status,0);
  }
 }finally{f.close()}
});
