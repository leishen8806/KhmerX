import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','lib','team','crm-subpages.ts'),'utf8');

test('CRM menu contract keeps every configured submenu independently described',()=>{
  const labels=[...source.matchAll(/items:\[([\s\S]*?)\]/g)]
    .flatMap(([,items])=>[...items.matchAll(/['"]([^'"]+)['"]/g)].map(([,label])=>label));
  assert.equal(labels.length,59,'menu item count changed; update the acceptance matrix intentionally');
  assert.equal(new Set(labels).size,labels.length,'menu labels must be unique for in-page routing');
  const descriptions=source.match(/const descriptions:Record<string,string>=\{([\s\S]*?)\};/);
  assert(descriptions,'CRM descriptions block is missing');
  const described=new Set([...descriptions[1].matchAll(/['"]([^'"]+)['"]\s*:/g)].map(([,label])=>label));
  assert.deepEqual(labels.filter(label=>!described.has(label)),[],'every submenu needs a specific description');
});
