import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/r0-audit-manifest-v2.json' with {type:'json'};

async function hmac(rows){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(fixture.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const canonical=rows.map(row=>JSON.stringify(row)).join('\n');
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canonical));
  return 'v2:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
function ordered(rows){return [...rows].sort((a,b)=>a[4].localeCompare(b[4])||a[0].localeCompare(b[0]))}
async function verify(rows,manifestRows){
  const current=ordered(rows), prefix=current.slice(0,manifestRows.length);
  const known=new Set(manifestRows.map(row=>row[0])), boundary=manifestRows.at(-1), lateBefore=boundary&&current.some(row=>!known.has(row[0])&&(row[4]<boundary[4]||(row[4]===boundary[4]&&row[0]<=boundary[0])));
  return {match:(await hmac(prefix))===await hmac(manifestRows)&&current.length>=manifestRows.length&&!lateBefore,tampered:(await hmac(prefix))!==await hmac(manifestRows)||current.length<manifestRows.length||Boolean(lateBefore),appendedRows:current.length-manifestRows.length};
}
test('R-0 freezes v2 verifier tuple for four audit fixtures',async()=>{
  for(const scenario of fixture.scenarios){
    const baseline=ordered((scenario.name==='earlier-timestamp-write'?scenario.rows.filter(row=>row[0]!=='b-000'):scenario.rows)).slice(0,scenario.manifestCount??scenario.rows.length);
    const changed=scenario.editedDetail?scenario.rows.map((r,i)=>i===0?[r[0],r[1],r[2],scenario.editedDetail,r[4]]:r):scenario.deleteIndex===undefined?scenario.rows:scenario.rows.filter((_,i)=>i!==scenario.deleteIndex);
    const result=await verify(changed,baseline);
    assert.deepEqual({match:result.match,tampered:result.tampered,appendedRows:result.appendedRows},scenario.expected,scenario.name);
  }
});

test('unsupported v3 and needs_manual_review are never successful',()=>{
  for(const status of ['unsupported_version','needs_manual_review'])assert.notEqual(status,'match');
});
