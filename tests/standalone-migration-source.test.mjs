import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('standalone server uses the shared migration splitter',()=>{
 const source=readFileSync('deploy/standalone/server.mjs','utf8');
 assert.match(source,/import \{splitSql\} from '\.\/sql-split\.mjs';/);
 assert.doesNotMatch(source,/function splitSql\(/);
});
