// Brings the LOCAL dev D1 (the miniflare sqlite used by `npm run dev`) up to the
// current schema. The dev server does not run drizzle migrations itself, so an
// older local database misses newer tables (e.g. h5_browser_tokens) and the API
// answers 500. Dev only: tolerant of objects that already exist, tracked in
// dev_migrations so it is a no-op the second time. Never run against anything
// but the local .wrangler state.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDevDb, ROOT } from './common.mjs';
import { splitSql as splitSqlStatements } from '../../deploy/standalone/sql-split.mjs';

const ALREADY = /already exists|duplicate column name|no such (table|column)|UNIQUE constraint failed/i;

export function migrateDev(db = openDevDb()) {
  db.exec('CREATE TABLE IF NOT EXISTS dev_migrations (name TEXT PRIMARY KEY)');
  const done = new Set(db.prepare('SELECT name FROM dev_migrations').all().map((r) => r.name));
  const dir = join(ROOT, 'drizzle');
  const files = readdirSync(dir).filter((f) => /^\d.*\.sql$/.test(f)).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    // Some retired migrations intentionally contain comments only. Do not
    // feed those files to the SQL splitter as if the prose were SQL.
    if (!sql.replace(/--[^\n]*/g, '').trim()) {
      db.prepare('INSERT OR IGNORE INTO dev_migrations(name) VALUES (?)').run(f);
      applied++;
      continue;
    }
    for (const stmt of splitSqlStatements(sql)) {
      try {
        db.exec(stmt);
      } catch (e) {
        if (!ALREADY.test(String(e.message))) {
          throw new Error(`migration ${f} failed: ${e.message}\n${stmt.slice(0, 200)}`);
        }
      }
    }
    db.prepare('INSERT OR IGNORE INTO dev_migrations(name) VALUES (?)').run(f);
    applied++;
  }
  return applied;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('dev migrations applied:', migrateDev());
}
