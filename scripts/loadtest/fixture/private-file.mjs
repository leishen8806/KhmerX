import {execFileSync} from 'node:child_process';
import {lstatSync,statSync,realpathSync,mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {check} from './core.mjs';
export function privateFile(file){
 check(!lstatSync(file).isSymbolicLink()&&statSync(file).nlink===1,'Manifest links refused');
 if(process.platform!=='win32')check((statSync(file).mode&0o177)===0,'Manifest must be 600 or stricter');
 else{
  const script="$ErrorActionPreference='Stop'; Import-Module ($PSHOME+'\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1'); $a=Get-Acl -LiteralPath $env:L1_MANIFEST_CHECK_PATH; $s=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; if(!$a.Access){exit 1}; foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $s){exit 1}}; exit 0";
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{stdio:'ignore',env:{...process.env,L1_MANIFEST_CHECK_PATH:file}});
 }
}
export function writer(root,file){
 const dir=resolve(root,'scripts/loadtest/manifests');mkdirSync(dir,{recursive:true,mode:0o700});
 check(realpathSync(dir)===dir&&dirname(resolve(file))===dir,'Use private manifests directory without links');
 if(process.platform==='win32'){const user=execFileSync('whoami',[],{encoding:'utf8'}).trim();execFileSync('icacls',[dir,'/inheritance:r','/grant:r',user+':(OI)(CI)F'],{stdio:'ignore'})}
 let written=false;
 return {persist(m){writeFileSync(file,JSON.stringify(m),{mode:0o600,flag:'wx'});written=true;privateFile(file)},rollback(){if(written)unlinkSync(file)}};
}
