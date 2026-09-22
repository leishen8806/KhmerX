import {requireChatGPTUser} from '../chatgpt-auth';
import Contract from './view';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/contract');return <Contract/>}
