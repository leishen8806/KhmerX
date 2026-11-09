import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function mjsFiles(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const nested = await Promise.all(entries.map(async entry => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? mjsFiles(file) : entry.name.endsWith('.mjs') ? [file] : [];
  }));
  return nested.flat();
}

const scripts = [join(root, 'scripts', 'check-client-boundary.mjs'), join(root, 'scripts', 'package-separated.mjs')];

test('all scripts and tests avoid Windows URL pathname access', async () => {
  const files = [...await mjsFiles(join(root, 'scripts')), ...await mjsFiles(join(root, 'tests'))];
  const pathname = ['import.meta.url', ').pathname'].join('');
  const scriptPathname = ['script', '.pathname'].join('');
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.equal(source.includes(pathname), false, file);
    assert.equal(source.includes(scriptPathname), false, file);
  }
  for (const file of scripts) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /fileURLToPath\(new URL\('\.\.',import\.meta\.url\)\)/, file);
  }
});

test('client boundary script runs successfully from the repository root', () => {
  const result = spawnSync(process.execPath, [scripts[0]], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

