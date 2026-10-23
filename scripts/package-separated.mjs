import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const dist=join(root,'dist');
const out=join(root,'dist-separated');
const client=join(out,'client');
const api=join(out,'api');

await rm(out,{recursive:true,force:true});
await mkdir(client,{recursive:true});
await mkdir(api,{recursive:true});

// Vinext currently emits browser assets and the Worker/SSR bundle separately.
// Keep those as independently deployable artifacts without pretending that the
// SSR server has already been rewritten into a pure SPA/API split.
await cp(join(dist,'client'),client,{recursive:true});
await cp(join(dist,'server'),join(api,'server'),{recursive:true});
for(const name of ['drizzle','deploy'])await cp(join(root,name),join(api,name),{recursive:true});
await writeFile(join(client,'artifact.json'),JSON.stringify({kind:'edge-client-assets',generatedAt:new Date().toISOString(),source:'dist/client',apiMode:'same-origin-proxy-with-ssr-fallback',requiresApiFallback:true},null,2)+'\n');
await writeFile(join(api,'artifact.json'),JSON.stringify({kind:'api-worker-compatible',generatedAt:new Date().toISOString(),source:'dist/server',clientMode:'same-origin-proxy',note:'SSR routes remain in the Worker bundle until the client-rendering spike is completed.'},null,2)+'\n');

const forbidden=/(^|\/)(\.env|\.env\.|config\.json|private|secrets?)(\/|$)/i;
const leaks=[];
async function walk(dir){
 for(const entry of await (await import('node:fs/promises')).readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(forbidden.test(path.slice(out.length+1)))leaks.push(path.slice(out.length+1));
  if(entry.isDirectory())await walk(path);
 }
}
await walk(out);
if(leaks.length)throw new Error(`Separated artifact contains forbidden paths: ${leaks.join(', ')}`);
const clientManifest=JSON.parse(await readFile(join(client,'artifact.json'),'utf8'));
const apiManifest=JSON.parse(await readFile(join(api,'artifact.json'),'utf8'));
console.log(JSON.stringify({out:'dist-separated',client:clientManifest.kind,api:apiManifest.kind,leaks:0},null,2));
