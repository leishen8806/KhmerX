import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'check-client-boundary.mjs');

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'khmerx-client-boundary-'));
  await mkdir(join(root, 'app'), { recursive: true });
  await mkdir(join(root, 'components'), { recursive: true });
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
  }
  return root;
}

function run(root, scriptPath = script) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, CLIENT_BOUNDARY_ROOT: root },
  });
}

async function expectViolation(files) {
  const root = await fixture(files);
  try { assert.equal(run(root).status, 1); } finally { await rm(root, { recursive: true, force: true }); }
}

test('rejects direct cloudflare import', () => expectViolation({
  'app/a.tsx': '"use client"; import { env } from "cloudflare:workers";',
}));

test('rejects direct node builtin import', () => expectViolation({
  'app/a.tsx': '"use client"; import fs from "node:fs";',
}));

test('rejects direct D1 store alias import', () => expectViolation({
  'app/a.tsx': '"use client"; import { readState } from "@/lib/store";',
  'lib/store.ts': 'export const readState = () => null;',
}));

test('rejects direct D1 store relative import', () => expectViolation({
  'components/a.tsx': "'use client'; import { readState } from '../lib/store.ts';",
  'lib/store.ts': 'export const readState = () => null;',
}));

test('rejects one-level indirect server import', () => expectViolation({
  'app/a.tsx': '"use client"; import { value } from "@/lib/bridge";',
  'lib/bridge.ts': 'import { env } from "cloudflare:workers"; export const value = env;',
}));

test('resolves @ alias without extension', () => expectViolation({
  'app/a.tsx': '"use client"; import { value } from "@/lib/team/server";',
  'lib/team/server.ts': 'export const value = 1;',
}));

test('legal client utility import passes', async () => {
  const root = await fixture({
    'app/a.tsx': '"use client"; import { value } from "@/lib/ui";',
    'lib/ui.ts': 'export const value = 1;',
  });
  try { assert.equal(run(root).status, 0); } finally { await rm(root, { recursive: true, force: true }); }
});

test('explicit exemption can match a named existing rule', async () => {
  const root = await fixture({
    'app/a.tsx': '"use client"; import { value } from "@/lib/team/server";',
    'lib/team/server.ts': 'export const value = 1;',
  });
  const tempScript = join(root, 'check.mjs');
  const source = await readFile(script, 'utf8');
  await writeFile(tempScript, source.replace(
    'export const EXEMPTIONS = Object.freeze({\n  // path|rule: { reason: \'...\', date: \'YYYY-MM-DD\' }\n});',
    "export const EXEMPTIONS = Object.freeze({ 'app/a.tsx|direct:lib/team/server.ts': { reason: 'legacy fixture', date: '2026-11-06' } });",
  ));
  try { assert.equal(run(root, tempScript).status, 0); } finally { await rm(root, { recursive: true, force: true }); }
});

test('eight boundary mutations are killed by the focused fixtures', async () => {
  const cases = [
    ['drop D1 rule', /  'db\/index\.ts': 'D1 binding access',\n/, '', { 'app/a.tsx': '"use client"; import x from "@/db/index";', 'db/index.ts': 'export default 1;' }],
    ['drop cloudflare rule', /  if \(specifier === 'cloudflare:workers'\) return \['cloudflare:workers', 'Cloudflare binding import'\];\n/, '', { 'app/a.tsx': '"use client"; import x from "cloudflare:workers";' }],
    ['drop node rule', /  if \(specifier\.startsWith\('node:'\)\) return \['node: builtin', 'Node-only builtin import'\];\n/, '', { 'app/a.tsx': '"use client"; import x from "node:fs";' }],
    ['disable indirect check', /if \(indirect && !exemption\(clientPath, `indirect:\$\{indirect\[0\]\}`\)\)/, 'if (false)', { 'app/a.tsx': '"use client"; import x from "@/lib/bridge";', 'lib/bridge.ts': 'import x from "cloudflare:workers";' }],
    ['disable alias resolution', "if (specifier.startsWith('@/')) base = resolve(root, specifier.slice(2));", "if (specifier.startsWith('@/')) base = null;", { 'app/a.tsx': '"use client"; import x from "@/lib/store";', 'lib/store.ts': 'export default 1;' }],
    ['disable relative resolution', "else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);", "else if (specifier.startsWith('.')) base = null;", { 'components/a.tsx': '"use client"; import x from "../lib/store";', 'lib/store.ts': 'export default 1;' }],
    ['exempt everything', /function exemption\(path, rule\) \{ return EXEMPTIONS\[\`\$\{path\}\|\$\{rule\}\`\]; \}/, 'function exemption(path, rule) { return true; }', { 'app/a.tsx': '"use client"; import x from "@/lib/store";', 'lib/store.ts': 'export default 1;' }],
    ['ignore violations', /if \(violations\.length\) \{/, 'if (false) {', { 'app/a.tsx': '"use client"; import x from "@/lib/store";', 'lib/store.ts': 'export default 1;' }],
  ];
  for (const [name, pattern, replacement, files] of cases) {
    const root = await fixture(files);
    const mutated = join(root, 'check.mjs');
    const source = await readFile(script, 'utf8');
    assert.ok(typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source), name + ' mutation target missing');
    await writeFile(mutated, source.replace(pattern, replacement));
    try { assert.equal(run(root, mutated).status, 0, name + ' was not killed'); } finally { await rm(root, { recursive: true, force: true }); }
  }
});

