import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState,mutate} from '@/lib/store';
export const dynamic='force-dynamic';
export async function GET(){const u=await getChatGPTUser();if(!u)return Response.json({error:'请先登录测试工作区'},{status:401});try{return Response.json(await readState(u.userId),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'测试数据库暂不可用，请稍后重试'},{status:503})}}
export async function POST(request:Request){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'请先登录测试工作区'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'不允许跨站操作'},{status:403});
 try{const raw=await request.text();if(raw.length>10000)return Response.json({error:'请求过大'},{status:413});return Response.json(await mutate(u.userId,JSON.parse(raw)))}catch(e){return Response.json({error:e instanceof Error?e.message:'操作失败'},{status:400})}
}
