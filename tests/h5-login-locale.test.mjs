import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const login=readFileSync(new URL('../app/h5/login.tsx',import.meta.url),'utf8');
const layout=readFileSync(new URL('../app/h5/layout.tsx',import.meta.url),'utf8');
const locale=readFileSync(new URL('../components/auth-locale.tsx',import.meta.url),'utf8');
const i18n=readFileSync(new URL('../lib/i18n.tsx',import.meta.url),'utf8');
const cjk=/[\u4e00-\u9fff]/u;

test('H5 login renders copy through the shared locale dictionary',()=>{
 assert.match(login,/messages\[authLocale\]/);
 assert.doesNotMatch(login,cjk,'login source must not contain hardcoded CJK copy');
 assert.doesNotMatch(layout,cjk,'H5 layout source must not contain hardcoded CJK copy');
 assert.doesNotMatch(locale,/next==='zh'\?['\"]ZH['\"]|next==='zh'\?['\"]中文['\"]/,'language switcher must render locale names, not a synthetic code');
 const en=i18n.slice(i18n.indexOf('en:{'),i18n.indexOf('km:{'));
 const km=i18n.slice(i18n.indexOf('km:{'),i18n.indexOf('},\n};',i18n.indexOf('km:{')));
 assert.doesNotMatch(en,cjk,'English dictionary must not contain CJK');
 assert.doesNotMatch(km,cjk,'Khmer dictionary must not contain CJK');
 for(const key of ['authOnlyChannel','authNotice','authTestFunds'])assert.match(i18n,new RegExp(`${key}:`));
});
