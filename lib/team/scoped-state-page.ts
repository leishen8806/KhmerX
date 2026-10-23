import {AuthError} from '@/lib/h5-auth-core';
import {customerRowsMode,readStaffPage,type StaffPage} from '@/lib/customer-shards';
import {readState} from '@/lib/store';
import {db,staff} from './server';
import {filtered} from './workflow';

/** Return the staff workspace page without changing the legacy unpaged path. */
export async function scopedStatePage(input:StaffPage={}){
 const s=await staff();
 if(!s)throw new AuthError('请先选择公司',403);
 if(customerRowsMode()!=='on'){
  const result=await filtered(await readState(s.tenant.id),s.member);
  return {...result,team:{company:s.tenant.name,role:s.member.role,unitId:s.member.unit_id}};
 }
 const page=await readStaffPage(db(),s.member,input);
 const filteredResult:any=await filtered(page,s.member,new Set(page.scopeIds||page.customerIds));
 const {customerLoans:_,...result}=filteredResult;
 const customerIds=new Set(page.customerIds);
 return {
  ...result,
  customers:result.customers.filter((customer:any)=>(customerIds.has(customer.customerId))),
  pagination:page.pagination,
  customerPagination:page.customerPagination,
  team:{company:s.tenant.name,role:s.member.role,unitId:s.member.unit_id},
 };
}
