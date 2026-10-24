import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
import {DraftSaver} from '../lib/kyc/draft-save.ts';

export function customer({locale='km',review=false,section='personal',status='draft',mini=false,values={},file,fileSlot,uploadFile,prepareFile,reviewData,transport,complete=false,fakeTime=false,missingMaterial=false}={}){
 let cursor=0,tree;const state=[],effectRecords=[],pendingEffects=[],focused=[],requests=[],navigations=[],clickHandlers=[],gets=[],listeners=new Map();
 const profile=core.emptyProfile();profile.values={...profile.values,surname:'客户原文',...values};
 if(complete){for(const f of core.fields.filter(f=>f.required))profile.values[f.id]=f.options?.[0].value||(f.kind==='phone'?'+1202555010'+(f.id.includes('1')?'1':'2'):'SYNTHETIC');profile.values.contact2Relation='朋友';profile.values.district=core.regions[0].districts[0].value;profile.consent=true;for(const s of core.slots.filter(s=>s.required))profile.files[s.id]={id:'synthetic-'+s.id,slot:s.id,type:'image/png',size:1}}
 profile.values={...profile.values,...values};if(missingMaterial)delete profile.files.idFront;
 if(file)profile.files[fileSlot||section]=file;
 const record={id:'synthetic-customer',revision:1,status,profile,review:reviewData?{decision:'needs_info',at:'2026-10-24T00:00:00Z',...reviewData}:undefined,phoneVerified:false,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={createContext:v=>({value:v}),useContext:c=>c.value,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]},useEffect(fn,deps){const i=cursor++,previous=effectRecords[i];if(!previous||!deps||deps.some((value,index)=>value!==previous.deps[index]))pendingEffects.push({i,fn,deps:deps||[]})}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push:path=>navigations.push(path)})},'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/draft-save':{DraftSaver},'@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>path=>navigations.push(path)},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{prepareKycFile:prepareFile||((f)=>f),fileLimitBytes:()=>5242880,retryAfterMs:()=>0},'@/lib/kyc/upload':{uploadKycFile:uploadFile},'@/lib/api-client':{apiUrl:p=>p,async apiFetch(url,options={}){if(options.method==='POST'){const request=JSON.parse(options.body);requests.push({...request,url,request,method:options.method,body:options.body});if(transport)return {data:await transport(request)};const clean=core.cleanProfile(request.profile);Object.assign(record,{revision:record.revision+1,profile:clean,updatedAt:'2026-10-24T00:00:00Z'});return {data:record}}gets.push(url);return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 class TestAnchor{constructor(href){this.href=href;this.target=''}closest(){return this}}
 const context=vm.createContext({URL,URLSearchParams,Date,Intl,File,Blob,HTMLAnchorElement:TestAnchor,location:{origin:'https://khmerx.test'},setTimeout,window:{confirm(){throw Error('Native confirmation must not be used')},open(){throw Error('Document previews must remain inline')},setTimeout,localStorage:{getItem:()=>locale},location:{search:review?'?id=synthetic-customer':''},addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)},setInterval(){},clearInterval(){}},document:{getElementById:id=>({focus(){focused.push(id)},scrollIntoView(){}}),documentElement:{lang:locale},addEventListener(type,handler){if(type==='click')clickHandlers.push(handler)},removeEventListener(type,handler){if(type==='click'){const i=clickHandlers.indexOf(handler);if(i>=0)clickHandlers.splice(i,1)}}}});
 const load=file=>{const exports={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});return exports};
 mocks['@/lib/i18n']=load('lib/i18n.tsx');mocks['@/lib/i18n'].I18nContext.value=mocks['@/lib/i18n'].i18nValue(locale);
 mocks['@/lib/error-messages']=load('lib/error-messages.ts');mocks['../i18n']=mocks['@/lib/i18n'];mocks['../error-messages']=mocks['@/lib/error-messages'];mocks['@/lib/kyc/ui-copy']=load('lib/kyc/ui-copy.ts');
 mocks['./core.ts']=core;mocks['@/lib/kyc/requests']=load('lib/kyc/requests.ts');mocks['./requests.ts']=mocks['@/lib/kyc/requests'];mocks['@/lib/kyc/supplement-ui']=load('lib/kyc/supplement-ui.ts');mocks['./kyc-supplement.css']={};mocks['@/components/kyc-supplement']=load('components/kyc-supplement.tsx');
 mocks['./kyc-material-viewer.css']={};mocks['@/components/kyc-material-viewer']=load('components/kyc-material-viewer.tsx');
 mocks['./kyc-review.css']={};mocks['@/components/kyc-review']=load('components/kyc-review.tsx');
 mocks['./kyc-customer-overview.css']={};mocks['@/components/kyc-customer-overview']=load('components/kyc-customer-overview.tsx');
 const component=load('app/kyc/client.tsx').default;
 const render=()=>{cursor=0;tree=component({review,mini,initialSection:section});for(const effect of pendingEffects.splice(0)){effectRecords[effect.i]?.cleanup?.();const cleanup=effect.fn();effectRecords[effect.i]={deps:effect.deps,cleanup}}return tree};
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 const text=n=>Array.isArray(n)?n.map(text).join(' '):typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?text(n.props?.children):'';
 render();
 return {focused,gets,listeners,dispose(){effectRecords.forEach(effect=>effect?.cleanup?.())},requests,navigations,clickHandlers,TestAnchor,async ready(){await new Promise(r=>fakeTime?setImmediate(r):setTimeout(r,10));render()},render,text:()=>text(tree),nodes:()=>nodes(tree),copy:mocks['@/lib/kyc/ui-copy']};
}

