#!/usr/bin/env node
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {createHmac} from 'node:crypto';

const args=process.argv.slice(2);
if(args.includes('--remote')||args.includes('--production')){console.error('refusing remote/production database');process.exit(2)}
if(args.length!==2||args[0]!=='--db'||!args[1]){console.error('usage: --db <local sqlite path>');process.exit(2)}
const databasePath=args[1];
if(!existsSync(databasePath)){console.error(`database not found: ${databasePath}`);process.exit(2)}

const db=new DatabaseSync(databasePath,{readOnly:true});
const columns=db.prepare('PRAGMA table_info(team_audit)').all().map(row=>row.name);
if(!columns.includes('seq')){console.error('team_audit.seq is missing; apply migration 0062 first');process.exit(2)}
const rows=db.prepare('SELECT id,seq,tenant_id,actor,action,detail,created_at FROM team_audit ORDER BY created_at ASC,id ASC').all();
const nullSeqRows=rows.filter(row=>row.seq===null||row.seq===undefined).map(row=>row.id);
const nonNullSeqRows=rows.filter(row=>row.seq!==null&&row.seq!==undefined);
const seqValues=nonNullSeqRows.map(row=>Number(row.seq));
const seqUnique=new Set(seqValues).size===seqValues.length;
const seqOrder=nonNullSeqRows.slice().sort((a,b)=>Number(a.seq)-Number(b.seq)).map(row=>row.id);
const createdOrder=nonNullSeqRows.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map(row=>row.id);
const seqOrderMatchesCreatedAtId=seqUnique&&seqOrder.every((id,index)=>id===createdOrder[index]);

function canonical(input){return input.map(row=>JSON.stringify([row.id,row.actor,row.action,row.detail,row.created_at])).join('\n')}
function v2Digest(input){
  const secret=String(process.env.PAYEASE_AUTH_SECRET||'');
  if(secret.length<32)return null;
  return 'v2:'+createHmac('sha256',secret).update(canonical(input)).digest('hex');
}
function v2Checks(){
  const manifestColumns=db.prepare('PRAGMA table_info(team_audit_manifests)').all().map(row=>row.name);
  if(!manifestColumns.includes('version'))return {available:false,reason:'team_audit_manifests.version is missing'};
  const manifests=db.prepare('SELECT id,version,tenant_id,digest,row_count,last_created_at,last_id FROM team_audit_manifests WHERE version=2 ORDER BY created_at,id').all();
  return {available:true,checked:manifests.length,secretAvailable:v2Digest([])!==null,results:manifests.map(manifest=>{
    const params=[manifest.tenant_id];
    let query='SELECT id,actor,action,detail,created_at FROM team_audit WHERE tenant_id=?';
    if(manifest.last_created_at&&manifest.last_id){query+=' AND (created_at<? OR (created_at=? AND id<=?))';params.push(manifest.last_created_at,manifest.last_created_at,manifest.last_id)}
    else if(manifest.last_created_at){query+=' AND created_at<=?';params.push(manifest.last_created_at)}
    query+=' ORDER BY created_at ASC,id ASC';
    const snapshot=db.prepare(query).all(...params);
    const prefix=snapshot.slice(0,Number(manifest.row_count));
    const digest=v2Digest(prefix);
    return {id:manifest.id,tenantId:manifest.tenant_id,rowCount:Number(manifest.row_count),currentPrefixRows:prefix.length,digestMatches:digest===null?null:digest===manifest.digest};
  })};
}

console.log(JSON.stringify({
  mode:'verify-read-only',
  database:databasePath,
  rows:rows.length,
  seqNull:{count:nullSeqRows.length,ids:nullSeqRows},
  seqUnique,
  seqOrderMatchesCreatedAtId,
  v2Verify:v2Checks()
},null,2));
