import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function customer({locale='km',review=false,section='personal',status='draft',mini=false,values={},file,uploadFile,prepareFile,reviewData,complete=false,missingMaterial=false}={}){
 let cursor=0,tree;const state=[],effects=[],focused=[],requests=[];
 const profile=core.emptyProfile();profile.values={...profile.values,surname:'客户原文',...values};
 if(complete){for(const f of core.fields.filter(f=>f.required))profile.values[f.id]=f.options?.[0]?.value||(f.kind==='phone'?'+1202555010'+(f.id.includes('1')?'1':'2'):'SYNTHETIC');profile.values.district=core.regions[0].districts[0].value;profile.values.contact2Relation='朋友';for(const s of core.slots.filter(s=>s.required))profile.files[s.id]={id:s.id,type:'image/png',size:1};profile.consent=true}
 profile.values={...profile.values,...values};if(missingMaterial)delete profile.files.idFront;
 if(file)profile.files[section]=file;
 const record={id:'synthetic-customer',revision:1,status,profile,review:reviewData?{decision:'needs_info',at:'2026-10-24T00:00:00Z',...reviewData}:undefined,phoneVerified:false,updatedAt:'2026-10-23T00:00:00Z'};
 const hooks={createContext:v=>({value:v}),useContext:c=>c.value,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]},useEffect(fn,deps){const i=cursor++;if(!state[i]||!deps||deps.some((v,j)=>!Object.is(v,state[i][j]))){state[i]=deps||[];effects.push(fn)}}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{useRouter:()=>({push(){}})},'lucide-react':new Proxy({},{get:(_,k)=>k}),
  '@/lib/kyc/core':core,'@/lib/agreements/loan-terms':{LOAN_TERMS_VERSION:'test',LOAN_TERMS_URL:'/agreements/loan',loanTerms:{}},
  '@/components/loan-bill':{LoanBill:'LoanBill'},'@/components/mini-shell':{MiniNavLink:'a',useMiniNavigation:()=>null},'@/lib/analytics':{trackEvent(){}},
  '@/lib/image-compress':{prepareKycFile:prepareFile||((f)=>f),fileLimitBytes:()=>5242880,retryAfterMs:()=>0},'@/lib/kyc/upload':{uploadKycFile:uploadFile},'@/lib/api-client':{apiUrl:p=>p,async apiFetch(url,init={}){requests.push({url,...init});return {data:record}}},
 };
 for(const [file,names] of Object.entries({'button':['Button'],'input':['Input'],'checkbox':['Checkbox'],'select':['Select','SelectTrigger','SelectValue','SelectContent','SelectItem']}))mocks['@/components/ui/'+file]=Object.fromEntries(names.map(n=>[n,n]));
 const context=vm.createContext({URLSearchParams,Date,Intl,File,Blob,setTimeout,window:{open(){throw Error('Document previews must remain inline')},setTimeout,localStorage:{getItem:()=>locale},location:{search:review?'?id=synthetic-customer':''},addEventListener(){},removeEventListener(){},setInterval(){},clearInterval(){}},document:{getElementById:id=>({focus(){focused.push(id)},scrollIntoView(){}}),documentElement:{lang:locale},addEventListener(){},removeEventListener(){}}});
 const load=file=>{const exports={},js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext('(function(exports,require){'+js+'\n})',context)(exports,n=>{assert(n in mocks,n);return mocks[n]});return exports};
 mocks['@/lib/i18n']=load('lib/i18n.tsx');mocks['@/lib/i18n'].I18nContext.value=mocks['@/lib/i18n'].i18nValue(locale);
 mocks['@/lib/error-messages']=load('lib/error-messages.ts');mocks['../i18n']=mocks['@/lib/i18n'];mocks['../error-messages']=mocks['@/lib/error-messages'];mocks['@/lib/kyc/ui-copy']=load('lib/kyc/ui-copy.ts');
 mocks['./core.ts']=core;mocks['@/lib/kyc/requests']=load('lib/kyc/requests.ts');mocks['./requests.ts']=mocks['@/lib/kyc/requests'];mocks['@/lib/kyc/supplement-ui']=load('lib/kyc/supplement-ui.ts');mocks['./kyc-supplement.css']={};mocks['@/components/kyc-supplement']=load('components/kyc-supplement.tsx');
 mocks['./kyc-material-viewer.css']={};mocks['@/components/kyc-material-viewer']=load('components/kyc-material-viewer.tsx');
 mocks['./kyc-review.css']={};mocks['@/components/kyc-review']=load('components/kyc-review.tsx');
 mocks['./kyc-customer-overview.css']={};mocks['@/components/kyc-customer-overview']=load('components/kyc-customer-overview.tsx');
 const component=load('app/kyc/client.tsx').default;
 const render=()=>{cursor=0;tree=component({review,mini,initialSection:section});effects.splice(0).forEach(fn=>fn());return tree};
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:[n,...nodes(n.props?.children)];
 const text=n=>Array.isArray(n)?n.map(text).join(' '):typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?text(n.props?.children):'';
 render();effects.splice(0).forEach(fn=>fn());
 return {focused,requests,async ready(){await new Promise(r=>setTimeout(r,10));render()},render,text:()=>text(tree),nodes:()=>nodes(tree),copy:mocks['@/lib/kyc/ui-copy']};
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
 for(const locale of ['en','km','zh']){const h=customer({locale});await h.ready();await h.nodes().find(n=>n.props?.className==='kyc-next-button').props.onClick();h.render();const alert=h.nodes().find(n=>n.props?.role==='alert');assert(alert);if(locale!=='zh')assert.doesNotMatch(JSON.stringify(alert.props.children),/[\u4e00-\u9fff]/);assert(h.text().includes(new Date('2026-10-23T00:00:00Z').toLocaleString({zh:'zh-CN',en:'en-GB',km:'km-KH'}[locale],{timeZone:'Asia/Phnom_Penh'})))}
});
test('submitted KYC return action is localized in English and Khmer',()=>{
 const {copy}=customer();
 assert.equal(copy.kycText('返回首页','en'),'Back to home');
 assert.equal(copy.kycText('返回首页','km'),'ត្រឡប់ទៅទំព័រដើម');
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
test('phone errors use core rules and preserve a customer-entered international number',async()=>{
 const h=customer({locale:'km',section:'contact1',values:{contact1Phone:'+855'}});await h.ready();
 const phone=()=>h.nodes().find(n=>n.props?.id==='kyc-field-contact1Phone');assert(phone());
 phone().props.onBlur();h.render();assert.equal(phone().props['aria-invalid'],true);assert(h.text().includes('+855'));
 phone().props.onChange({target:{value:'+44 7700 900123'}});h.render();assert.equal(phone().props.value,'+44 7700 900123');assert.equal(phone().props['aria-invalid'],false);
});
test('Submit locates an invalid field on an earlier section and select blur has linked feedback',async()=>{
 const h=customer({locale:'en',section:'consent'});await h.ready();
 const submit=h.nodes().find(n=>n.props?.children===h.copy.kycText('提交人工审核','en')&&n.props?.onClick);assert(submit);submit.props.onClick();await h.ready();
 assert.equal(h.focused[0],'kyc-field-givenName');assert(h.nodes().some(n=>n.props?.id==='kyc-error-givenName'));
 const s=customer({locale:'en',section:'identityDetails'});await s.ready();
 s.nodes().find(n=>n.props?.id==='kyc-field-gender').props.onBlur();s.render();
 assert.equal(s.nodes().find(n=>n.props?.id==='kyc-field-gender').props['aria-describedby'],'kyc-error-gender');
});
