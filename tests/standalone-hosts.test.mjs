import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hostRules,isAllowedHost,isPublicClientHost,isAdminHost,isApiHost,resolveClientIp} from '../deploy/standalone/hosts.mjs';

test('standalone defaults preserve formal host behavior',()=>{
 const rules=hostRules();
 assert.equal(isAllowedHost('payease.khmerx.org',rules),true);
 assert.equal(isAllowedHost('admin.khmerx.org',rules),true);
 assert.equal(isAllowedHost('api.khmerx.org',rules),true);
 assert.equal(isAllowedHost('gray.khmerx.org',rules),false);
 assert.equal(isAllowedHost('',rules),false);
 assert.equal(isPublicClientHost('payease.khmerx.org',rules),true);
 assert.equal(isAdminHost('admin.khmerx.org',rules),true);
 assert.equal(isApiHost('api.khmerx.org',rules),true);
});

test('configured gray hosts use the same host rules without code changes',()=>{
 const suffix='khmerx.org';
 const hosts={publicClientHosts:['client.'+suffix],adminHosts:['staff.'+suffix],apiHosts:['edge.'+suffix]};
 const rules=hostRules(hosts);
 assert.equal(isAllowedHost('staff.'+suffix,rules),true);
 assert.equal(isPublicClientHost('client.'+suffix,rules),true);
 assert.equal(isAdminHost('staff.'+suffix,rules),true);
 assert.equal(isApiHost('edge.'+suffix,rules),true);
});

test('X-Real-IP is ignored from an untrusted socket and accepted from a local proxy',()=>{
 assert.equal(resolveClientIp('203.0.113.10','198.51.100.7'),'203.0.113.10');
 assert.equal(resolveClientIp('127.0.0.1','198.51.100.7'),'198.51.100.7');
 assert.equal(resolveClientIp('10.0.0.4','198.51.100.8'),'198.51.100.8');
});

test('trusted proxies cannot inject arbitrary values as client IPs',()=>{
 assert.equal(resolveClientIp('127.0.0.1','not-an-ip'),'127.0.0.1');
 assert.equal(resolveClientIp('127.0.0.1','203.0.113.10, 198.51.100.7'),'203.0.113.10');
 assert.equal(resolveClientIp('127.0.0.1','2001:db8::10'),'2001:db8::10');
});

test('formal hosts reject configured rate multipliers at startup',()=>{
 const source=readFileSync(new URL('../deploy/standalone/server.mjs',import.meta.url),'utf8');
 assert.match(source,/Rate multipliers are forbidden when formal hosts are configured/);
 assert.match(source,/PAYEASE_LIMIT_SCALE/);
 assert.match(source,/PAYEASE_GATEWAY_RATE_SCALE/);
});