test('customer progress counts six groups using existing required rules',async()=>{
 const h=customer({locale:'zh',complete:true});await h.ready();const progress=h.nodes().find(n=>n.type==='progress');assert(progress,'customer needs progress');assert.equal(progress.props.max,6);assert.equal(progress.props.value,6);assert(JSON.stringify(h.nodes().find(n=>n.props?.className==='kyc-customer-progress')).includes('最高可获得 30 USD额度'));
});
test('submit opens grouped summary and only its explicit confirmation submits',async()=>{
 const h=customer({locale:'zh',mini:true,section:null,complete:true});await h.ready();const submit=h.nodes().find(n=>n.props?.className==='kyc-submit-button');assert(submit);submit.props.onClick();h.render();assert.equal(h.requests.filter(r=>r.method==='POST').length,0);assert.equal(h.nodes().filter(n=>n.props?.className==='kyc-summary-group').length,6);assert(h.text().includes('提交后资料将锁定'));const confirm=h.nodes().find(n=>n.props?.['data-action']==='confirm-submit');assert(confirm);await confirm.props.onClick();assert.equal(JSON.parse(h.requests.find(r=>r.method==='POST').body).action,'submit');
});
test('submitted timeline does not invent review start, turnaround or notification',async()=>{
 const h=customer({locale:'zh',status:'submitted'});await h.ready();const timeline=h.nodes().find(n=>n.props?.className==='kyc-customer-timeline');assert(timeline);assert(h.text().includes('预计处理时间暂未提供'));assert(h.text().includes('尚未提供开始审核时间'));assert(!h.text().includes('Telegram 通知'));assert.equal(timeline.props.children[0].props.children[0].props['aria-current'],'step');assert.equal(timeline.props.children[0].props.children[2].props['aria-current'],undefined);
});
test('H5 consent submission reports missing materials without posting',async()=>{
 const h=customer({locale:'zh',section:'consent',complete:true,missingMaterial:true});await h.ready();const submit=h.nodes().find(n=>n.type==='Button'&&n.props.children==='提交人工审核');assert(submit);submit.props.onClick();h.render();assert(h.text().includes('请补全：'));assert(h.text().includes('身份证正面'));assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
});
test('filled but invalid phone does not count its group complete',async()=>{
 const h=customer({locale:'zh',complete:true,values:{contact1Phone:'BAD PHONE'}});await h.ready();assert.equal(h.nodes().find(n=>n.type==='progress').props.value,5);
});

