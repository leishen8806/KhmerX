import {body,context,json,failed,KycError,origin,settings,db} from '@/lib/kyc/server';

export const dynamic='force-dynamic';

type GoogleGeocodeResponse={status?:string;error_message?:string;results?:Array<{formatted_address?:string;place_id?:string;types?:string[];geometry?:{location?:{lat?:number;lng?:number}}}>};

export async function POST(request:Request){
 try{
  origin(request);
  const c=await context(request),p=await body(request),address=typeof p.address==='string'?p.address.trim():'';
  if(!address||address.length>240)throw new KycError('请输入 1–240 个字符的详细地址');
  // Geocoding is an authenticated, billable upstream call. Reuse the
  // bounded D1 limiter and key it by tenant + customer so one account
  // cannot exhaust the provider quota for the whole company.
  const now=Math.floor(Date.now()/1000),limitKey=`geocode|${c.owner}|${c.customerId}`;
  // Keep the shared limiter table bounded. Authentication traffic performs
  // the same pruning, but geocoding can be used independently of login.
  await db().prepare('DELETE FROM h5_limits WHERE window_start+3600<=? AND next_allowed<=?').bind(now,now).run();
  const limited=await db().prepare(`INSERT INTO h5_limits (key,window_start,count,next_allowed) VALUES (?, ?, 1, ?)
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start+60<=? THEN 1 ELSE count+1 END,
   window_start=CASE WHEN window_start+60<=? THEN ? ELSE window_start END,next_allowed=?
   WHERE (window_start+60<=? OR count<10) AND next_allowed<=? RETURNING key`).bind(limitKey,now,now,now,now,now,now,now,now).first();
  if(!limited)throw new KycError('地址查询过于频繁，请稍后重试',429,'GEOCODE_RATE_LIMITED');
  const key=settings().GOOGLE_MAPS_API_KEY?.trim();
  if(!key)throw new KycError('Google 地图定位服务尚未配置，请联系管理员',503);
  const language=p.language==='km'||p.language==='zh'||p.language==='en'?p.language:'en';
  const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address',address);
  url.searchParams.set('components','country:KH');
  url.searchParams.set('language',language);
  url.searchParams.set('region','kh');
  url.searchParams.set('key',key);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let response:Response;
  try{response=await fetch(url,{method:'GET',headers:{'cache-control':'no-store'},signal:controller.signal})}catch{throw new KycError('Google 地图定位服务暂时不可用，请稍后重试',503)}finally{clearTimeout(timer)}
  if(!response.ok)throw new KycError('Google 地图定位服务暂时不可用，请稍后重试',503);
  const result=await response.json() as GoogleGeocodeResponse;
  if(result.status==='ZERO_RESULTS')throw new KycError('未找到匹配地址，请补充省、市、区或街道信息',422);
  if(result.status!=='OK')throw new KycError('Google 地图定位失败，请检查地址后重试',503);
  const first=result.results?.[0],location=first?.geometry?.location;
  if(!first||typeof location?.lat!=='number'||typeof location.lng!=='number'||!first.formatted_address)throw new KycError('Google 地图未返回有效地址',503);
  return json({address,formattedAddress:first.formatted_address,lat:location.lat,lon:location.lng,placeId:first.place_id||'',types:first.types||[],source:'google_geocoding',customerId:c.customerId});
 }catch(e){return failed(e)}
}
