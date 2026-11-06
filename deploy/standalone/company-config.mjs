// Resolve the customer tenant selected by a standalone deployment.  A
// single-company config keeps the legacy companies[0] fallback; multi-company
// configs must opt in with an explicit customerCompanyId.
export function deploymentCustomerCompany(config){
 const companies=Array.isArray(config?.companies)?config.companies:[];
 const explicit=typeof config?.customerCompanyId==='string'?config.customerCompanyId.trim():'';
 if(explicit)return explicit;
 return companies.length===1&&typeof companies[0]?.id==='string'?companies[0].id:null;
}

export function assertCustomerCompanyConfig(config,{requireExplicit=false}={}){
 const companies=Array.isArray(config?.companies)?config.companies:[];
 if(!companies.length)throw new Error('Customer company binding requires at least one company');
 const explicit=typeof config?.customerCompanyId==='string'?config.customerCompanyId.trim():'';
 if(requireExplicit&&!explicit)throw new Error('Customer company binding is required');
 const bound=deploymentCustomerCompany(config);
 if(bound&&!companies.some(company=>company?.id===bound))throw new Error('Customer company binding does not match companies');
 return bound;
}
