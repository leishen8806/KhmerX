'use client';
/* eslint-disable react-hooks/set-state-in-effect -- hydrate the persisted locale after SSR */
/* eslint-disable react-hooks/immutability -- update document language synchronously with the visible locale */
import {useEffect,useState} from 'react';
import {localeLabels,type Locale} from '@/lib/i18n';
const copy:Record<string,string[]>={
 '注册 / 登录':['注册 / 登录','Sign in / Register','ចូល / ចុះឈ្មោះ'],'密码登录':['密码登录','Password sign in','ចូលដោយពាក្យសម្ងាត់'],'验证手机号':['验证手机号','Verify phone','ផ្ទៀងផ្ទាត់ទូរស័ព្ទ'],'找回密码':['找回密码','Recover password','ស្តារពាក្យសម្ងាត់'],'完成账号设置':['完成账号设置','Complete account setup','បំពេញការកំណត់គណនី'],'Telegram 登录':['Telegram 登录','Telegram sign in','ចូល Telegram'],'客户账号':['客户账号','Customer account','គណនីអតិថិជន'],'重新加载':['重新加载','Reload','ផ្ទុកឡើងវិញ'],'返回登录':['返回登录','Back to sign in','ត្រឡប់ទៅចូល'],'手机号（含国家区号）':['手机号（含国家区号）','Phone number (with country code)','លេខទូរស័ព្ទ (មានលេខប្រទេស)'],'注册手机号':['注册手机号','Registered phone number','លេខទូរស័ព្ទដែលបានចុះឈ្មោះ'],'密码':['密码','Password','ពាក្យសម្ងាត់'],'新密码':['新密码','New password','ពាក្យសម្ងាត់ថ្មី'],'确认密码':['确认密码','Confirm password','បញ្ជាក់ពាក្យសម្ងាត់'],'确认新密码':['确认新密码','Confirm new password','បញ្ជាក់ពាក្យសម្ងាត់ថ្មី'],'同意接收本次验证码':['同意接收本次验证码','I agree to receive this code','ខ្ញុំយល់ព្រមទទួលលេខកូដនេះ'],'同意接收本次重置密码验证码':['同意接收本次重置密码验证码','I agree to receive this password reset code','ខ្ញុំយល់ព្រមទទួលលេខកូដស្តារពាក្យសម្ងាត់'],'获取验证码':['获取验证码','Get code','ទទួលលេខកូដ'],'获取重置验证码':['获取重置验证码','Get reset code','ទទួលលេខកូដស្តារ'],'完成验证':['完成验证','Verify','ផ្ទៀងផ្ទាត់'],'继续':['继续','Continue','បន្ត'],'登录':['登录','Sign in','ចូល'],'处理中…':['处理中…','Processing…','កំពុងដំណើរការ…'],'重新获取验证码':['重新获取验证码','Get a new code','ទទួលលេខកូដថ្មី'],'更换手机号':['更换手机号','Change phone number','ប្តូរលេខទូរស័ព្ទ'],'进入申请':['进入申请','Continue to application','បន្តទៅពាក្យស្នើសុំ'],'验证手机号并重置密码':['验证手机号并重置密码','Verify phone and reset password','ផ្ទៀងផ្ទាត់ទូរស័ព្ទ និងស្តារពាក្យសម្ងាត់'],'忘记密码？验证手机号重置':['忘记密码？验证手机号重置','Forgot password? Reset by phone','ភ្លេចពាក្យសម្ងាត់? ស្តារតាមទូរស័ព្ទ'],'使用密码登录':['使用密码登录','Use password','ប្រើពាក្យសម្ងាត់'],'使用验证码登录':['使用验证码登录','Use verification code','ប្រើលេខកូដផ្ទៀងផ្ទាត់'],'返回注册 / 登录':['返回注册 / 登录','Back to sign in / register','ត្រឡប់ទៅចូល / ចុះឈ្មោះ'],'其他登录方式与账号找回':['其他登录方式与账号找回','Other sign-in and recovery options','ជម្រើសចូល និងស្តារគណនីផ្សេងទៀត'],'手机号验证':['手机号验证','Phone verification','ការផ្ទៀងផ្ទាត់ទូរស័ព្ទ'],'设置密码（必填）':['设置密码（必填）','Set password (required)','កំណត់ពាក្យសម្ងាត់ (ត្រូវការ)'],'保存密码':['保存密码','Save password','រក្សាទុកពាក្យសម្ងាត់'],'当前密码':['当前密码','Current password','ពាក្យសម្ងាត់បច្ចុប្បន្ន'],'输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。':['Enter your phone number to continue. New users are created automatically. This channel has no verification or password setup enabled; the backend will create or sign in the account directly.','បញ្ចូលលេខទូរស័ព្ទដើម្បីបន្ត។ អ្នកប្រើថ្មីនឹងបង្កើតគណនីដោយស្វ័យប្រវត្តិ។ ឆានែលនេះមិនបានបើកការផ្ទៀងផ្ទាត់ ឬកំណត់ពាក្យសម្ងាត់ទេ ដូច្នេះប្រព័ន្ធនឹងបង្កើត ឬចូលគណនីដោយផ្ទាល់។'],'KhmerX Test Workspace · 测试资金':['KhmerX Test Workspace · Test funds','KhmerX Test Workspace · ប្រាក់សាកល្បង']};
