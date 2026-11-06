import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scripts = [
  join(root, 'scripts', 'check-client-boundary.mjs'),
  join(root, 'scripts', 'package-separated.mjs'),
];

test('script roots use fileURLToPath on Windows and POSIX', async () => {
  for (const file of scripts) {
    const source = await readFile(file, 'utf8');
    assert.equal(source.includes('import.meta.url).pathname'), false, file);
    assert.match(source, /fileURLToPath\(new URL\('\.\.',import\.meta\.url\)\)/, file);
  }
});

test('client boundary script runs successfully from the repository root', () => {
  const result = spawnSync(process.execPath, [scripts[0]], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

