import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('employee pagination migration adds tenant-scoped list indexes',()=>{
  const sql=fs.readFileSync('drizzle/0058_team_member_list_indexes.sql','utf8');
  assert.match(sql,/team_members_tenant_active_email/);
  assert.match(sql,/team_members_tenant_active_role/);
  assert.match(sql,/team_members_tenant_active_unit/);
  assert.match(sql,/IF NOT EXISTS/g);
});
