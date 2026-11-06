export type H5ChannelStatus='active'|'maintenance'|'disabled';

type ChannelConfig={mode?:unknown};

/** Resolve the public H5 channel state without reading a request or database. */
export function h5ChannelStatus(config:ChannelConfig,channelId?:unknown,override?:unknown):H5ChannelStatus{
 const value=String(override??'').trim().toLowerCase();
 if(value==='maintenance'||value==='maint')return 'maintenance';
 if(value==='disabled'||value==='off')return 'disabled';
 if(String(config.mode||'').trim().toLowerCase()==='disabled'||!channelId)return 'disabled';
 return 'active';
}

export function h5ChannelErrorCode(status:H5ChannelStatus):'CHANNEL_MAINTENANCE'|'CHANNEL_DISABLED'|undefined{
 return status==='maintenance'?'CHANNEL_MAINTENANCE':status==='disabled'?'CHANNEL_DISABLED':undefined;
}
