'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api-client';

type Channel={id:string;type:string;label:string;enabled:number;auth_mode:string;languages:string[];default_language:string;hosts:string[];origins:string[];telegram_username?:string|null;app_platform?:string|null;api_base_url?:string|null;updated_at:string};
export default function ChannelsClient(){
 const [channels,setChannels]=useState<Channel[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{void apiFetch<{channels:Channel[]}>('/api/team/channels',{cache:'no-store'}).then(({data})=>setChannels(data.channels)).catch(e=>setError(e instanceof Error?e.message:'渠道配置读取失败')).finally(()=>setLoading(false))},[]);
 return <main className="team-shell crm-subpage-shell"><header className="kyc-header crm-topbar"><div className="crm-breadcrumb"><strong>公司渠道配置</strong><i>/</i><span>只读检查</span></div></header><section className="panel"><h1>Telegram Mini App / H5 / App</h1><p className="fine">此页面只读取当前公司配置；保存入口将在完成 owner 审批和启动自检后开放。密钥和加密令牌永不在此页面展示。</p>{error&&<p role="alert" className="error">{error}</p>}{loading&&<p>正在读取渠道配置…</p>}{!loading&&!error&&!channels.length&&<p role="status">当前公司尚未配置渠道。</p>}{channels.map(c=><article className="panel" key={c.id}><h2>{c.label} · {c.type}</h2><p>状态：{c.enabled?'启用':'停用'} · 认证：{c.auth_mode} · 默认语言：{c.default_language}</p><p>可用语言：{c.languages.join('、')||'未配置'}</p><p>Hosts：{c.hosts.join('、')||'未配置'}</p><p>Origins：{c.origins.join('、')||'未配置'}</p>{c.telegram_username&&<p>Telegram：@{c.telegram_username}</p>}{c.app_platform&&<p>App 平台：{c.app_platform} · API：{c.api_base_url||'未配置'}</p>}<p className="fine">最后更新：{c.updated_at}</p></article>)}</section></main>;
}
