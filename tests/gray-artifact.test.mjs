import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync,symlinkSync,unlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';

const root=resolve('.'),build=join(root,'scripts/build-gray-artifact.sh'),verify=join(root,'deploy/standalone/gray/verify-artifact.sh');
const available=process.platform==='linux'&&existsSync('/.dockerenv')&&process.version==='v22.22.1'&&spawnSync('git',['--version']).status===0;
const gate=(name,fn)=>test(name,{skip:!available},fn);
function fixture(){
 const folder=mkdtempSync(join(tmpdir(),'gray-artifact-')),repo=join(folder,'repo'),bin=join(folder,'bin');mkdirSync(repo);mkdirSync(bin);
 const env={...process.env,PATH:bin+':'+process.env.PATH,GRAY_ARTIFACT_REUSE_DEPS:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:repo,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()};
 git('init','-q');git('config','user.name','Synthetic Builder');git('config','user.email','builder@example.test');git('config','core.autocrlf','false');
 writeFileSync(join(repo,'.gitignore'),'dist/\nnode_modules/\n');writeFileSync(join(repo,'package-lock.json'),'{}\n');writeFileSync(join(repo,'source.txt'),'synthetic source\n');
 git('add','.gitignore','package-lock.json','source.txt');git('commit','-qm','synthetic baseline');const sha=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',sha);
 writeFileSync(join(bin,'npm'),`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TRACE"
[[ "\${FAIL_STEP:-}" != "$1" ]] || exit 9
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
  assert.deepEqual(Object.keys(first).sort(),['gitSha','builtAt','nodeVersion','lockfileSha256','buildId','fileCount'].sort());assert.equal(first.gitSha,f.sha);assert.equal(first.fileCount,2);assert.equal(first.nodeVersion,'v22.22.1');assert.equal(first.buildId,'synthetic-build');assert.match(first.lockfileSha256,/^[a-f0-9]{64}$/);
  const metadata=readFileSync(join(f.repo,'dist/BUILD_INFO.json'),'utf8');assert.equal(f.run(verify).status,0);assert.equal(readFileSync(join(f.repo,'dist/BUILD_INFO.json'),'utf8'),metadata);
  assert.equal(f.run(build).status,0);assert.equal(f.info().buildId,first.buildId);assert.equal(readFileSync(join(f.repo,'dist/dist.sha256'),'utf8'),manifest);assert.equal(f.git('status','--porcelain'),'');
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
  assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);mkdirSync(join(f.repo,'node_modules'));
  assert.equal(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'1'}).status,0);assert.notEqual(f.run(build,[f.sha],{GRAY_ARTIFACT_REUSE_DEPS:'invalid'}).status,0);
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
  assert.equal(f.run(build).status,0);symlinkSync(payload,join(f.repo,'dist/link.js'));assert.notEqual(f.run(verify).status,0);
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
