import {teamMembersPage} from '@/lib/team/server';
import {failure,json} from '@/lib/h5-auth';

export async function GET(request:Request){
  try{
    const url=new URL(request.url);
    return json(await teamMembersPage({
      page:Number(url.searchParams.get('page')||1),
      pageSize:Number(url.searchParams.get('pageSize')||20),
      query:url.searchParams.get('query')||''
    }));
  }catch(e){return failure(e)}
}
