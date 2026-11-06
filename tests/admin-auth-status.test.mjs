import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync('lib/team/server.ts','utf8');
const client=fs.readFileSync('app/team/client.tsx','utf8');

test('team data exposes only non-secret channel and binding status',()=>{
  assert.match(server,/safeAuthStatus/);
  assert.match(server,/PAYEASE_H5_AUTH_MODE\|\|values\.PAYEASE_AUTH_MODE/);
  assert.match(server,/PAYEASE_TELEGRAM_AUTH_MODE/);
  assert.match(server,/customerCompanyBinding/);
  assert.doesNotMatch(server,/return \{[^}]*PAYEASE_AUTH_SECRET/);
  assert.doesNotMatch(server,/gatewayToken:/);
});

test('team UI labels the runtime status panel as read-only',()=>{
  assert.match(client,/渠道认证与公司绑定（只读）/);
  assert.match(client,/status\.h5\?\.mode/);
  assert.match(client,/data\.authStatus/);
  assert.match(client,/不会修改环境变量/);
});
