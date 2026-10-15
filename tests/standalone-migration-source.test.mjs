import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('standalone server parses after gateway changes are merged',()=>{
 const result=spawnSync(process.execPath,['--check','deploy/standalone/server.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('standalone server uses the shared migration splitter',()=>{
 const source=readFileSync('deploy/standalone/server.mjs','utf8');
 assert.match(source,/import \{splitSql\} from '\.\/sql-split\.mjs';/);
 assert.doesNotMatch(source,/function splitSql\(/);
});
