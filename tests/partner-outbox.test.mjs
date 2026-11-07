import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source=await readFile(new URL('../lib/partner-outbox.ts',import.meta.url),'utf8');
const migration=await readFile(new URL('../drizzle/0064_partner_outbox.sql',import.meta.url),'utf8');

test('partner outbox schema keeps delivery state and unique idempotency',()=>{
 assert.match(migration,/idempotency_key TEXT NOT NULL UNIQUE/);
 assert.match(migration,/status TEXT NOT NULL CHECK .*pending.*sending.*delivered.*dead/s);
 assert.match(migration,/attempts INTEGER NOT NULL DEFAULT 0/);
 assert.match(migration,/next_attempt_at INTEGER NOT NULL DEFAULT 0/);
 assert.match(migration,/last_error TEXT/);
});

test('outbox payload derives a partner reference and contains no customer identifiers',()=>{
 assert.match(source,/deriveCustomerRef/);
 assert.match(source,/tenantId}\|\$\{institutionId}\|\$\{customerId}/);
 assert.match(source,/applicationId/);
 assert.doesNotMatch(source,/phoneMasked/);
});

test('outbox writes are external-mode gated and idempotent',()=>{
 assert.match(source,/INSERT OR IGNORE INTO partner_outbox/);
 assert.match(source,/WHERE \?='external'/);
 assert.match(source,/idempotencyKey/);
});

test('dispatcher claims at most twenty pending rows and uses bounded retries',()=>{
 assert.match(source,/LIMIT 20/);
 assert.match(source,/status='sending'/);
 assert.match(source,/Math\.min\(3600,30\*2\*\*/);
 assert.match(source,/24\*60\*60\*1000/);
});

test('dispatcher treats 2xx and 409 as delivered and keeps error codes only',()=>{
 assert.match(source,/status>=200&&status<300\)\|\|status===409/);
 assert.match(source,/HTTP_409/);
 assert.match(source,/TIMEOUT/);
 assert.doesNotMatch(source,/response\.text\(|row\.payload.*console/);
});

test('outbound requests are signed, HTTPS-only, and time out after ten seconds',()=>{
 assert.match(source,/url\.protocol==='https:'/);
 assert.match(source,/x-partner-id/);
 assert.match(source,/x-idempotency-key/);
 assert.match(source,/x-signature/);
 assert.match(source,/setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
});
