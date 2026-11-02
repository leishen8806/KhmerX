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
    for (const match of text.matchAll(/INSERT\s+INTO\s+team_audit\s*\(([^)]*)\)/gi)) {
      if (!/\bseq\b/i.test(match[1])) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});
