import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {fundingSettingsData,fundingSettingsSave} from '@/lib/team/funding-settings';
export async function GET(){try{return json(await fundingSettingsData())}catch(e){return failure(e)}}
export async function POST(request:Request){try{sameOrigin(request);return json(await fundingSettingsSave(await input(request)),200,{},request)}catch(e){return failure(e,request)}}
