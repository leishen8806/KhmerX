#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const roots=process.argv.slice(2);const files=[];
function walk(p){if(!fs.existsSync(p))return;const s=fs.statSync(p);if(s.isDirectory()){for(const n of fs.readdirSync(p))walk(path.join(p,n));}else if(/\.(css|scss|tsx|ts|dart)$/.test(p))files.push(p)}
(roots.length?roots:['app','mobile','khmerx-website']).forEach(walk);
const counts=new Map();for(const f of files){const text=fs.readFileSync(f,'utf8');for(const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)){const v=m[0].toLowerCase();const a=counts.get(v)||{count:0,files:new Set};a.count++;a.files.add(f);counts.set(v,a)}}
console.log(JSON.stringify([...counts].sort((a,b)=>b[1].count-a[1].count).map(([value,v])=>({value,count:v.count,files:[...v.files]})),null,2));
