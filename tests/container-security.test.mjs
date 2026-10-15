import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('API containers run as an unprivileged user', () => {
  for (const file of ['deploy/api/Dockerfile', 'deploy/standalone/Dockerfile']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /^USER (?!root\b)\S+$/m, `${file} must set a non-root runtime user`);
  }
});

test('both gateway images package every locally imported module',()=>{
 const server=fs.readFileSync('deploy/standalone/server.mjs','utf8');
 const imports=[...server.matchAll(/from '\.\/([^']+\.mjs)'/g)].map(x=>x[1]);assert(imports.includes('maintenance.mjs'));
 for(const file of ['deploy/api/Dockerfile','deploy/standalone/Dockerfile'])assert.match(fs.readFileSync(file,'utf8'),/^COPY deploy\/standalone\/\*\.mjs \.\/$/m);
 for(const file of imports)assert(fs.existsSync('deploy/standalone/'+file));
});
