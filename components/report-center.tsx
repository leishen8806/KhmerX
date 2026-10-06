'use client';
import {useMemo} from 'react';

const kycLabels:Record<string,string>={draft:'草稿',submitted:'待审核',needs_info:'待补件',approved:'已通过',rejected:'未通过'};
const loanLabels:Record<string,string>={decision_pending:'待审批',approved:'待签约',signed:'待放款',active:'还款中',overdue:'逾期',closed:'已结清',rejected:'已拒绝'};
function countBy(rows:any[],key:string){return rows.reduce<Record<string,number>>((out,row)=>{const value=String(row?.[key]||'unknown');out[value]=(out[value]||0)+1;return out},{});}
export function ReportCenter({customers,loans,entries,notifications}:{customers:any[];loans:any[];entries:any[];notifications:any[]}){
 const kyc=useMemo(()=>countBy(customers.filter(c=>c.kyc),'status'),[customers]);
 const loan=useMemo(()=>countBy(loans,'status'),[loans]);
 const funded=useMemo(()=>entries.filter(e=>e.kind==='测试放款').reduce((sum,e)=>sum+(Number(e.cents)||0),0)/100,[entries]);
 const repaid=useMemo(()=>entries.filter(e=>e.kind==='测试还款').reduce((sum,e)=>sum+(Number(e.cents)||0),0)/100,[entries]);
 const delivered=notifications.filter(n=>n.status==='sent').length,failed=notifications.filter(n=>['failed','dead'].includes(n.status)).length;
 return <section className="report-center panel" aria-label="数据报表"><div className="report-center-head"><div><p className="eyebrow">REPORT CENTER</p><h2>运营数据摘要</h2><p className="fine">仅统计当前员工公司、部门和分单范围内的数据；金额为测试资金口径。</p></div><span className="fine">客户 {customers.length} · 贷款 {loans.length}</span></div><div className="report-kpis"><div><span>KYC 待审核/补件</span><strong>{(kyc.submitted||0)+(kyc.needs_info||0)}</strong></div><div><span>在贷与逾期</span><strong>{(loan.active||0)+(loan.overdue||0)}</strong></div><div><span>测试放款</span><strong>${funded.toFixed(2)}</strong></div><div><span>测试还款</span><strong>${repaid.toFixed(2)}</strong></div></div><div className="report-grid"><article><h3>KYC 状态</h3>{Object.entries(kycLabels).map(([key,label])=><p key={key}><span>{label}</span><b>{kyc[key]||0}</b></p>)}</article><article><h3>贷款状态</h3>{Object.entries(loanLabels).map(([key,label])=><p key={key}><span>{label}</span><b>{loan[key]||0}</b></p>)}</article><article><h3>通知发送</h3><p><span>成功发送</span><b>{delivered}</b></p><p><span>失败/死信</span><b className={failed?'report-alert':''}>{failed}</b></p><p><span>总记录</span><b>{notifications.length}</b></p></article></div><p className="fine report-note">当前版本提供只读运营摘要。脱敏导出、导出审批和导出审计将在报表阶段后续迭代中启用。</p></section>;
}
