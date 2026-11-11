import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'lib/team/crm-i18n.ts'),'utf8');
const entries=[...source.matchAll(/\['([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\]/g)].map(([,key,source, en, km])=>({key,source,en,km}));
const descriptions=[...source.matchAll(/\{source:'([^']+)',en:'([^']+)',km:'([^']+)'\}/g)].map(([,source,en,km])=>({source,en,km}));

test('CRM copy catalog has stable unique keys and complete locale values',()=>{
  assert.ok(entries.length>=70,'catalog should cover groups, menu items, lender labels, and frame copy');
  assert.equal(new Set(entries.map(entry=>entry.key)).size,entries.length,'CRM copy keys must be unique');
  for(const entry of entries){
    assert.ok(entry.key.startsWith('group.')||entry.key.startsWith('menu.')||entry.key.startsWith('lender.')||entry.key.startsWith('page.')||entry.key.startsWith('frame.'),entry.key);
    assert.ok(entry.source.trim(),`${entry.key} source is empty`);
    assert.ok(entry.en.trim(),`${entry.key} English translation is empty`);
    assert.ok(entry.km.trim(),`${entry.key} Khmer translation is empty`);
  }
});

test('CRM route identifiers remain Chinese source values',()=>{
  assert.match(fs.readFileSync(path.join(process.cwd(),'lib/team/crm-subpages.ts'),'utf8'),/encodeURIComponent\(label\)/);
  assert.match(fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8'),/crmSubpageHref\(item\[1\],item\[0\]\)/);
});

test('CRM has one real English and Khmer description for every submenu',()=>{
  assert.equal(descriptions.length,59,'every configured submenu needs a translated description');
  for(const entry of descriptions){
    assert.ok(entry.en.trim(),`${entry.source} English description is empty`);
    assert.ok(entry.km.trim(),`${entry.source} Khmer description is empty`);
  }
  assert.doesNotMatch(source,/Review and manage/,'English descriptions must not use the shared template');
  assert.doesNotMatch(source,/ពិនិត្យ និងគ្រប់គ្រង/,'Khmer descriptions must not use the shared template');
});
