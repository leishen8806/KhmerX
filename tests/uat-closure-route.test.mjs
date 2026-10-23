import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('app/api/admin/uat-closure/route.ts','utf8');
const migration=fs.readFileSync('drizzle/0063_uat_closure_batches.sql','utf8');

test('UAT closure endpoint is fail-closed and tenant-scoped',()=>{
 assert.match(route,/UAT_CLOSURE_ENABLED/);
 assert.match(route,/UAT_CLOSURE_TOKEN/);
 assert.match(route,/await platformAdmin\(\)/);
 assert.match(route,/\^uat-\[a-z0-9-\]\{3,55\}\$/);
 assert.match(route,/uat_closure_seed/);
 assert.match(route,/uat_closure_clear/);
 assert.match(route,/team_uat_closure_batches/);
 assert.match(route,/assertEmptyUatTenant/);
 assert.match(route,/UAT_TENANT_NOT_EMPTY/);
 assert.match(route,/UAT_WORKSPACE_CONFLICT/);
 assert.match(route,/workspaceRevision/);
});

test('UAT closure batch storage supports idempotency and audit retention',()=>{
 assert.match(migration,/batch_id TEXT PRIMARY KEY/);
 assert.match(migration,/tenant_id TEXT NOT NULL REFERENCES team_companies/);
 assert.match(migration,/team_uat_closure_batches_tenant_batch/);
 assert.match(migration,/team_uat_closure_batches_tenant_status/);
});
