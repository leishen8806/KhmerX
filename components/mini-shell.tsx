'use client';
import Link from 'next/link';
import {ArrowLeft,Home,ReceiptText,UserRound,Bell} from 'lucide-react';
import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {I18nContext,i18nValue,legacyText,type Locale,localeLabels} from '@/lib/i18n';
import {trackEvent} from '@/lib/analytics';
import {apiFetch} from '@/lib/api-client';

export const miniTitles:Record<string,string>={home:'home',apply:'apply',bill:'bill',sign:'sign',status:'status',repay:'repay',withdraw:'withdraw',records:'records',me:'me',kyc:'kyc',contract:'loanAgreement'};
const supported=(value:string|null):value is Locale=>value==='en'||value==='km'||value==='zh';
type AuthBootstrap={languages?:Partial<Record<Locale,boolean>>};
const defaultLocale=():Locale=>typeof navigator!=='undefined'&&navigator.language.toLowerCase().startsWith('km')?'km':'en';
const localize=(root:HTMLElement,locale:Locale)=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let n:Node|null;while((n=walker.nextNode())){const parent=(n.parentElement?.tagName||'').toLowerCase();if(!['script','style','textarea','input'].includes(parent)&&n.textContent?.trim())nodes.push(n as Text)}for(const node of nodes){const original=node.textContent||'';const trimmed=original.trim();const translated=legacyText(trimmed,locale);if(translated!==trimmed)node.textContent=original.replace(trimmed,translated)}};
export type MiniNavigate=(href:string)=>void;
const MiniNavigationContext=createContext<MiniNavigate|null>(null);
export function MiniNavigationProvider({navigate,children}:{navigate:MiniNavigate;children:ReactNode}){
 const guarded:MiniNavigate=href=>{const event=new CustomEvent('payease:before-navigate',{cancelable:true,detail:{href,resume:()=>navigate(href)}});if(window.dispatchEvent(event))navigate(href)};
 return <MiniNavigationContext.Provider value={guarded}>{children}</MiniNavigationContext.Provider>;
}
export function useMiniNavigation(){return useContext(MiniNavigationContext)}
export function MiniNavLink({href,className,children,ariaLabel}:{href:string;className?:string;children:ReactNode;ariaLabel?:string}){const navigate=useMiniNavigation();if(!navigate)return <Link href={href} prefetch={false} className={className} aria-label={ariaLabel}>{children}</Link>;return <button type="button" className={[className,'mini-nav-button'].filter(Boolean).join(' ')} aria-label={ariaLabel} onClick={()=>navigate(href)}>{children}</button>}
export function MiniTranslatedGreeting({name}:{name:string}){const {t}=useContext(I18nContext);return <p>{t('hello',{name})}</p>}

