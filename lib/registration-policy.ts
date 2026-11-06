import {readState} from '@/lib/store';
import {businessBot} from '@/lib/domain';
import {AuthError,type AuthRuntime,type CustomerSession} from '@/lib/h5-auth-core';
export async function registrationPolicy(r:AuthRuntime,owner:string,customerId?:string){
 const {state}=await readState(owner);
 const account=customerId?await r.db.prepare('SELECT channel_id,telegram_verified FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,customerId).first<{channel_id:string|null;telegram_verified:number|null}>():null;
 const bot=account?.channel_id?state.bots.find(b=>b.id===account.channel_id):businessBot(state);
 // Only an account created through the server-verified Telegram Mini App may
 // skip the client phone step. H5/phone accounts keep the existing Gateway
 // requirement, even when the shared auth mode is Telegram.
 const silentTelegram=r.config?.mode==='telegram'&&account?.telegram_verified===1;
 const demoOtp=r.config?.mode==='demo'&&r.config?.demoOtpAllowed===true;
 return {channelId:bot?.id,phoneVerification:demoOtp?true:silentTelegram?false:r.config?.mode==='telegram'?true:!!bot&&bot.phoneVerification!==false,passwordSetup:!!bot&&bot.passwordSetup!==false};
}
export async function requireRegistrationStep(r:AuthRuntime,owner:string,customerId:string,step:'phoneVerification'|'passwordSetup'){
 if(!(await registrationPolicy(r,owner,customerId))[step])throw new AuthError('当前业务渠道已关闭此注册步骤',403,undefined,'REGISTRATION_STEP_DISABLED');
}
export async function requireRegistrationComplete(r:AuthRuntime,owner:string,session:CustomerSession){
 const policy=await registrationPolicy(r,owner,session.customerId);
 if(policy.phoneVerification&&!session.verificationCompleted)throw new AuthError('请先在客户账号设置中完成手机号验证，再继续申请',403);
 if(policy.passwordSetup&&!session.hasPassword)throw new AuthError('请先在客户账号设置中设置密码，再继续申请',403);
}
