import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '../../chatgpt-auth';
import TeamClient from '../client';
import {crmQueueSections,type CrmQueueSection} from '@/lib/team/crm-menu';

export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!crmQueueSections.includes(section as CrmQueueSection))notFound();
 await requireChatGPTUser('/team/'+section);
 return <TeamClient initialQueue={section as CrmQueueSection}/>;
}