export function MiniShell({screen,backHref,children}:{screen:string;backHref?:string;children:ReactNode}){
 const navigate=useMiniNavigation();
 const goTo=(href:string)=>{if(navigate){navigate(href);return}const target=new URL(href,window.location.origin);target.hash=window.location.hash;window.location.assign(target.toString())};
 const [language,setLanguage]=useState<Locale>(()=>{if(typeof window==='undefined')return 'en';const query=new URLSearchParams(window.location.search).get('lang');const saved=window.localStorage.getItem('payease-language');return supported(query)?query:supported(saved)?saved:defaultLocale()});
 const languageRef=useRef(language);
 const [enabledLanguages,setEnabledLanguages]=useState<Record<Locale,boolean>>({en:true,km:true,zh:true});
 const [languageOpen,setLanguageOpen]=useState(false);
 useEffect(()=>{languageRef.current=language},[language]);
 useEffect(()=>{const removeLoginLocale=()=>document.querySelector('.auth-locale')?.remove();removeLoginLocale();const observer=new MutationObserver(removeLoginLocale);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);
 useEffect(()=>{void apiFetch<AuthBootstrap>('/api/h5/auth',{cache:'no-store'}).then(({data:d})=>{const flags=d?.languages;if(!flags)return;const next={en:flags.en!==false,km:flags.km!==false,zh:flags.zh!==false};setEnabledLanguages(next);if(!next[language]){const fallback=next.en?'en':next.km?'km':'zh';setLanguage(fallback);window.localStorage.setItem('payease-language',fallback)}}).catch(()=>undefined)},[]);
 const chooseLanguage=(next:Locale)=>{if(!enabledLanguages[next])return;
  // Apply the visible copy before React/API work starts. This prevents a
  // language switch from showing a mixed-language frame on slower devices.
  const root=document.querySelector<HTMLElement>('.mini-app');
  languageRef.current=next;if(root){root.lang=next;localize(root,next)}
  setLanguageOpen(false);
  window.dispatchEvent(new CustomEvent<Locale>('payease-language-change',{detail:next}));
  setLanguage(next);window.localStorage.setItem('payease-language',next);const url=new URL(window.location.href);url.searchParams.set('lang',next);window.history.replaceState({},'',url);void apiFetch('/api/h5/locale',{method:'POST',body:JSON.stringify({locale:next})}).catch(()=>undefined)};
 const value=useMemo(()=>i18nValue(language),[language]);
 useEffect(()=>{trackEvent('page_view',{screen});},[screen]);
 useEffect(()=>{setLanguageOpen(false)},[screen]);
 useEffect(()=>{const closeLanguageMenu=(event:PointerEvent)=>{const menu=document.querySelector<HTMLElement>('.mini-icon-menu');if(menu&&!menu.contains(event.target as Node))setLanguageOpen(false)};document.addEventListener('pointerdown',closeLanguageMenu);return()=>document.removeEventListener('pointerdown',closeLanguageMenu)},[]);
 useEffect(()=>{const root=document.querySelector<HTMLElement>('.mini-app');if(!root)return;let observer:MutationObserver|null=null;let frame=0;let applying=false;
  const apply=()=>{if(applying)return;applying=true;observer?.disconnect();localize(root,languageRef.current);observer?.observe(root,{subtree:true,childList:true,characterData:true});applying=false};
  const schedule=()=>{if(applying||frame)return;frame=window.requestAnimationFrame(()=>{frame=0;apply()})};
  apply();observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,characterData:true});
  return()=>{if(frame)window.cancelAnimationFrame(frame);observer?.disconnect()}
 },[language]);
 const {t}=value;
 return <I18nContext.Provider value={value}><div className="mini-app" lang={language}><header className="mini-top">{screen!=='home'?<MiniNavLink href={backHref||(['repay','withdraw','bill'].includes(screen)?'/h5/records':'/h5')} ariaLabel={t('back')}><ArrowLeft size={21}/></MiniNavLink>:<MiniNavLink href="/h5" className="mini-logo-link" ariaLabel="PayEase"><img className="mini-brand-logo" src="/brand/khmerx-icon-v2.png" alt="KhmerX" width={56} height={56}/></MiniNavLink>}<strong>{t(miniTitles[screen]||'home')}</strong><div className="mini-top-actions"><div className="mini-icon-menu"><button type="button" className="mini-icon-menu-trigger" aria-label={t('language')} aria-expanded={languageOpen} onClick={()=>setLanguageOpen(open=>!open)}><img className="mini-language-flag" src={language==='km'?'/flags/kh.png':language==='zh'?'/flags/cn.svg':'/flags/uk.png'} alt="" aria-hidden="true"/></button>{languageOpen&&<div>{(['en','km','zh'] as Locale[]).filter(next=>enabledLanguages[next]).map(next=><button type="button" key={next} lang={next} onClick={()=>chooseLanguage(next)}><img src={next==='km'?'/flags/kh.png':next==='zh'?'/flags/cn.svg':'/flags/uk.png'} alt="" aria-hidden="true"/> {localeLabels[next]}</button>)}</div>}</div><MiniNavLink className="mini-icon-button" href="/h5/me?panel=messages" ariaLabel={t('notifications')}><Bell size={19}/><span className="mini-unread-dot" aria-hidden="true"/></MiniNavLink></div></header><div className="mini-content">{children}</div><nav className="mini-bottom" aria-label={t('home')}>{[{screen:'home',href:'/h5',key:'home',Icon:Home},{screen:'records',href:'/h5/records',key:'records',Icon:ReceiptText},{screen:'me',href:'/h5/me',key:'me',Icon:UserRound}].map(({screen:s,href,key,Icon})=><button type="button" className="mini-tab-button" key={s} aria-current={screen===s?'page':undefined} onClick={()=>goTo(href)}><Icon size={22}/><span>{t(key)}</span></button>)}</nav></div></I18nContext.Provider>
}
