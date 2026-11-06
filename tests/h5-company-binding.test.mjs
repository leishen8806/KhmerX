import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCustomerCompanyConfig,deploymentCustomerCompany} from '../deploy/standalone/company-config.mjs';

test('single-company deployment binds H5 and Mini App to the same company',()=>{
 const config={companies:[{id:'t_gray'}],customerCompanyId:'t_gray'};
 assert.equal(deploymentCustomerCompany(config),'t_gray');
 assert.equal(assertCustomerCompanyConfig(config,{requireExplicit:true}),'t_gray');
 const gateway=readFileSync('deploy/standalone/server.mjs','utf8');
 const telegram=readFileSync('app/api/h5/auth/telegram/route.ts','utf8');
 assert.match(gateway,/PAYEASE_DEPLOYMENT_COMPANY_ID/);
 assert.match(gateway,/filter\(x=>x&&!x\.startsWith\('payease_company='/);
 assert.match(telegram,/CHANNEL_COMPANY_MISMATCH/);
});

test('multi-company deployment never defaults to the first company',()=>{
 const config={companies:[{id:'t_a'},{id:'t_b'}]};
 assert.equal(deploymentCustomerCompany(config),null);
 assert.throws(()=>assertCustomerCompanyConfig(config,{requireExplicit:true}),/binding is required/);
 const gateway=readFileSync('deploy/standalone/server.mjs','utf8');
 assert.match(gateway,/multi-company deployments without a binding/i);
});

test('explicit binding rejects a company outside the deployment config',()=>{
 assert.throws(()=>assertCustomerCompanyConfig({customerCompanyId:'t_other',companies:[{id:'t_gray'}]}),/does not match companies/);
});
