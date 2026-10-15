import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('API containers run as an unprivileged user', () => {
  for (const file of ['deploy/api/Dockerfile', 'deploy/standalone/Dockerfile']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /^USER (?!root\b)\S+$/m, `${file} must set a non-root runtime user`);
  }
});
