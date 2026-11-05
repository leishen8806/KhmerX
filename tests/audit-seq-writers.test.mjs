import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

test('all team_audit writers include seq', () => {
  const files = execFileSync('git', ['ls-files', 'app', 'lib'], {encoding: 'utf8'})
    .trim().split('\n').filter(Boolean);
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/INSERT\s+(OR\s+\w+\s+)?INTO\s+team_audit\s*\(([^)]*)\)/gi)) {
      if (!/\bseq\b/i.test(match[2])) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('audit writer guards are enum values, never interpolated SQL', () => {
  const source = readFileSync('lib/team/audit-writer.ts', 'utf8');
  assert.match(source, /type AuditWhere = 'always'\|'changed'\|'changed-positive'\|'tenant-exists'\|'kyc-followup'/);
  assert.doesNotMatch(source, /WHERE \$\{where\}/);
});

test('0062 backfills legacy sequences and restores strict append-only trigger', () => {
  const sql = readFileSync('drizzle/0062_audit_manifest_v3_seq.sql', 'utf8');
  assert.match(sql, /ROW_NUMBER\(\) OVER \(ORDER BY created_at,id\)/);
  const triggers = [...sql.matchAll(/CREATE TRIGGER team_audit_no_update[\s\S]*?;/g)];
  assert.ok(triggers.length > 0);
  const last = triggers.at(-1)[0];
  assert.doesNotMatch(last, /WHEN[\s\S]*seq/);
});
