import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../drizzle/0066_partner_outbox_requeue.sql',import.meta.url),'utf8');
const route=await readFile(new URL('../app/api/team/partner-outbox/route.ts',import.meta.url),'utf8');
const client=await readFile(new URL('../app/team/partner-outbox-client.tsx',import.meta.url),'utf8');

test('0066 adds requeue metadata and dead-letter route is admin-only',()=>{
 assert.match(migration,/ADD COLUMN requeued_at TEXT/);
 assert.match(migration,/ADD COLUMN requeue_count INTEGER NOT NULL DEFAULT 0/);
 assert.match(route,/s\.member\.role!==['"]admin/);
 assert.match(route,/p\.action!=='requeue'/);
 assert.match(route,/REASON_REQUIRED/);
 assert.match(route,/status='dead'/);
 assert.match(route,/requeue_count=requeue_count\+1/);
 assert.match(route,/partner_outbox_requeue/);
 assert.doesNotMatch(route,/SELECT .*payload/);
 assert.match(client,/window\.confirm/);
});

test('requeue preserves payload and idempotency key while resetting delivery state',()=>{
 assert.match(route,/SET status='pending',attempts=0,next_attempt_at=\?,lease_until=NULL,requeued_at=\?,requeue_count=requeue_count\+1/);
 assert.doesNotMatch(route,/UPDATE partner_outbox SET .*payload/);
 assert.doesNotMatch(route,/UPDATE partner_outbox SET .*idempotency_key/);
});
