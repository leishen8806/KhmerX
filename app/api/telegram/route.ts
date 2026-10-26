import {requireOrigin} from '@/lib/http/route';
import {customer,input,json,failure} from '@/lib/h5-auth';
import {notificationSettings,bindNotifications,notificationAdmin,retryNotificationDelivery} from '@/lib/notifications/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{if(new URL(request.url).searchParams.get('view')==='admin')return json(await notificationAdmin());const {ownerId,session}=await customer(request);return json(await notificationSettings(ownerId,session.customerId))}catch(e){return failure(e)}}
export async function POST(request:Request){try{requireOrigin(request);const payload=await input(request);if(payload?.action==='manual_retry'){return json(await retryNotificationDelivery(typeof payload.id==='string'?payload.id:''))}const {ownerId,session}=await customer(request);return json(await bindNotifications(ownerId,session.customerId,payload))}catch(e){return failure(e,request)}}
