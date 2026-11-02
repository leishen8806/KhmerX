'use client';

import {useMemo,useState} from 'react';
import {Button} from '@/components/ui/button';
import {apiFetch} from '@/lib/api-client';
import {OperatorRow} from '@/components/operator-row';

const kycLabels:Record<string,string>={draft:'草稿',submitted:'待审核',needs_info:'待补件',approved:'已通过',rejected:'未通过'};
const loanLabels:Record<string,string>={decision_pending:'待审批',approved:'待签约',signed:'待放款',active:'还款中',overdue:'逾期',closed:'已结清',rejected:'已拒绝'};
function countBy(rows:any[],key:string){return rows.reduce<Record<string,number>>((out,row)=>{const value=String(row?.[key]||'unknown');out[value]=(out[value]||0)+1;return out},{});}

export function ReportCenter({customers,loans,entries,notifications,pageOnly=false,customerTotal,loanTotal}:{customers:any[];loans:any[];entries:any[];notifications:any[];pageOnly?:boolean;customerTotal?:number;loanTotal?:number}){
  const [exporting,setExporting]=useState(false),[exportNotice,setExportNotice]=useState(''),[reportType,setReportType]=useState('customer_summary');
  const kyc=useMemo(()=>countBy(customers.filter(c=>c.kyc),'status'),[customers]),loan=useMemo(()=>countBy(loans,'status'),[loans]);
  const funded=useMemo(()=>entries.filter(e=>e.kind==='测试放款').reduce((sum,e)=>sum+(Number(e.cents)||0),0)/100,[entries]),repaid=useMemo(()=>entries.filter(e=>e.kind==='测试还款').reduce((sum,e)=>sum+(Number(e.cents)||0),0)/100,[entries]);
  const delivered=notifications.filter(n=>n.status==='sent').length,failed=notifications.filter(n=>['failed','dead'].includes(n.status)).length;
  const exportReport=async()=>{setExporting(true);setExportNotice('');try{const {data}=await apiFetch<Blob>('/api/team/reports/export',{method:'POST',body:JSON.stringify({report:reportType,requestId:crypto.randomUUID()})});const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download='payease-'+reportType+'.csv';link.click();URL.revokeObjectURL(url);setExportNotice('已生成脱敏报表，导出动作已记录')}catch(error){setExportNotice((error as Error).message)}finally{setExporting(false)}};
  const statusRows=(labels:Record<string,string>,counts:Record<string,number>)=>Object.entries(labels).map(([key,label])=><OperatorRow key={key} className="report-status-row" title={label} status={counts[key]||0} meta={key}/>);
  return <section className="report-center panel" aria-label="数据报表">
    <div className="report-center-head"><div><p className="eyebrow">REPORT CENTER</p><h2>{pageOnly?'本页 · 运营数据摘要':'运营数据摘要'}</h2><p className="fine">仅统计当前员工公司、部门和分单范围内的数据；金额为测试资金口径。</p></div><div className="button-row"><span className="fine">客户 {customerTotal??customers.length} · 贷款 {loanTotal??loans.length}</span><select aria-label="导出报表类型" value={reportType} onChange={e=>setReportType(e.target.value)}><option value="customer_summary">客户摘要</option><option value="kyc_funnel">KYC/审批</option><option value="loan_cashflow">放款/还款</option><option value="collections">逾期催收</option></select><Button variant="outline" disabled={exporting} onClick={()=>void exportReport()}>{exporting?'生成中…':'导出脱敏 CSV'}</Button></div></div>
    <div className="report-kpis"><OperatorRow title="KYC 待审核/补件" status={(kyc.submitted||0)+(kyc.needs_info||0)} plainStatus/><OperatorRow title="在贷与逾期" status={(loan.active||0)+(loan.overdue||0)} plainStatus/><OperatorRow title="测试放款" status={`$${funded.toFixed(2)}`} plainStatus/><OperatorRow title="测试还款" status={`$${repaid.toFixed(2)}`} plainStatus/></div>
    <div className="report-grid"><article><h3>KYC 状态</h3>{statusRows(kycLabels,kyc)}</article><article><h3>贷款状态</h3>{statusRows(loanLabels,loan)}</article><article><h3>通知发送</h3><OperatorRow title="成功发送" status={delivered}/><OperatorRow title="失败/死信" status={failed} className={failed?'report-alert':''}/><OperatorRow title="总记录" status={notifications.length}/></article></div>
    {exportNotice&&<p className={exportNotice.startsWith('已')?'success':'error'} role="status">{exportNotice}</p>}<p className="fine report-note">导出仅包含当前员工可见范围，并对客户标识做脱敏；每次导出都会写入审计记录。</p>
  </section>;
}
