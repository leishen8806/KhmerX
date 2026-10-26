import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateCompanyName,duplicateMemberEmail,companyIdentity} from '../lib/team/company-ui.ts';

test('company warnings compare normalized names, exclude self and retain distinct codes',()=>{
 const companies=[{id:'a',name:'Same',slug:'alpha'},{id:'b',name:'Other',slug:'beta'}];
 assert.equal(duplicateCompanyName(companies,' same '),true);
 assert.equal(duplicateCompanyName(companies,'SAME','a'),false);
 assert.equal(duplicateCompanyName(companies,'Other','a'),true);
 assert.equal(duplicateCompanyName(companies,'   '),false);
 assert.equal(companyIdentity({name:'Same',slug:'alpha'}),'Same · alpha');
 assert.equal(companyIdentity({name:'Same',slug:'beta'}),'Same · beta');
 assert.equal(companies[0].name,'Same');
});
test('email warning uses only supplied current-company members, trims and ignores case',()=>{
 assert.equal(duplicateMemberEmail([{email:'Member@Example.test'}],' member@example.test '),true);
 assert.equal(duplicateMemberEmail([{email:'Member@Example.test',active:0}],'member@example.test'),true);
 assert.equal(duplicateMemberEmail([],'member@example.test'),false);
 assert.equal(duplicateMemberEmail([{email:'someone@example.test'}],''),false);
});
