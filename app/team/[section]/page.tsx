import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '../../chatgpt-auth';
import TeamClient from '../client';

export const dynamic='force-dynamic';

const sections=['customers','reports','notifications','tickets','kyc','loans','funding','repayment','postloan'] as const;
type Section=(typeof sections)[number];

export default async function Page({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(!sections.includes(section as Section))notFound();
 await requireChatGPTUser('/team/'+section);
 return <TeamClient initialQueue={section as Section}/>;
}
