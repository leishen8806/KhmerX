type CompanyLabel={id?:string;name?:string;slug?:string};
const normalized=(value:string)=>value.trim().toLowerCase();
export function companyIdentity(company:CompanyLabel){return [company.name,company.slug].filter(Boolean).join(' · ')}
export function duplicateCompanyName(companies:CompanyLabel[],name:string,excludeId?:string){const key=normalized(name);return !!key&&companies.some(c=>c.id!==excludeId&&normalized(c.name||'')===key)}
export function duplicateMemberEmail(members:{email?:string}[],email:string){const key=normalized(email);return !!key&&members.some(m=>normalized(m.email||'')===key)}
