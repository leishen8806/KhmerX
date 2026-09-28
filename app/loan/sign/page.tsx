import {requireChatGPTUser} from '@/app/chatgpt-auth';
import LoanSign from './client';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/loan/sign');return <LoanSign/>}
