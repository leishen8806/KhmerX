import test from 'node:test';
import assert from 'node:assert/strict';
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

test('0065 public reference backfill is scoped and repeat-safe', () => {
  const migration = readFileSync(join(process.cwd(), 'drizzle', '0065_loan_index_public_ref.sql'), 'utf8');
  assert.match(migration, /ALTER TABLE loan_index ADD COLUMN public_ref TEXT/);
  assert.match(migration, /json_each\(c\.payload,'\$\.loans'\)/);
  assert.match(migration, /json_extract\(loan\.value,'\$\.publicRef'\)/);
  assert.match(migration, /WHERE public_ref IS NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX loan_index_public_ref_unique/);
  const down = readFileSync(join(process.cwd(), 'drizzle', '0065_loan_index_public_ref.down'), 'utf8');
  assert.match(down, /DROP INDEX IF EXISTS loan_index_public_ref_unique/);
});
