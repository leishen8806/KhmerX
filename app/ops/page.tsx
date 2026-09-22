import {selectedCompany} from '@/lib/team/server';
import {redirect} from 'next/navigation';
import Workspace from '../workspace';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/ops');if(await selectedCompany())redirect('/team');return <Workspace initialRole="ops"/>}
