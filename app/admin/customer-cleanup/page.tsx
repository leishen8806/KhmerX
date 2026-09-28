import {platformAdmin} from '@/lib/team/server';
import Client from './client';
export const dynamic='force-dynamic';
export default async function Page(){await platformAdmin();return <Client/>}
