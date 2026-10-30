#!/usr/bin/env node
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';

const args=process.argv.slice(2),path=args[args.indexOf('--db')+1],apply=args.includes('--apply');
if(!path||args.includes('--remote')||args.includes('--production')){console.error('usage: --db <local sqlite path> [--apply] (local/backup only)');process.exit(2)}
if(!existsSync(path)){console.error(`database not found: ${path}`);process.exit(2)}
const d=new DatabaseSync(path);const rows=d.prepare('SELECT id FROM team_audit WHERE seq IS NULL ORDER BY created_at ASC,id ASC').all();const max=d.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM team_audit').get().n;const plan=rows.map((row,i)=>({id:row.id,seq:Number(max)+i+1}));const unique=new Set(plan.map(x=>x.seq)).size===plan.length;
if(!unique)throw new Error('planned sequence is not unique');
if(apply){d.exec('BEGIN');try{const q=d.prepare('UPDATE team_audit SET seq=? WHERE id=? AND seq IS NULL');for(const item of plan)q.run(item.seq,item.id);d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}}
console.log(JSON.stringify({mode:apply?'apply':'dry-run',count:plan.length,unique,first:plan[0]||null,last:plan.at(-1)||null},null,2));
