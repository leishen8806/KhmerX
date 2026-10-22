'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {legacyText,localeLabels,type Locale} from './i18n';
import {apiFetch} from './api-client';

const copy:Record<Locale,Record<string,string>>={
 zh:{dashboard:'服务机构后台',customer:'客户入口',logout:'退出登录',refresh:'刷新',company:'切换公司',back:'返回公司选择',login:'服务机构后台登录',email:'员工邮箱',password:'登录密码',companyCode:'公司代码',signIn:'登录服务机构后台',sso:'使用当前站点账号登录',kyc:'KYC 审核订单',loans:'贷款申请订单',funding:'放款管理',repayment:'还款管理',postloan:'贷后催收／逾期订单',notifications:'Telegram 通知',permissions:'员工与权限',pricing:'贷款费用配置',save:'保存',create:'新增',all:'全部',enabled:'启用',disabled:'已停用'},
 en:{dashboard:'Business admin',customer:'Customer entry',logout:'Log out',refresh:'Refresh',company:'Switch company',back:'Back to company selection',login:'Business admin sign in',email:'Staff email',password:'Password',companyCode:'Company code',signIn:'Sign in to admin',sso:'Use current site account',kyc:'KYC review orders',loans:'Loan applications',funding:'Disbursement',repayment:'Repayments',postloan:'Collections / overdue',notifications:'Telegram notifications',permissions:'Staff and permissions',pricing:'Loan pricing',save:'Save',create:'Add',all:'All',enabled:'Enabled',disabled:'Disabled'},
 km:{dashboard:'ផ្ទាំងគ្រប់គ្រងអាជីវកម្ម',customer:'ច្រកចូលអតិថិជន',logout:'ចាកចេញ',refresh:'ធ្វើឱ្យថ្មី',company:'ប្តូរក្រុមហ៊ុន',back:'ត្រឡប់ទៅជ្រើសក្រុមហ៊ុន',login:'ចូលប្រព័ន្ធអាជីវកម្ម',email:'អ៊ីមែលបុគ្គលិក',password:'ពាក្យសម្ងាត់',companyCode:'លេខកូដក្រុមហ៊ុន',signIn:'ចូលផ្ទាំងគ្រប់គ្រង',sso:'ប្រើគណនីគេហទំព័របច្ចុប្បន្ន',kyc:'ការពិនិត្យ KYC',loans:'ពាក្យស្នើសុំកម្ចី',funding:'ការបញ្ចេញប្រាក់',repayment:'ការសងប្រាក់',postloan:'ការប្រមូលបំណុល / ហួសកំណត់',notifications:'ការជូនដំណឹង Telegram',permissions:'បុគ្គលិក និងសិទ្ធិ',pricing:'ការកំណត់ថ្លៃកម្ចី',save:'រក្សាទុក',create:'បន្ថែម',all:'ទាំងអស់',enabled:'បានបើក',disabled:'បានបិទ'}
};
const phrases:Record<string,string>={
 '公司协作':'dashboard','客户入口':'customer','退出登录':'logout','刷新':'refresh','切换公司':'company','返回公司选择':'back','业务后台登录':'login','服务机构后台登录':'login','员工邮箱':'email','登录密码':'password','公司代码':'companyCode','登录业务后台':'signIn','登录服务机构后台':'signIn','使用当前站点账号登录':'sso','KYC 审核订单':'kyc','贷款申请订单':'loans','放款管理':'funding','还款管理':'repayment','贷后催收／逾期订单':'postloan','Telegram 通知':'notifications','员工与权限':'permissions','贷款费用配置':'pricing','保存':'save','新增':'create','全部':'all','启用':'enabled','已停用':'disabled'
};
function translate(text:string,locale:Locale){const key=phrases[text];return key?copy[locale][key]:legacyText(text,locale)}
function translateTree(root:HTMLElement,locale:Locale){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const tag=node.parentElement?.tagName.toLowerCase();if(['input','textarea','script','style'].includes(tag||''))continue;const raw=node.textContent||'',trim=raw.trim(),out=translate(trim,locale);if(out!==trim)node.textContent=raw.replace(trim,out)}}
export function AdminLocaleShell({children}:{children:ReactNode}){
 const [locale,setLocale]=useState<Locale>(()=>{if(typeof window==='undefined')return 'zh';const saved=window.localStorage.getItem('payease-admin-language');return saved==='en'||saved==='km'||saved==='zh'?saved:'zh'});
 const choose=(next:Locale)=>{setLocale(next);window.localStorage.setItem('payease-admin-language',next);void apiFetch('/api/team/locale',{method:'POST',body:JSON.stringify({locale:next})}).catch(()=>undefined)};
 const syncLocale=(next:Locale)=>{setLocale(next);window.localStorage.setItem('payease-admin-language',next)};
 const value=useMemo(()=>({locale,t:(key:string)=>copy[locale][key]||key,setLocale:choose,syncLocale}),[locale]);
 useEffect(()=>{const root=document.querySelector<HTMLElement>('.team-shell');if(!root)return;translateTree(root,locale);const observer=new MutationObserver(()=>translateTree(root,locale));observer.observe(root,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect()},[locale]);
 return <AdminLocaleContext.Provider value={value}><div className="admin-locale-root" lang={locale}>{children}</div></AdminLocaleContext.Provider>
}
type AdminLocaleValue={locale:Locale;t:(key:string)=>string;setLocale:(locale:Locale)=>void;syncLocale:(locale:Locale)=>void};
export const AdminLocaleContext=createContext<AdminLocaleValue>({locale:'zh',t:key=>copy.zh[key]||key,setLocale:()=>undefined,syncLocale:()=>undefined});
export const useAdminLocale=()=>useContext(AdminLocaleContext);
