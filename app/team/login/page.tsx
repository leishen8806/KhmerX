import {requireChatGPTUser} from '@/app/chatgpt-auth';
import Login from './client';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/team/login');return <Login/>}
