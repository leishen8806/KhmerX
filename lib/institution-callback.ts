const encoder=new TextEncoder();

function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
function canonical(input:{institutionId:string;timestamp:string;nonce:string;body:string}){return [input.institutionId,input.timestamp,input.nonce,input.body].join('\n')}

export async function signInstitutionCallback(secret:string,input:{institutionId:string;timestamp:string;nonce:string;body:string}){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(canonical(input))));
}

export async function verifyInstitutionCallback(secret:string,input:{institutionId:string;timestamp:string;nonce:string;body:string;signature:string},now=Math.floor(Date.now()/1000),skew=300){
 const timestamp=Number(input.timestamp);
 if(!/^[0-9]{10}$/.test(input.timestamp)||!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>skew)return false;
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.nonce)||!/^[a-f0-9]{64}$/i.test(input.signature))return false;
 const expected=await signInstitutionCallback(secret,input);
 return expected.toLowerCase()===input.signature.toLowerCase();
}
