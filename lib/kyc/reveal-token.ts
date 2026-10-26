import {env} from 'cloudflare:workers';
import {keyed} from '@/lib/h5-auth-core';
import {KycError} from './core';
import type {SensitiveField} from './staff-projection';
export type RevealScope={tenant:string;actor:string;caseId:string;revision:number;field:SensitiveField};
const domain='kyc-reveal-amend-v1';
function secret(){const value=String((env as {PAYEASE_AUTH_SECRET?:string}).PAYEASE_AUTH_SECRET||'');if(value.length<32)throw new KycError('敏感资料服务暂不可用',503);return value;}
const encode=(value:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value:string)=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
function sameMac(a:string,b:string){if(!/^[a-f0-9]{64}$/.test(b))return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export async function mintRevealToken(scope:RevealScope){const now=Date.now(),body=encode(JSON.stringify({...scope,issuedAt:now,expiresAt:now+300000}));return body+'.'+await keyed(secret(),domain+':'+body);}
export async function verifyRevealToken(token:unknown,scope:RevealScope){
 if(typeof token!=='string'||token.length>3000)throw new KycError('请重新显示敏感字段后再修改',403);
 try{
  const [body,mac,extra]=token.split('.');if(extra||!body||!mac||!sameMac(await keyed(secret(),domain+':'+body),mac))throw new Error();
  const value=JSON.parse(decode(body)),now=Date.now();
  if(!Number.isSafeInteger(value.issuedAt)||!Number.isSafeInteger(value.expiresAt)||value.issuedAt>now||value.expiresAt<=now||value.expiresAt-value.issuedAt>300000||value.expiresAt<=value.issuedAt||Object.entries(scope).some(([key,expected])=>value[key]!==expected))throw new Error();
 }catch(error){if(error instanceof KycError&&error.status===503)throw error;throw new KycError('请重新显示敏感字段后再修改',403);}
}
