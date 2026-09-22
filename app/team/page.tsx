import {requireChatGPTUser} from '../chatgpt-auth';
import TeamClient from './client';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/team');return <TeamClient/>}
