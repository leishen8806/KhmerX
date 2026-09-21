import {requireChatGPTUser} from '../chatgpt-auth';
import H5Login from './login';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/h5');return <H5Login/>}
