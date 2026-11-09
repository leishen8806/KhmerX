import {requireChatGPTUser} from '@/app/chatgpt-auth';
import ChannelsClient from './client';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/team/channels');return <ChannelsClient/>}
