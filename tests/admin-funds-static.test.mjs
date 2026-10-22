import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('admin funding mutations prune idempotency digests before persistence',()=>{
  const source=readFileSync(new URL('../lib/team/admin-funds.ts',import.meta.url),'utf8');
  assert.match(source,/applyAction,requestFingerprint,pruneRequestDigests/);
  assert.match(source,/next\.requestDigests\[key\]=digest;pruneRequestDigests\(next\)/);
});
