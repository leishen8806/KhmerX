import {readState} from '@/lib/store';
import {businessBot} from '@/lib/domain';
import {AuthError,type AuthRuntime} from '@/lib/h5-auth-core';
export async function registrationPolicy(r:AuthRuntime,owner:string,customerId?:string){
 const {state}=await readState(owner);
 const account=customerId?await r.db.prepare('SELECT channel_id FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,customerId).first<{channel_id:string|null}>():null;
 const bot=account?.channel_id?state.bots.find(b=>b.id===account.channel_id):businessBot(state);
 return {channelId:bot?.id,phoneVerification:!!bot&&bot.phoneVerification!==false,passwordSetup:!!bot&&bot.passwordSetup!==false};
}
export async function requireRegistrationStep(r:AuthRuntime,owner:string,customerId:string,step:'phoneVerification'|'passwordSetup'){
 if(!(await registrationPolicy(r,owner,customerId))[step])throw new AuthError('当前业务渠道已关闭此注册步骤',403);
}
