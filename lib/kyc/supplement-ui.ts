import {fields,slots,type Profile} from './core.ts';
import {requestSection,type KycRequest} from './requests.ts';
const sectionSteps:Record<string,string>={identity:'personal',contacts:'contact1',employment:'employment',income:'income',assets:'assets',bank:'bank',consent:'consent'};
export function supplementStep(requests?:KycRequest[],checklist?:Record<string,boolean>){
 const target=requests?.[0]?.target;
 if(target?.startsWith('slot:')){const id=target.slice(5);if(['idFront','idBack','selfie'].includes(id))return id}
 if(target?.startsWith('field:')){const id=target.slice(6);if(['gender','education','marital'].includes(id))return 'identityDetails';if(['province','district','address'].includes(id))return 'address';for(const n of [1,2,3])if(id.startsWith('contact'+n))return 'contact'+n}
 const section=target?requestSection(target):Object.keys(checklist||{}).find(k=>checklist?.[k]);return sectionSteps[section||'']||'personal';
}
export function supplementChanged(target:string,current:Profile,baseline:Profile){
 const [kind,id]=target.split(':');
 if(kind==='field')return (current.values[id]||'')!==(baseline.values[id]||'');
 if(kind==='slot')return current.files[id as keyof Profile['files']]?.id!==baseline.files[id as keyof Profile['files']]?.id;
 if(kind!=='section')return false;
 return fields.some(f=>f.section===id&&(current.values[f.id]||'')!==(baseline.values[f.id]||''))||slots.some(s=>s.section===id&&current.files[s.id]?.id!==baseline.files[s.id]?.id)||(id==='consent'&&(current.consent!==baseline.consent||current.declarationVersion!==baseline.declarationVersion));
}
