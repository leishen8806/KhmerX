import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('service ticket lists translate enum values instead of rendering raw API codes',()=>{
 const source=read('components/service-tickets.tsx');
 const labels=read('lib/service-ticket-labels.ts');
 for(const value of ['complaint','closed','normal'])assert.match(labels,new RegExp(value));
 assert.match(source,/ticketLabel\('kind',t\.kind,locale\)/);
 assert.match(source,/ticketLabel\('status',t\.status,locale\)/);
 assert.match(source,/ticketLabel\('priority',t\.priority,locale\)/);
 assert.doesNotMatch(source,/<strong>\{t\.kind\}/);
 assert.doesNotMatch(source,/<p>\{t\.customer_id\} · \{t\.status\} · \{t\.priority\}<\/p>/);
});

test('dev funding fixture marks every completed funding step',()=>{
 const seed=read('scripts/dev-app-backend/seed-loan.mjs');
 for(const field of ['approvalActor','approvalCheckedBy','fundingActor','fundingCheckedBy'])assert.match(seed,new RegExp(`${field}:`));
});

test('desktop team sidebar fills the viewport while mobile override remains static',()=>{
 const css=read('app/globals.css');
 assert.match(css,/\.side-rail\{[^}]*position:sticky;top:0;height:100vh;overflow:auto/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.side-rail\{position:static;min-height:0/);
});
