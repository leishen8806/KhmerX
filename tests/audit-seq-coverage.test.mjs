import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function sourceFiles(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const path=join(directory,entry.name);
    return entry.isDirectory()?sourceFiles(path):/\.(?:ts|tsx|js|jsx)$/.test(entry.name)?[path]:[];
  });
}

test('every team_audit INSERT declares and populates seq',()=>{
  const inserts=sourceFiles(join(root,'lib')).concat(sourceFiles(join(root,'app'))).flatMap(file=>{
    const source=readFileSync(file,'utf8');
    return [...source.matchAll(/INSERT(?: OR IGNORE)?\s+INTO\s+team_audit\b\s*(\([^)]*\))/gi)].map(match=>({file,columns:match[1]}));
  });
  assert.equal(inserts.length,30);
  assert.deepEqual(inserts.filter(insert=>!/(^|,)\s*seq\s*(,|$)/i.test(insert.columns)),[]);
});
