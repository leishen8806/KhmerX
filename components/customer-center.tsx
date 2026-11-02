'use client';

import {useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {CsvExport} from '@/components/csv-export';
import {OperatorRow} from '@/components/operator-row';

const labels:Record<string,string>={draft:'草稿',submitted:'待人工审核',needs_info:'待补件',approved:'审核通过',rejected:'审核未通过'};

export function CustomerCenter({customers,events,pageOnly=false,total}:{customers:any[];events:any[];pageOnly?:boolean;total?:number}){
  const [query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const visible=useMemo(()=>customers.filter(c=>[c.customerRef,c.customerId,c.phoneMasked,c.kyc?.status,c.kyc?.publicRef,c.kyc?.id,...(c.loans||[]).flatMap((l:any)=>[l.publicRef,l.id])].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[customers,query]);
  const current=visible.find(c=>c.customerId===selected)||customers.find(c=>c.customerId===selected);
  return <section className="customer-center panel" aria-label="客户中心">
    <div className="customer-center-head"><div><p className="eyebrow">CUSTOMER CENTER</p><h2>客户列表与 360° 详情</h2><p className="fine">仅显示当前员工公司、部门和分单范围内的脱敏资料。</p></div><div className="button-row"><span className="fine">{pageOnly?'本页 ':''}{visible.length} / {total??customers.length} 位客户</span><CsvExport filename="khmerx-customers.csv" columns={['customerRef','phoneMasked','kycStatus','loanCount']} rows={visible.map(c=>({customerRef:c.customerRef||c.customerId,phoneMasked:c.phoneMasked||'—',kycStatus:c.kyc?.status||'none',loanCount:c.loans?.length||0}))}/></div></div>
    <label>{pageOnly?'本页搜索':'统一搜索'}<Input aria-label="统一客户搜索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="用户编号、脱敏手机号、KYC 编号或 Loan ID"/></label>
    <div className="customer-center-grid"><div className="customer-list">
      {!visible.length&&<p className="sample">没有符合范围或搜索条件的客户。</p>}
      {visible.map(c=><button type="button" className={'customer-list-row '+(current?.customerId===c.customerId?'selected':'')} key={c.customerId} onClick={()=>setSelected(c.customerId)}>
        <OperatorRow title={c.customerRef||c.customerId.slice(0,12)} secondary={<>{c.phoneMasked||'未绑定手机号'} · {c.kyc?labels[c.kyc.status]||c.kyc.status:'未创建 KYC'}</>} meta={<>{c.loans?.length||0} 笔贷款</>}/>
      </button>)}
    </div><div className="customer-detail">
      {!current?<p className="sample">选择一位客户查看详情。</p>:<><div className="customer-detail-head"><div><p className="eyebrow">CUSTOMER 360</p><h3>{current.customerRef||current.customerId}</h3><p className="fine">内部客户 ID：{current.customerId}</p><p>{current.phoneMasked||'未绑定手机号'}</p></div><Button variant="outline" onClick={()=>setSelected(null)}>关闭详情</Button></div>
        <dl className="customer-detail-facts"><div><dt>KYC 状态</dt><dd>{current.kyc?labels[current.kyc.status]||current.kyc.status:'未创建'}</dd></div><div><dt>KYC 编号</dt><dd>{current.kyc?.publicRef||current.kyc?.id||'—'}</dd></div><div><dt>KYC 版本</dt><dd>{current.kyc?.revision??'—'}</dd></div><div><dt>分单版本</dt><dd>{current.assignment?.version??'—'}</dd></div><div><dt>贷款数量</dt><dd>{current.loans?.length||0}</dd></div></dl>
        <h4>贷款与账单</h4>{!current.loans?.length?<p className="fine">暂无贷款记录。</p>:current.loans.map((l:any)=><OperatorRow key={l.id} className="customer-timeline-row" title={l.publicRef||l.id} secondary={<>内部订单 ID：{l.id}</>} meta={<>{l.status} · ${(Number(l.amount||0)/100).toFixed(2)}</>}/>)}
        <h4>业务时间线</h4>{events.filter((e:any)=>current.loans?.some((l:any)=>l.id===e.loanId)).slice(0,8).map((e:any,i:number)=><OperatorRow key={e.id||i} className="customer-timeline-row" title={e.action||e.type||'状态更新'} meta={e.at||'—'}/>)}{!events.some((e:any)=>current.loans?.some((l:any)=>l.id===e.loanId))&&<p className="fine">暂无可见操作记录。</p>}
      </>}</div></div>
  </section>;
}
