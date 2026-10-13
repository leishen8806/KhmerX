import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell} from '../lib/team/csv.ts';

test('CSV cells neutralize spreadsheet formula prefixes and preserve quoting',()=>{
 assert.equal(csvCell('=SUM(A1:A2)'),"'=SUM(A1:A2)");
 assert.equal(csvCell('+cmd'),"'+cmd");
 assert.equal(csvCell('-1'),"'-1");
 assert.equal(csvCell('@user'),"'@user");
 assert.equal(csvCell('a,b'), '"a,b"');
 assert.equal(csvCell('a"b'), '"a""b"');
});
