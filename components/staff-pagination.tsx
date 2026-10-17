'use client';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from '@/components/ui/select';
import {statusNames} from '@/lib/domain';
import type {StaffPagination} from '@/lib/api-client';

export function StaffPaginationControls({loan,customer,status,loading,busy,error,onPage,onStatus,onRetry}:{loan?:StaffPagination;customer?:StaffPagination;status:string;loading:boolean;busy:boolean;error:string;onPage:(page:number)=>void;onStatus:(status:string)=>void;onRetry:()=>void}){
 const pages=Math.max(loan?.pages||1,customer?.pages||1),page=loan?.page||customer?.page||1;
 return <section aria-label="工作区列表分页" aria-busy={loading}>
  {loading&&<p role="status">正在加载列表…</p>}{error&&<p role="alert">{error}<Button variant="outline" disabled={loading||busy} onClick={onRetry}>重试列表</Button></p>}
  {loan&&<><p className="fine">以下摘要、查询与 CSV 快照仅覆盖本页；贷款状态筛选影响贷款，不影响客户总数。完整统计请使用服务端报表导出。</p>
   <div className="pagination"><div aria-live="polite"><span>贷款：第 {loan.page} / {loan.pages} 页，共 {loan.total} 条</span>{customer&&<span> · 客户：第 {customer.page} / {customer.pages} 页，共 {customer.total} 位</span>}</div>
    <Button variant="outline" aria-label="上一页" disabled={loading||busy||Boolean(error)||page<=1} onClick={()=>onPage(page-1)}>上一页</Button>
    <Button variant="outline" aria-label="下一页" disabled={loading||busy||Boolean(error)||page>=pages} onClick={()=>onPage(page+1)}>下一页</Button>
    <label>贷款状态<Select value={status||'all'} onValueChange={value=>onStatus(value==='all'?'':value)} disabled={loading||busy}><SelectTrigger aria-label="贷款状态"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem>{Object.entries(statusNames).map(([value,label])=><SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></label>
   </div></>}
 </section>;
}
