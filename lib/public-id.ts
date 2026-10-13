/**
 * Public business references are deliberately separate from internal IDs.
 * They are short enough for operators to read and copy, but contain no
 * tenant, phone, document, amount, or status information.
 */
export const PUBLIC_ID_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PUBLIC_ID_PATTERN=/^[A-Z][0-9A-HJ-KM-NP-TV-Z]{2}[0-9]{6}[0-9A-HJ-KM-NP-TV-Z]{7}$/;
export type PublicEntity='C'|'O'|'K'|'F'|'B'|'T'|'A';
export type PublicChannel='TG'|'H5'|'AP'|'AD'|'IN'|'SY';
export const PUBLIC_ENTITIES=['C','O','K','F','B','T','A'] as const;
export const PUBLIC_CHANNELS=['TG','H5','AP','AD','IN','SY'] as const;

function datePart(now:Date){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return value('year').slice(-2)+value('month')+value('day');
}

function randomPart(){
 const output:string[]=[];
 // Rejection sampling keeps every alphabet character equally likely.
 while(output.length<7){
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  for(const byte of bytes){if(byte>=224)continue;output.push(PUBLIC_ID_ALPHABET[byte&31]);if(output.length===7)break;}
 }
 return output.join('');
}

export function publicIdentifier(entity:PublicEntity,channel:PublicChannel,now=new Date()){
 if(!PUBLIC_ENTITIES.includes(entity)||!PUBLIC_CHANNELS.includes(channel))throw new Error('公共编号实体或渠道无效');
 return `${entity}${channel}${datePart(now)}${randomPart()}`;
}

export function isPublicIdentifier(value:unknown):value is string{return typeof value==='string'&&PUBLIC_ID_PATTERN.test(value)}
