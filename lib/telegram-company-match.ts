import {validateInitData} from './telegram.ts';

type CredentialLookup={owners:(channel:string)=>Promise<string[]>;token:(owner:string,channel:string)=>Promise<string>};

/** Check a failed deployment credential without exposing which other company matched. */
export async function hasOtherCompanyCredential(initData:string,ownOwners:string[],channels:string[],lookup:CredentialLookup){
 const own=new Set(ownOwners);
 for(const channel of channels){
  for(const candidate of await lookup.owners(channel)){
   if(own.has(candidate))continue;
   const token=await lookup.token(candidate,channel);if(!token)continue;
   try{await validateInitData(initData,token);return true}catch{}
  }
 }
 return false;
}
