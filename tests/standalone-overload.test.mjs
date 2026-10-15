import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../deploy/standalone/server.mjs', import.meta.url), 'utf8');

test('standalone gateway has bounded overload and upload protection', () => {
  assert.match(source, /PAYEASE_MAX_IN_FLIGHT/);
  assert.match(source, /PAYEASE_MAX_UPLOADS/);
  assert.match(source, /PAYEASE_MAX_BODY_BYTES/);
  assert.match(source, /Retry-After/);
  assert.match(source, /'SERVICE_UNAVAILABLE'/);
  assert.match(source, /'PAYLOAD_TOO_LARGE'/);
  assert.match(source, /'X-Request-Id':requestId/);
  assert.match(source, /server\.headersTimeout=30000/);
  assert.match(source, /server\.requestTimeout=60000/);
  assert.match(source, /req\.setTimeout\(isUpload\?60000:30000\)/);
  assert.match(source, /startsWith\('\/api\/kyc\/files'\)/);
});
