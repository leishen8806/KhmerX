import {requireChatGPTUser} from '../chatgpt-auth';
import KycClient from './client';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/kyc');return <KycClient/>}
