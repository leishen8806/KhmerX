type Locale='zh'|'en'|'km';
export const queueTimeLabels={
 zh:{updated:'更新于',unavailable:'更新时间不可用',future:'更新时间晚于当前时间'},
 en:{updated:'Updated',unavailable:'Update time unavailable',future:'Update time is in the future'},
 km:{updated:'បានធ្វើបច្ចុប្បន្នភាព',unavailable:'មិនមានពេលធ្វើបច្ចុប្បន្នភាព',future:'ពេលធ្វើបច្ចុប្បន្នភាពនៅក្រោយពេលបច្ចុប្បន្ន'},
};
/** Last-update display only: never substitute this value for submission time. */
export function formatQueueTime(raw:unknown,now:number|null,locale:Locale):{text:string;iso?:string;full?:string}{
 const labels=queueTimeLabels[locale];
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw))return {text:labels.unavailable};
 const time=Date.parse(raw);
 if(!Number.isFinite(time)||Number(raw.slice(11,13))>23||new Date(raw.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==raw.slice(0,10))return {text:labels.unavailable};
 const iso=new Date(time).toISOString(),full=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(time)+' (Asia/Phnom_Penh)';
 if(now===null)return {text:full,iso,full}; // Stable server/first-client render; clock starts after mount.
 if(time>now)return {text:labels.future,iso,full};
 const elapsed=now-time;
 const [unit,size]:[Intl.RelativeTimeFormatUnit,number]=elapsed>=86400000?['day',86400000]:elapsed>=3600000?['hour',3600000]:elapsed>=60000?['minute',60000]:['second',1000];
 const value=Math.floor(elapsed/size),relative=new Intl.RelativeTimeFormat(locale,{numeric:'always'});
 // Some embedded Chromium builds omit Khmer ICU data and silently fall back to English.
 const text=locale==='km'?new Intl.NumberFormat('km').format(value)+' '+({second:'វិនាទី',minute:'នាទី',hour:'ម៉ោង',day:'ថ្ងៃ'} as Record<string,string>)[unit]+'មុន':relative.format(-value,unit);
 return {text,iso,full};
}
