'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {apiFetch} from '@/lib/api-client';
export default function Client(){const [phone,setPhone]=useState(''),[preview,setPreview]=useState<any>(null),[error,setError]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
 async function run(action:string){setBusy(true);setError('');try{const {data:d}=await apiFetch<any>('/api/admin/customer-cleanup',{method:'POST',body:JSON.stringify({action,phone,version:preview?.version,confirm:action==='clear'})});if(action==='preview'){setPreview(d);setDone('')}else{setPreview(null);setDone(`已清除 ${d.cleared} 处注册记录及列出的关联草稿，旧登录会话已失效。`)}}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main className="team-shell"><header className="kyc-header"><Link href="/team">返回后台</Link></header><section className="panel"><h1>测试客户注册清理</h1><p>仅平台管理员可操作。按完整手机号匹配全部工作区；只支持未提交审核、无文件和资金记录的测试客户。</p><label>待清理手机号<Input type="tel" value={phone} disabled={busy} onChange={e=>{setPhone(e.target.value);setPreview(null);setDone('')}}/></label><Button disabled={busy||!phone} onClick={()=>void run('preview')}>核对注册记录</Button>{error&&<p role="alert" className="error">{error}</p>}{done&&<p role="status" className="success">{done}</p>}{preview&&<><h2>清理预览</h2>{preview.records.length?preview.records.map((x:any,i:number)=><p key={i}>{x.workspace}：注册 {x.registrations} 条，KYC 草稿 {x.kycDrafts} 份，未提交贷款 {x.unsubmittedLoans} 笔</p>):<p>未找到该手机号的注册记录。</p>}{preview.records.length>0&&<><p>此操作不可撤销，将使相关登录会话失效。仅清理上述客户，其他客户数据保留。</p><Button disabled={busy} onClick={()=>void run('clear')}>确认清除以上全部记录</Button></>}</>}</section></main>}
