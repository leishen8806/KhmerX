import {requireChatGPTUser} from '../../chatgpt-auth';
import PartnerOutboxClient from '../partner-outbox-client';
import {AdminLocaleShell} from '@/lib/admin-i18n';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/team/partner-outbox');return <AdminLocaleShell><PartnerOutboxClient/></AdminLocaleShell>}
