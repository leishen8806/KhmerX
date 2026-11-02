import {readFile,readdir} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function filesUnder(dir){
 const out=[];
 for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){
  const path=resolve(root,dir,entry.name);
  if(entry.isDirectory()&&entry.name!=='api')out.push(...await filesUnder(path.slice(root.length+1)));
  else if(entry.isFile()&&/\.(ts|tsx)$/.test(entry.name))out.push(path);
 }
 return out;
}
const files=[...(await filesUnder('app')),...(await filesUnder('components'))];
const forbidden=[
 /from\s+["']cloudflare:workers["']/,
 /from\s+["']@\/lib\/(store|team\/server|kyc\/server)["'] /,
 /from\s+["']@\/lib\/(store|team\/server|kyc\/server)["']/,
 /from\s+["'][^"']*\/lib\/(store|team\/server|kyc\/server)["']/,
];
const violations=[];
for(const file of files){
 const source=await readFile(file,'utf8');
 if(!/^['"]use client['"];?/m.test(source))continue;
 for(const pattern of forbidden){
  if(pattern.test(source))violations.push(`${relative(root,file)}: ${pattern}`);
 }
}
if(violations.length){console.error('Client boundary violations detected:\n'+violations.join('\n'));process.exit(1)}
console.log(`Client boundary check passed (${files.length} source files scanned).`);