const steps=['personal','identityDetails','address','idFront','idBack','selfie','contact1','contact2','contact3','employment','income','assets','bank','consent'];
test('409 inline cancellation uses Khmer UI copy, not Chinese fallback',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=customer({locale:'km',fakeTime:true,transport:async()=>{throw {status:409}}});t.after(()=>h.dispose());await h.ready();h.nodes().find(n=>n.props?.id==='kyc-field-givenName').props.onChange({target:{value:'LOCAL'}});h.render();t.mock.timers.tick(1500);await h.ready();h.nodes().find(n=>n.props?.children===h.copy.kycText('重新加载服务器资料','km')).props.onClick();h.render();assert(!/[\u3400-\u9fff]/.test(h.nodes().find(n=>n.props?.['data-reload-cancel']).props.children));
});
test('409 reload is confirmed inline; cancel preserves edits and only confirmation fetches the server',async()=>{
 const h=customer({locale:'zh',transport:async()=>{throw {status:409}}});await h.ready();
 h.nodes().find(n=>n.props?.id==='kyc-field-givenName').props.onChange({target:{value:'LOCAL EDIT'}});h.render();await new Promise(r=>setTimeout(r,1650));await h.ready();
 const before=h.gets.length,open=()=>h.nodes().find(n=>n.props?.children==='重新加载服务器资料');assert(open());open().props.onClick();h.render();
 assert.equal(h.gets.length,before);assert(h.text().includes('重新加载会放弃本页未保存修改'));
 h.nodes().find(n=>n.props?.['data-reload-cancel']).props.onClick();h.render();assert.equal(h.gets.length,before);assert(h.nodes().some(n=>n.props?.value==='LOCAL EDIT'));
 open().props.onClick();h.render();await h.nodes().find(n=>n.props?.['data-reload-confirm']).props.onClick();await h.ready();assert.equal(h.gets.length,before+1);h.dispose();
});
test('customers can open unfinished groups without validating other groups',async()=>{
 const h=customer({locale:'zh',section:null});await h.ready();
 const groups=h.nodes().filter(n=>n.props?.className==='kyc-group-button');assert.equal(groups.length,6);assert(groups.every(n=>!n.props.disabled));groups[4].props.onClick();h.render();assert(h.nodes().some(n=>n.props?.id==='kyc-field-bankAccount'));
});
test('Next validates only this step and navigates immediately without a server write',async()=>{
 const h=customer({locale:'zh',values:{givenName:'QA',documentNumber:'KH-123'}});await h.ready();h.nodes().find(n=>n.props?.id==='kyc-field-givenName').props.onChange({target:{value:'EDIT'}});h.render();await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();h.render();assert(h.nodes().some(n=>n.props?.id==='kyc-field-gender'));assert.equal(h.requests.length,0);h.dispose();
});
test('customer autosave status and local input survive delayed saves and Mini leave waits for latest revision',async()=>{
 let resolve;const h=customer({locale:'zh',mini:true,transport:body=>new Promise(r=>resolve=()=>r({id:'synthetic-customer',revision:body.revision+1,status:'draft',profile:body.profile}))});await h.ready();const input=()=>h.nodes().find(n=>n.props?.id==='kyc-field-givenName');input().props.onChange({target:{value:'FIRST'}});h.render();await new Promise(r=>setTimeout(r,1550));h.render();assert(h.text().includes('保存中'));input().props.onChange({target:{value:'LATER'}});h.render();resolve();await h.ready();assert.equal(input().props.value,'LATER');let resumed=false;h.listeners.get('payease:before-navigate')({preventDefault(){},detail:{resume(){resumed=true}}});await h.ready();assert.equal(resumed,false);assert.equal(h.requests[1].revision,2);assert.equal(h.requests[1].profile.values.givenName,'LATER');resolve();await h.ready();assert(resumed);assert(h.text().includes('已保存'));h.dispose();
});
test('Mini leave during an existing autosave resumes when that same flight saves the latest input',async()=>{
 let resolve;const h=customer({locale:'zh',mini:true,transport:body=>new Promise(r=>resolve=()=>r({id:'synthetic-customer',revision:body.revision+1,status:'draft',profile:body.profile}))});await h.ready();h.nodes().find(n=>n.props?.id==='kyc-field-givenName').props.onChange({target:{value:'LATEST'}});h.render();await new Promise(r=>setTimeout(r,1550));h.render();let resumed=false;h.listeners.get('payease:before-navigate')({preventDefault(){},detail:{resume(){resumed=true}}});await h.ready();assert.equal(h.requests.length,1);assert(!resumed);resolve();await h.ready();assert(resumed);assert.equal(h.requests.length,1);h.dispose();
});
test('customer 409 keeps local input, displays reconciliation and makes no further writes',async()=>{
 const h=customer({locale:'en',transport:async()=>{throw {status:409}}});await h.ready();const input=()=>h.nodes().find(n=>n.props?.id==='kyc-field-givenName');input().props.onChange({target:{value:'LOCAL'}});h.render();await new Promise(r=>setTimeout(r,1550));h.render();assert(h.text().includes('Reload'));input().props.onChange({target:{value:'KEEP'}});h.render();h.nodes().find(n=>n.props?.children==='Reload server profile').props.onClick();await h.ready();await new Promise(r=>setTimeout(r,1550));assert.equal(h.requests.length,1);assert.equal(input().props.value,'KEEP');h.dispose();
});
test('failed customer saves retain input and retry explicitly with the latest draft',async()=>{
 let fail=true;const h=customer({locale:'zh',mini:true,transport:async body=>{if(fail)throw {status:503};return {id:'synthetic-customer',revision:body.revision+1,status:'draft',profile:body.profile}}});await h.ready();const input=()=>h.nodes().find(n=>n.props?.id==='kyc-field-givenName');input().props.onChange({target:{value:'LOCAL'}});h.render();h.listeners.get('payease:before-navigate')({preventDefault(){},detail:{resume(){throw Error('must not leave on failure')}}});await h.ready();assert(h.text().includes('保存失败'));assert.equal(input().props.value,'LOCAL');fail=false;await h.nodes().find(n=>n.props?.children==='重试').props.onClick();await h.ready();assert.equal(h.requests.length,2);assert.equal(h.requests[1].profile.values.givenName,'LOCAL');assert(h.text().includes('已保存'));h.dispose();
});
test('a confirmed submit invalidated by unmount never displays success',async()=>{
 let resolve;const h=customer({locale:'zh',section:'consent',complete:true,transport:body=>new Promise(r=>resolve=()=>r({id:'synthetic-customer',revision:2,status:'submitted',profile:body.profile}))});await h.ready();h.nodes().find(n=>n.props?.children==='提交人工审核').props.onClick();h.render();assert.equal(h.requests.length,0);const result=h.nodes().find(n=>n.props?.['data-action']==='confirm-submit').props.onClick();assert.equal(h.requests[0].action,'submit');h.dispose();resolve();await result;h.render();assert(!h.text().includes('资料已提交，等待人工审核'));
});
test('structured supplementation focuses exact target, tracks edits and preserves original notes in all locales',async()=>{
 for(const locale of ['zh','en','km']){const h=customer({locale,status:'needs_info',reviewData:{at:'2026-10-24',reason:'审核员原文',requests:[{target:'field:bankAccount',reasonCode:'data_mismatch',note:'客户原文 NOTE'}]}});await h.ready();const input=()=>h.nodes().find(n=>n.props?.id==='kyc-field-bankAccount');assert(input(),'must enter bank without guessing reason');const badge=()=>h.nodes().find(n=>n.props?.className==='kyc-supplement-item');assert.equal(badge().props['data-state'],'pending');assert(h.text().includes('客户原文 NOTE'));input().props.onChange({target:{value:'12345'}});h.render();assert.equal(badge().props['data-state'],'changed');input().props.onChange({target:{value:''}});h.render();assert.equal(badge().props['data-state'],'pending');}
});
test('legacy supplementary reason is never parsed; missing checklist uses first section',async()=>{
 const h=customer({locale:'zh',status:'needs_info',reviewData:{reason:'银行账号补件',checklist:{}}});await h.ready();assert(h.nodes().some(n=>n.props?.id==='kyc-field-givenName'));assert(!h.nodes().some(n=>n.props?.id==='kyc-field-bankAccount'));
});
test('field supplement appears inside the actual field and initial entry focuses it',async()=>{
 const h=customer({locale:'zh',status:'needs_info',reviewData:{requests:[{target:'field:documentNumber',reasonCode:'data_mismatch',note:'FIELD NOTE'}]}});await h.ready();const label=h.nodes().find(n=>n.type==='label'&&JSON.stringify(n.props.children).includes('kyc-field-documentNumber'));assert(label);assert(JSON.stringify(label).includes('kyc-supplement-item'));assert(h.focused.includes('kyc-field-documentNumber'));
});
test('requested alternate vehicle upload is visible without discarding the existing material on entry',async()=>{
 const h=customer({locale:'zh',status:'needs_info',section:'vehiclePhoto',values:{vehicle:'汽车'},file:{id:'old-photo',type:'image/png',size:1},reviewData:{requests:[{target:'slot:vehicleContract',reasonCode:'incomplete_document',note:'CONTRACT NOTE'}]}});await h.ready();assert(h.nodes().some(n=>n.props?.id==='kyc-field-vehicleContract'));assert(h.nodes().filter(n=>n.props?.['data-target']==='slot:vehicleContract').length>=2);
});
test('customer H5 and mini expose no internal test or scoring metadata, reviewer retains it',async()=>{
 for(const mini of [false,true])for(const section of steps){const h=customer({locale:'zh',section,mini});await h.ready();assert.doesNotMatch(h.text(),/KESS|模拟|测试合同|权重|单元格|KYC规范/)}
 const h=customer({review:true,section:'bank'});await h.ready();assert.match(h.text(),/KESS/);assert.match(h.text(),/B4:F5/);
});
test('all customer sections render localized UI and attributes while input values stay original',async()=>{
 for(const mini of [false,true])for(const locale of ['en','km'])for(const section of steps){const h=customer({locale,section,mini});await h.ready();assert.doesNotMatch(h.text(),/[\u4e00-\u9fff]/,locale+':'+section);for(const n of h.nodes())for(const key of ['aria-label','title','placeholder'])if(typeof n.props?.[key]==='string')assert.doesNotMatch(n.props[key],/[\u4e00-\u9fff]/,key+':'+section);if(section==='personal')assert(h.nodes().some(n=>n.props?.value==='客户原文'))}
});
test('upload retry, size limits, geographic labels and safe errors use the selected locale',()=>{
 for(const locale of ['zh','en','km']){const {copy}=customer({locale,mini:true});for(const text of ['正在重试（第 2 次）','单份材料不能超过 10 MB','设备报告 11.00000, 104.00000（精度约 20 米）']){const value=copy.kycText(text,locale);if(locale!=='zh')assert.doesNotMatch(value,/[\u4e00-\u9fff]/);assert.match(value,/2|10|11\.00000/)}assert(!copy.kycError(Error('private stack or SQL'),locale).includes('private stack'));assert(copy.kycError({code:'AUTH_REQUIRED'},locale));}
 const {copy}=customer({mini:true});assert.equal(copy.kycText('Agriculture/Forestry/Fishery / កសិកម្ម/រុក្ខាប្រម៉ាញ់/នេសាទ','km'),'កសិកម្ម/រុក្ខាប្រម៉ាញ់/នេសាទ');assert.equal(copy.kycText('金边/Phnom Penh','en'),'Phnom Penh');
});
test('customer validation errors and timestamps follow locale',async()=>{
 for(const locale of ['en','km','zh']){const h=customer({locale});await h.ready();await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();h.render();const alert=h.nodes().find(n=>n.props?.['aria-live']==='polite');assert(alert);if(locale!=='zh')assert.doesNotMatch(JSON.stringify(alert.props.children),/[\u4e00-\u9fff]/);assert(h.text().includes(new Date('2026-10-23T00:00:00Z').toLocaleString({zh:'zh-CN',en:'en-GB',km:'km-KH'}[locale],{timeZone:'Asia/Phnom_Penh'})))}
});
test('submitted KYC return action is localized in English and Khmer',()=>{
 const {copy}=customer();
 assert.equal(copy.kycText('返回首页','en'),'Back to home');
 assert.equal(copy.kycText('返回首页','km'),'ត្រឡប់ទៅទំព័រដើម');
});
test('status zero retries only once, then offers manual retry with localized interruption text',async()=>{
 for(const [locale,message] of [['zh','网络较慢，上传中断，请重试'],['en','Slow network. Upload interrupted. Please retry.'],['km','បណ្ដាញយឺត។ ការផ្ទុកឡើងបានផ្អាក។ សូមព្យាយាមម្ដងទៀត។']]){let attempts=0;const h=customer({locale,section:'idFront',uploadFile:async()=>{attempts++;throw {status:0,code:'KYC_UPLOAD_INTERRUPTED'}}});await h.ready();h.nodes().find(n=>n.props?.type==='file').props.onChange({target:{files:[new File(['qa'],'qa.png',{type:'image/png'})],value:'qa'}});await new Promise(r=>setTimeout(r,30));await h.ready();assert.equal(attempts,2);assert(h.text().includes(message));assert(h.nodes().some(n=>n.props?.children===h.copy.kycText('重试',locale)));}
});
test('field errors use descriptions without assertive alerts; summary is polite',async()=>{
 const h=customer({locale:'en'});await h.ready();h.nodes().find(n=>n.props?.id==='kyc-field-givenName').props.onBlur();h.render();assert.equal(h.nodes().find(n=>n.props?.id==='kyc-error-givenName').props.role,undefined);await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await h.ready();const summary=h.nodes().find(n=>n.props?.className==='kyc-validation-summary');assert.equal(summary.props['aria-live'],'polite');assert.notEqual(summary.props.role,'alert');
});
test('polite error region is mounted empty and keeps its React slot when validation fills it',async()=>{
 const h=customer({locale:'en'});await h.ready();
 const before=h.nodes().find(n=>n.props?.['aria-live']==='polite');assert(before,'live region must exist before an error');
 assert.equal(before.props.children,'');assert.equal(before.props.id,'kyc-error-summary');
 const path=(node,target,p=[])=>{if(node===target)return p;if(!node||typeof node!=='object')return null;const children=Array.isArray(node)?node:[node.props?.children];for(let i=0;i<children.length;i++){const result=path(children[i],target,[...p,i]);if(result)return result}return null};
 const oldPath=path(h.render(),h.nodes().find(n=>n.props?.['aria-live']==='polite'));assert(Array.isArray(oldPath));
 await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await h.ready();
 const after=h.nodes().find(n=>n.props?.['aria-live']==='polite');assert.equal(after.type,before.type);assert.equal(after.props.id,before.props.id);
 assert.deepEqual(path(h.render(),h.nodes().find(n=>n.props?.['aria-live']==='polite')),oldPath);assert.match(JSON.stringify(after.props.children),/Please complete/);
});
test('identity capture uses the correct camera and preserves a separate gallery picker',async()=>{
 for(const [section,capture] of [['idFront','environment'],['idBack','environment'],['selfie','user']]){const h=customer({section,locale:'zh'});await h.ready();const inputs=h.nodes().filter(n=>n.type==='input'&&n.props.type==='file');assert.equal(inputs.length,2);assert.equal(inputs[0].props.capture,capture);assert.equal(inputs[0].props.accept,'image/jpeg,image/png');assert.equal(inputs[1].props.capture,undefined)}
});
test('uploaded image opens an inline dialog and PDF retains the authenticated download link',async()=>{
 const h=customer({section:'idFront',locale:'zh',file:{id:'private file',type:'image/png',size:100}});await h.ready();const image=h.nodes().find(n=>n.type==='img'&&n.props.src.includes('/api/kyc/files'));assert.equal(image.props.src,'/api/kyc/files?id=private%20file');const button=h.nodes().find(n=>n.type==='button'&&n.props.className==='kyc-thumbnail');button.props.onClick({currentTarget:{focus(){}}});h.render();assert(h.nodes().some(n=>n.type==='dialog'&&n.props.open));assert(!h.nodes().some(n=>n.type==='a'&&n.props.target==='_blank'&&n.props.href?.includes('/api/kyc/files')));h.nodes().find(n=>n.props?.['aria-label']==='关闭预览').props.onClick();h.render();assert(!h.nodes().some(n=>n.type==='dialog'));
 const pdf=customer({section:'idFront',file:{id:'pdf',type:'application/pdf',size:200}});await pdf.ready();assert(pdf.nodes().some(n=>n.type==='a'&&n.props.href==='/api/kyc/files?id=pdf'&&n.props.download!==undefined));
});
test('compression, actual byte progress and manual retry retain the selected file; 429/503 retry three times',async()=>{
 let release,finish,attempts=0;const selected=new File(['synthetic'],'photo.png',{type:'image/png'}),sent=[];
 const h=customer({section:'idFront',locale:'zh',prepareFile:f=>new Promise(r=>{release=()=>r(f)}),uploadFile:(f,headers,progress)=>{sent.push(f);attempts++;progress(37);return new Promise((resolve,reject)=>{finish=()=>attempts<=3?reject({status:attempts===2?503:429,code:'SERVICE_UNAVAILABLE'}):resolve({id:'success',type:'image/png',size:9})})}});await h.ready();
 h.nodes().find(n=>n.props?.type==='file').props.onChange({target:{files:[selected],value:'selected'}});h.render();assert.match(h.text(),/压缩中/);release();await h.ready();assert.match(h.text(),/上传中 37%/);
 for(let i=0;i<3;i++){finish();await new Promise(r=>setTimeout(r,10));await h.ready()}
 assert.equal(attempts,3);assert.match(h.text(),/上传失败，请重试/);const retry=h.nodes().find(n=>n.type==='Button'&&n.props.children==='重试');retry.props.onClick();h.render();assert.match(h.text(),/压缩中/);release();await h.ready();finish();await h.ready();assert.match(h.text(),/上传完成/);assert.equal(attempts,4);assert(sent.every(f=>f===selected));assert(h.nodes().some(n=>n.type==='img'&&n.props.src==='/api/kyc/files?id=success'));
});
test('blur exposes linked field error; Next focuses first invalid field without saving input away',async()=>{
 const h=customer({locale:'en'});await h.ready();
 const name=()=>h.nodes().find(n=>n.props?.id==='kyc-field-givenName');assert(name(),'field needs a stable id');
 name().props.onBlur();h.render();assert.equal(name().props['aria-invalid'],true);
 const id=name().props['aria-describedby'];assert(h.nodes().some(n=>n.props?.id===id));
 await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await h.ready();
 assert.equal(h.focused[0],'kyc-field-givenName');assert(h.nodes().some(n=>n.props?.value==='客户原文'));
});
test('T1 debounce saves the empty country placeholder once, never synchronously on Next',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=customer({locale:'km',section:'contact3',fakeTime:true});t.after(()=>h.dispose());await h.ready();
 const phone=()=>h.nodes().find(n=>n.props?.id==='kyc-field-contact3Phone');phone().props.onChange({target:{value:'+855'}});h.render();
 await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await h.ready();
 assert.equal(h.requests.length,0);t.mock.timers.tick(1499);await h.ready();assert.equal(h.requests.length,0);t.mock.timers.tick(1);await h.ready();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].request.profile.values.contact3Phone,'');assert.equal(h.requests[0].request.action,'save');assert.equal(h.nodes().find(n=>n.props?.id==='kyc-error-summary').props.children,'');
});
test('T2 Mini App navigation saves the normalized draft before navigating',async()=>{
 const h=customer({locale:'km',mini:true,section:'contact3'});await h.ready();
 h.nodes().find(n=>n.props?.id==='kyc-field-contact3Phone').props.onChange({target:{value:'+855'}});h.render();
 const anchor=new h.TestAnchor('https://khmerx.test/h5/loans'),event={target:{closest:()=>anchor},button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,preventDefault(){this.prevented=true},stopPropagation(){}};
 assert.equal(h.clickHandlers.length,1);h.clickHandlers[0](event);assert.equal(event.prevented,true);await h.ready();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].request.profile.values.contact3Phone,'');assert.deepEqual(h.navigations,['/h5/loans']);
});
test('T3 contact 3 treats only +855 as empty but keeps the name and phone pair guard',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const empty=customer({locale:'km',section:'contact3',fakeTime:true});t.after(()=>empty.dispose());await empty.ready();empty.nodes().find(n=>n.props?.id==='kyc-field-contact3Phone').props.onChange({target:{value:'+855'}});empty.render();
 await empty.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await empty.ready();assert.equal(empty.requests.length,0);t.mock.timers.tick(1500);await empty.ready();assert.equal(empty.requests.length,1);assert.equal(empty.requests[0].request.profile.values.contact3Phone,'');assert.equal(empty.nodes().find(n=>n.props?.id==='kyc-error-summary').props.children,'');
 const partial=customer({locale:'km',section:'contact3',values:{contact3Name:'Alex'},fakeTime:true});t.after(()=>partial.dispose());await partial.ready();partial.nodes().find(n=>n.props?.id==='kyc-field-contact3Phone').props.onChange({target:{value:'+855'}});partial.render();
 await partial.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await partial.ready();assert.equal(partial.requests.length,0);assert.match(JSON.stringify(partial.nodes().find(n=>n.props?.id==='kyc-error-summary').props.children),new RegExp(partial.copy.kycText('联系人 3 请完整填写或全部留空','km')));
 const income=core.fields.find(f=>f.id==='income').options[0].value,tenure=core.fields.find(f=>f.id==='tenure').options[0].value;
 const proof={id:'00000000-0000-4000-8000-000000000001',type:'application/pdf',size:12},supervisorEmpty=customer({locale:'km',section:'income',values:{income,tenure},file:proof,fileSlot:'incomeProof',fakeTime:true});t.after(()=>supervisorEmpty.dispose());await supervisorEmpty.ready();supervisorEmpty.nodes().find(n=>n.props?.id==='kyc-field-supervisorPhone').props.onChange({target:{value:'+855'}});supervisorEmpty.render();
 await supervisorEmpty.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await supervisorEmpty.ready();assert.equal(supervisorEmpty.requests.length,0);t.mock.timers.tick(1500);await supervisorEmpty.ready();assert.equal(supervisorEmpty.requests.length,1);assert.equal(supervisorEmpty.requests[0].request.profile.values.supervisorPhone,'');
 const supervisorPartial=customer({locale:'km',section:'income',values:{income,tenure,supervisorName:'Manager'},file:proof,fileSlot:'incomeProof',fakeTime:true});t.after(()=>supervisorPartial.dispose());await supervisorPartial.ready();supervisorPartial.nodes().find(n=>n.props?.id==='kyc-field-supervisorPhone').props.onChange({target:{value:'+855'}});supervisorPartial.render();
 await supervisorPartial.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await supervisorPartial.ready();assert.equal(supervisorPartial.requests.length,0);assert.match(JSON.stringify(supervisorPartial.nodes().find(n=>n.props?.id==='kyc-error-summary').props.children),new RegExp(supervisorPartial.copy.kycText('上司姓名与电话需一并填写','km')));
});
test('T4 required contact phone remains missing and focuses its field',async()=>{
 const h=customer({locale:'km',section:'contact1',values:{contact1Relation:'朋友',contact1Name:'Alex'}});await h.ready();
 h.nodes().find(n=>n.props?.id==='kyc-field-contact1Phone').props.onChange({target:{value:'+855'}});h.render();
 await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();await h.ready();await new Promise(r=>setTimeout(r,1));h.render();
 const phone=h.nodes().find(n=>n.props?.id==='kyc-field-contact1Phone');assert.equal(phone.props['aria-invalid'],true);assert.equal(h.focused.at(-1),'kyc-field-contact1Phone');assert.equal(h.requests.length,0);
});
test('T5 preserves other international inputs and rejects too-short country numbers',async()=>{
 const h=customer({locale:'km',section:'contact3'});await h.ready();const phone=()=>h.nodes().find(n=>n.props?.id==='kyc-field-contact3Phone');
 phone().props.onChange({target:{value:'+44 7700 900123'}});h.render();assert.equal(phone().props.value,'+44 7700 900123');
 phone().props.onChange({target:{value:'+855123'}});h.render();phone().props.onBlur();h.render();assert.equal(phone().props.value,'+855123');assert.equal(phone().props['aria-invalid'],true);
});
test('Submit locates an invalid field on an earlier section and select blur has linked feedback',async()=>{
 const h=customer({locale:'en',section:'consent'});await h.ready();
 const submit=h.nodes().find(n=>n.props?.children===h.copy.kycText('提交人工审核','en')&&n.props?.onClick);assert(submit);submit.props.onClick();await h.ready();
 assert.equal(h.focused[0],'kyc-field-givenName');assert(h.nodes().some(n=>n.props?.id==='kyc-error-givenName'));
 const s=customer({locale:'en',section:'identityDetails'});await s.ready();
 s.nodes().find(n=>n.props?.id==='kyc-field-gender').props.onBlur();s.render();
 assert.equal(s.nodes().find(n=>n.props?.id==='kyc-field-gender').props['aria-describedby'],'kyc-error-gender');
});
