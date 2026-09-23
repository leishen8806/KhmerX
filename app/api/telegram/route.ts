import {customer,input,json,failure} from '@/lib/h5-auth';
import {notificationSettings,bindNotifications,notificationAdmin} from '@/lib/notifications/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{if(new URL(request.url).searchParams.get('view')==='admin')return json(await notificationAdmin());const {ownerId,session}=await customer(request);return json(await notificationSettings(ownerId,session.customerId))}catch(e){return failure(e)}}
export async function POST(request:Request){try{const {ownerId,session}=await customer(request);return json(await bindNotifications(ownerId,session.customerId,await input(request)))}catch(e){return failure(e)}}
