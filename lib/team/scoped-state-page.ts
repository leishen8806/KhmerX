import {AuthError} from '@/lib/h5-auth-core';
import {customerRowsMode,readStaffPage,type StaffPage} from '@/lib/customer-shards';
import {readState} from '@/lib/store';
import {backfillLegacyLoanBindings} from './legacy-loans';
import {db,staff} from './server';
import {filtered} from './workflow';

/** Return the staff workspace page without changing the legacy unpaged path. */
export async function scopedStatePage(input:StaffPage={}){
 const s=await staff();
 if(!s)throw new AuthError('请先选择公司',403);
 await backfillLegacyLoanBindings(s.tenant.id);
 if(customerRowsMode()!=='on'){
  const result=await filtered(await readState(s.tenant.id),s.member);
  return {...result,team:{company:s.tenant.name,role:s.member.role,unitId:s.member.unit_id}};
 }
 const page=await readStaffPage(db(),s.member,input);
 const result=await filtered(page,s.member);
 const customerIds=new Set(page.customerIds);
 return {
  ...result,
  customers:result.customers.filter(customer=>(customerIds.has(customer.customerId))),
  pagination:page.pagination,
  customerPagination:page.customerPagination,
  team:{company:s.tenant.name,role:s.member.role,unitId:s.member.unit_id},
 };
}
