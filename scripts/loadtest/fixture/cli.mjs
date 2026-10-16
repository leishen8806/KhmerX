import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepare,check} from './core.mjs';
import {writer} from './private-file.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
try{
 const [command,...argv]=process.argv.slice(2),args={},flags=['apply','dry-run'],keys=['config','profile','database','base-url','run-id','count','dataset','confirm','output'];
 for(let i=0;i<argv.length;i++){check(argv[i].startsWith('--'),'Unknown argument');const k=argv[i].slice(2);check([...flags,...keys].includes(k)&&!Object.hasOwn(args,k),'Unknown or duplicate argument');args[k]=flags.includes(k)?true:argv[++i];check(args[k]!==undefined,'Argument missing')}
 check(['plan','apply'].includes(command)&&!(args.apply&&args['dry-run']),'Use plan or apply; conflicting flags refused');
 const config=JSON.parse(readFileSync(args.config,'utf8')),apply=command==='apply'&&!!args.apply;
 const options={root,config,profile:args.profile,database:args.database,baseUrl:args['base-url'],runId:args['run-id'],dataset:args.dataset,count:args.count===undefined?undefined:Number(args.count),apply,confirm:args.confirm};
 let output;
 try{if(apply){check(args.output,'Private output required');output=writer(root,resolve(args.output));options.persist=output.persist}const result=prepare(options);console.log(JSON.stringify({summary:result.summary,fingerprint:result.fingerprint,applied:!!result.manifest}))}catch(e){output?.rollback();throw e}
}catch{console.error('Fixture rejected; verify local target, schema, fingerprint and private output path');process.exitCode=1}
