// Shared helpers for the local APP backend (dev only; never used in production).
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC_COMPANY_ID = 't_00000000-0000-4000-8000-000000000001';
// The Miniflare worker (built output dist/server) is the APP backend. command in
// `npm start`: `wrangler dev --local --persist-to .wrangler/state --ip 127.0.0.1`.
export const MF_PORT = Number(process.env.APP_MF_PORT || 8788);
export const MF_ORIGIN = `http://127.0.0.1:${MF_PORT}`;
export const PROXY_PORT = Number(process.env.APP_BACKEND_PORT || 80);

/** Finds the miniflare D1 sqlite file used by `wrangler dev --local` (the one with the team tables). */
export function openDevDb() {
  const dir = join(ROOT, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
  if (!existsSync(dir)) throw new Error('No local D1 state yet. Start the harness once (scripts/dev-app-backend/start.mjs) so migrations run.');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.sqlite') || f === 'metadata.sqlite') continue;
    const db = new DatabaseSync(join(dir, f));
    const has = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='team_companies'").get();
    if (has) return db;
    db.close();
  }
  throw new Error('Local D1 has no team_companies table: the dev server has not applied migrations yet.');
}

export function readEnvLocal() {
  const p = join(ROOT, '.env.local');
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}
