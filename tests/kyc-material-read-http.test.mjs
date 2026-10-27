import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('material GET audits reviewer reads before object access and uses server write time',async()=>{
 const source=await readFile(new URL('../app/api/kyc/files/route.ts',import.meta.url),'utf8');
 const audit=source.indexOf('await auditMaterialRead('),bucket=source.indexOf('const ref=await metadata(row),object=await bucket().get');
 assert.notEqual(audit,-1);assert.notEqual(bucket,-1);assert.ok(audit<bucket,'audit must complete before bucket access');
 assert.match(source,/action=\(url\.searchParams\.get\('view'\)\|\|'read'\) as MaterialReadAction/);
 assert.match(source,/requestId=requestIdOf\(request\)\?\?resolveRequestId\(request\)/);
 assert.match(source,/revision:current\.revision/);assert.match(source,/Date\.now\(\),db\(\)/);
 assert.match(source,/if\(review\)\{await auditMaterialRead/);
});

test('GET contract keeps customer reads unchanged while reviewer reads require audit',async()=>{
 const source=await readFile(new URL('../app/api/kyc/files/route.ts',import.meta.url),'utf8');
 assert.match(source,/if\(review\)\{const staff=await reviewer\(\)/);
 assert.match(source,/else\{const c=await context\(request\)/);
 assert.doesNotMatch(source,/auditMaterialRead\([^\n]*customerId/);
});
