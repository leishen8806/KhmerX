import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.CLIENT_BOUNDARY_ROOT || resolve(scriptDir, '..'));

// Server-only: D1/R2, env bindings, Node APIs, Telegram/scanner, or callbacks.
export const FORBIDDEN_MODULES = Object.freeze({
  'db/index.ts': 'D1 binding access',
  'lib/store.ts': 'D1 workspace store',
  'lib/customer-shards.ts': 'D1 customer shard queries',
  'lib/customer-cleanup.ts': 'D1 cleanup and Telegram records',
  'lib/h5-auth.ts': 'Cloudflare env and D1 authentication',
  'lib/postloan/server.ts': 'Cloudflare env and D1 post-loan state',
  'lib/notifications/server.ts': 'D1 plus Telegram notification delivery',
  'lib/bot-credentials.ts': 'env, D1, and Telegram bot verification',
  'lib/team/server.ts': 'Cloudflare env and D1 staff session',
  'lib/team/auth.ts': 'Cloudflare env and staff authentication',
  'lib/team/audit-integrity.ts': 'Cloudflare env and D1 audit checks',
  'lib/team/admin-funds.ts': 'Cloudflare env and D1 fund operations',
  'lib/runtime-guards.ts': 'Cloudflare env runtime guards',
  'lib/request-security.ts': 'Cloudflare env request security',
  'lib/kyc/server.ts': 'Cloudflare env and D1 KYC server operations',
  'lib/kyc/reveal-token.ts': 'Cloudflare env and token storage',
  'lib/institution-callback.ts': 'institution callback verification',
  'lib/institution-callback-queue.ts': 'institution callback queue',
  'lib/institution-callback-consumer.ts': 'institution callback consumer',
  'lib/institution-events.ts': 'institution event persistence',
  'lib/telegram.ts': 'Telegram validation/integration',
});

export const EXEMPTIONS = Object.freeze({
  // path|rule: { reason: '...', date: 'YYYY-MM-DD' }
});

const importPattern = /(?:import\s+(?:[^"']+\s+from\s+)?|export\s+[^"']+\s+from\s+)["']([^"']+)["']/g;
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];

async function filesUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(path));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function rel(path) { return relative(root, path).replaceAll('\\', '/'); }

function resolveImport(from, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(root, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  if (!base) return null;
  for (const suffix of extensions) {
    const candidate = resolve(base + suffix);
    if (candidate.startsWith(root) && existsSync(candidate)) return candidate;
  }
  return null;
}

function exemption(path, rule) { return EXEMPTIONS[`${path}|${rule}`]; }

async function importsOf(file) {
  const source = await readFile(file, 'utf8');
  const imports = [];
  for (const match of source.matchAll(importPattern)) imports.push({ specifier: match[1], target: resolveImport(file, match[1]) });
  return { source, imports };
}

function forbiddenReason(target, specifier) {
  if (specifier === 'cloudflare:workers') return ['cloudflare:workers', 'Cloudflare binding import'];
  if (specifier.startsWith('node:')) return ['node: builtin', 'Node-only builtin import'];
  if (!target) return null;
  const key = rel(target);
  return FORBIDDEN_MODULES[key] ? [key, FORBIDDEN_MODULES[key]] : null;
}

const violations = [];
const clientFiles = [
  ...(await filesUnder(resolve(root, 'app'))),
  ...(await filesUnder(resolve(root, 'components'))),
];

for (const file of clientFiles) {
  const { source, imports } = await importsOf(file);
  if (!/^['"]use client['"];?/m.test(source)) continue;
  const clientPath = rel(file);
  for (const item of imports) {
    const direct = forbiddenReason(item.target, item.specifier);
    if (direct && !exemption(clientPath, `direct:${direct[0]}`)) {
      violations.push(`${clientPath}: direct-import`);
      continue;
    }
    if (!item.target || !item.target.startsWith(root)) continue;
    const nested = await importsOf(item.target);
    for (const nestedImport of nested.imports) {
      const indirect = forbiddenReason(nestedImport.target, nestedImport.specifier);
      if (indirect && !exemption(clientPath, `indirect:${indirect[0]}`)) violations.push(`${clientPath}: indirect-import ${rel(item.target)} -> ${indirect[0]}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`client-boundary: ok (${clientFiles.length} files scanned)`);
}