const reverse=new Map<string,string>();for(const [key,values] of Object.entries(copy))for(const value of values)reverse.set(value,key);
function localize(root:HTMLElement,locale:Locale){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let n:Node|null;while((n=walker.nextNode())){const tag=n.parentElement?.tagName.toLowerCase();if(tag&&['script','style','input','textarea'].includes(tag))continue;nodes.push(n as Text)}for(const node of nodes){const raw=node.textContent||'',trimmed=raw.trim(),entry=Object.entries(copy).find(([,values])=>values.some(value=>value===trimmed)),key=entry?.[0]||reverse.get(trimmed);if(!key)continue;const value=copy[key][locale==='zh'?0:locale==='km'?2:1]||copy[key][0];if(value!==trimmed)node.textContent=raw.replace(trimmed,value)}}
export function AuthLocaleBridge(){
 const [locale,setLocale]=useState<Locale>('en');
 useEffect(()=>{try{const saved=window.localStorage.getItem('payease-auth-language');if(saved==='zh'||saved==='km'||saved==='en')setLocale(saved)}catch(error){console.warn('[h5-auth] language preference unavailable',error)}},[]);
 useEffect(()=>{
  let busy=false;
  const root=document.querySelector<HTMLElement>('.mini-login');
  const target=root||document.body;
  let observer:MutationObserver|null=null;
  const apply=()=>{
   if(busy||!target)return;
   busy=true;
   observer?.disconnect();
   document.documentElement.lang=locale;
   if(root)root.lang=locale;
   localize(target,locale);
   busy=false;
   observer?.observe(target,{subtree:true,childList:true,characterData:true});
  };
  apply();
  observer=new MutationObserver(apply);
  if(target)observer.observe(target,{subtree:true,childList:true,characterData:true});
  return()=>observer?.disconnect();
 },[locale]);
 const choose=(next:Locale)=>{
  setLocale(next);
  try{window.localStorage.setItem('payease-auth-language',next)}catch(error){console.warn('[h5-auth] language preference unavailable',error)}
  window.dispatchEvent(new CustomEvent('payease-auth-language-change',{detail:next}));
  document.documentElement.lang=next;
  const repaint=()=>{
   if(typeof document.querySelectorAll==='function'){
    const intro=[...document.querySelectorAll('.h5-login-card > p')].find(node=>node.textContent?.startsWith('输入手机号继续'));
    if(intro)intro.textContent=next==='zh'?'输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。':next==='km'?'បញ្ចូលលេខទូរស័ព្ទដើម្បីបន្ត។ អ្នកប្រើថ្មីនឹងបង្កើតគណនីដោយស្វ័យប្រវត្តិ។ ឆានែលនេះមិនបានបើកការផ្ទៀងផ្ទាត់ ឬកំណត់ពាក្យសម្ងាត់ទេ ដូច្នេះប្រព័ន្ធនឹងបង្កើត ឬចូលគណនីដោយផ្ទាល់។':'Enter your phone number to continue. New users are created automatically. This channel has no verification or password setup enabled; the backend will create or sign in the account directly.';
    const note=document.querySelector('.login-environment-note');
    if(note)note.textContent=next==='zh'?'KhmerX Test Workspace · 测试资金':next==='km'?'KhmerX Test Workspace · ប្រាក់សាកល្បង':'KhmerX Test Workspace · Test funds';
   }
   if(document.body)localize(document.body,next);
  };
  const schedule=typeof window.setTimeout==='function'?window.setTimeout.bind(window):(fn:()=>void)=>fn();
  for(const delay of [0,100,500,1000])schedule(repaint,delay);
 };
 return <div className="auth-locale" aria-label="Language">{(['zh','en','km'] as Locale[]).map(next=><button key={next} type="button" onClick={()=>choose(next)} aria-label={localeLabels[next]} aria-pressed={locale===next}>{localeLabels[next]}</button>)}</div>
}

copy['输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。']=['输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。','Enter your phone number to continue. New users are created automatically. This channel has no verification or password setup enabled; the backend will create or sign in the account directly.','បញ្ចូលលេខទូរស័ព្ទដើម្បីបន្ត។ អ្នកប្រើថ្មីនឹងបង្កើតគណនីដោយស្វ័យប្រវត្តិ។ ឆានែលនេះមិនបានបើកការផ្ទៀងផ្ទាត់ ឬកំណត់ពាក្យសម្ងាត់ទេ ដូច្នេះប្រព័ន្ធនឹងបង្កើត ឬចូលគណនីដោយផ្ទាល់។'];
copy['KhmerX Test Workspace · 测试资金']=['KhmerX Test Workspace · 测试资金','KhmerX Test Workspace · Test funds','KhmerX Test Workspace · ប្រាក់សាកល្បង'];
reverse.set('输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。','输入手机号继续，新用户自动创建账号。当前渠道未开启验证与密码设置，后台将直接创建或登录账号，可跳过验证。');reverse.set('KhmerX Test Workspace · 测试资金','KhmerX Test Workspace · 测试资金');
