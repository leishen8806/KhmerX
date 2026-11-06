import {env} from 'cloudflare:workers';
import {AuthError,type AuthRuntime} from '@/lib/h5-auth-core';
import {h5ChannelErrorCode,h5ChannelStatus,type H5ChannelStatus} from '@/lib/h5-channel-status';

export function channelStatus(r:AuthRuntime,channelId?:unknown):H5ChannelStatus{
 const values=env as unknown as Record<string,unknown>;
 return h5ChannelStatus(r.config,channelId,values.PAYEASE_H5_CHANNEL_STATUS);
}

export function requireH5ChannelAvailable(r:AuthRuntime,channelId?:unknown):void{
 const status=channelStatus(r,channelId),code=h5ChannelErrorCode(status);
 if(code)throw new AuthError(status==='maintenance'?'当前渠道正在维护':'当前渠道已停用',status==='maintenance'?503:403,undefined,code);
}
