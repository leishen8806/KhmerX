export const csvCell=(value:unknown)=>{
 const text=String(value??'').replace(/\r?\n/g,' ');
 const safe=/^[=+\-@]/.test(text)?`'${text}`:text;
 return /[",]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;
};
