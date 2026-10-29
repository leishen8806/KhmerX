#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const roots=process.argv.slice(2);const files=[];
function walk(p){if(!fs.existsSync(p))return;const s=fs.statSync(p);if(s.isDirectory()){for(const n of fs.readdirSync(p))walk(path.join(p,n));}else if(/\.(css|scss|tsx|ts|dart)$/.test(p))files.push(p)}
(roots.length?roots:['app','mobile','khmerx-website']).forEach(walk);
const patterns={color:/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g,'font-size':/font-size\s*:\s*([^;]+)/g,'line-height':/line-height\s*:\s*([^;]+)/g,'border-radius':/border-radius\s*:\s*([^;]+)/g,spacing:/(?:margin|padding|gap)\s*:\s*([^;]+)/g,'box-shadow':/box-shadow\s*:\s*([^;]+)/g};
const out=[];for(const f of files){const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);for(const [kind,re] of Object.entries(patterns))lines.forEach((line,i)=>{for(const m of line.matchAll(re)){const value=(m[1]||m[0]).trim();out.push({kind,value,file:f,line:i+1})}})}
const grouped=new Map();for(const x of out){const k=x.kind+'\0'+x.value;const a=grouped.get(k)||{kind:x.kind,value:x.value,count:0,locations:[]};a.count++;if(a.locations.length<20)a.locations.push(`${x.file}:${x.line}`);grouped.set(k,a)}
console.log(JSON.stringify([...grouped.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||b.count-a.count),null,2));
