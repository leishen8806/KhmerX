import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('standalone migration inventory is continuous and uniquely numbered', () => {
  const root = join(process.cwd(), 'drizzle');
  const files = readdirSync(root)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  assert.ok(files.length > 0, 'migration directory must not be empty');
  const numbers = files.map((name) => Number(name.slice(0, name.indexOf('_'))));
  assert.equal(new Set(numbers).size, numbers.length, 'migration numbers must be unique');
  for (let i = 1; i < numbers.length; i += 1) {
    assert.equal(numbers[i], numbers[i - 1] + 1, `migration sequence gap before ${files[i]}`);
  }
});

test('0065 public reference backfill is scoped, repeat-safe and reversible', () => {
  const db = new DatabaseSync(':memory:');
  const root = join(process.cwd(), 'drizzle');
  for (const name of readdirSync(root).filter((file) => /^\d+_.+\.sql$/.test(file) && Number(file.slice(0, file.indexOf('_'))) <= 64).sort()) {
    db.exec(readFileSync(join(root, name), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  const workspace = { loans: [
    { id: 'loan-a1', publicRef: 'PUB-A1' },
    { id: 'loan-a2', publicRef: 'PUB-A2' },
  ] };
  const otherWorkspace = { loans: [{ id: 'loan-a1', publicRef: 'PUB-WRONG-CUSTOMER' }] };
  db.prepare('INSERT INTO customer_workspaces(owner,customer_id,payload,updated_at) VALUES (?,?,?,?)').run('tenant-a', 'customer-a', JSON.stringify(workspace), '2026-11-09T00:00:00Z');
  db.prepare('INSERT INTO customer_workspaces(owner,customer_id,payload,updated_at) VALUES (?,?,?,?)').run('tenant-a', 'customer-b', JSON.stringify(otherWorkspace), '2026-11-09T00:00:00Z');
  db.prepare('INSERT INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('tenant-a', 'loan-a1', 'customer-a', 'submitted', '2026-11-09T00:00:00Z', '2026-11-09T00:00:00Z');
  db.prepare('INSERT INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('tenant-a', 'loan-a2', 'customer-a', 'submitted', '2026-11-09T00:00:00Z', '2026-11-09T00:00:00Z');
  db.prepare('INSERT INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('tenant-a', 'loan-a1-b', 'customer-b', 'submitted', '2026-11-09T00:00:00Z', '2026-11-09T00:00:00Z');
  const migration = readFileSync(join(root, '0065_loan_index_public_ref.sql'), 'utf8').replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  assert.deepEqual(db.prepare('SELECT loan_id,public_ref FROM loan_index ORDER BY loan_id').all().map((row) => ({ ...row })), [
    { loan_id: 'loan-a1', public_ref: 'PUB-A1' },
    { loan_id: 'loan-a1-b', public_ref: null },
    { loan_id: 'loan-a2', public_ref: 'PUB-A2' },
  ]);
  db.exec("UPDATE loan_index SET public_ref=(SELECT json_extract(loan.value,'$.publicRef') FROM customer_workspaces c,json_each(c.payload,'$.loans') loan WHERE c.owner=loan_index.owner AND c.customer_id=loan_index.customer_id AND json_extract(loan.value,'$.id')=loan_index.loan_id LIMIT 1) WHERE public_ref IS NULL");
  assert.deepEqual(db.prepare('SELECT loan_id,public_ref FROM loan_index ORDER BY loan_id').all().map((row) => ({ ...row })), [
    { loan_id: 'loan-a1', public_ref: 'PUB-A1' },
    { loan_id: 'loan-a1-b', public_ref: null },
    { loan_id: 'loan-a2', public_ref: 'PUB-A2' },
  ]);
  db.exec(readFileSync(join(root, '0065_loan_index_public_ref.down'), 'utf8'));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='index' AND name='loan_index_public_ref_unique'").get().count, 0);
  db.close();
});
