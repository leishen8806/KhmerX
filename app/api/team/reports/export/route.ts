import {exportCustomerSummary} from '@/lib/team/reports';
import {input,failure} from '@/lib/h5-auth';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  const result=await exportCustomerSummary(await input(request));
  return new Response('\ufeff'+result.csv,{headers:{'Cache-Control':'no-store','Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${result.filename}"`,'X-Export-Rows':String(result.count)}});
 }catch(e){return failure(e)}
}
