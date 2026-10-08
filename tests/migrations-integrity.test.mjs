import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
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
