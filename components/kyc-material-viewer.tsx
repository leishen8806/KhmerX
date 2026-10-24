'use client';

import {useState} from 'react';
import {slots,slotVisible, type Profile, type Slot} from '@/lib/kyc/core';
import {apiUrl} from '@/lib/api-client';
import {legacyText, useI18n, type Locale} from '@/lib/i18n';
import './kyc-material-viewer.css';

export function KycMaterialViewer({profile,locale:requestedLocale}:{profile:Profile;locale?:Locale}){
 const context=useI18n(),locale=requestedLocale||context.locale;
 const copy=locale==='km'?{title:'ឯកសារសម្រាប់ពិនិត្យ',empty:'មិនមានឯកសារ',zoomIn:'ពង្រីក',zoomOut:'បង្រួម',rotate:'បង្វិល',compare:'ប្រៀបធៀបអត្តសញ្ញាណប័ណ្ណ និងរូបថត',single:'មើលឯកសារតែមួយ',download:'ទាញយកឯកសារ',fallback:'បើមិនអាចបង្ហាញបាន សូមទាញយកឯកសារខាងក្រោម។'}:locale==='zh'?{title:'审核材料',empty:'暂无材料',zoomIn:'放大',zoomOut:'缩小',rotate:'旋转',compare:'证件正面与自拍并排对比',single:'查看单份材料',download:'下载材料',fallback:'如无法预览，请使用下方下载链接。'}:{title:'Review materials',empty:'No materials',zoomIn:'Zoom in',zoomOut:'Zoom out',rotate:'Rotate',compare:'Compare ID front and selfie',single:'View one material',download:'Download material',fallback:'If the preview is unavailable, use the download link below.'};
 const available=slots.filter(s=>s.id!=='signature'&&slotVisible(s.id,profile)&&profile.files[s.id]);
 const [selected,setSelected]=useState<Slot>('idFront');
 const [zoom,setZoom]=useState(1);
 const [rotation,setRotation]=useState(0);
 const [compare,setCompare]=useState(false);
 const [ratios,setRatios]=useState<Record<string,number>>({});
 const active=available.find(s=>s.id===selected)||available[0];
 const url=(id:string)=>apiUrl('/api/kyc/files?id='+encodeURIComponent(id)+'&review=1');
 const canCompare=Boolean(profile.files.idFront?.type.startsWith('image/')&&profile.files.selfie?.type.startsWith('image/'));
 const shown=compare&&canCompare?slots.filter(s=>s.id==='idFront'||s.id==='selfie'):active?[active]:[];
 function reset(){setZoom(1);setRotation(0)}
 return <section className="kyc-material-viewer" aria-label={copy.title}>
  <h2>{copy.title}</h2>
  {!active?<p>{copy.empty}</p>:<>
   <div className="kyc-material-thumbnails" role="group" aria-label={copy.title}>
    {available.map(slot=>{const file=profile.files[slot.id]!;const label=legacyText(slot.label,locale);return <button type="button" key={slot.id} aria-pressed={!compare&&active.id===slot.id} onClick={()=>{setSelected(slot.id);setCompare(false);reset()}}>
     {file.type.startsWith('image/')?<img src={url(file.id)} alt=""/>:<span aria-hidden="true">PDF</span>}<span>{label}</span>
    </button>})}
   </div>
   <div className="kyc-material-toolbar" role="group" aria-label={copy.title}>
    <button type="button" disabled={zoom>=3||shown.every(s=>profile.files[s.id]?.type==='application/pdf')} onClick={()=>setZoom(v=>Math.min(3,v+.25))}>{copy.zoomIn}</button>
    <button type="button" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.25))}>{copy.zoomOut}</button>
    <button type="button" disabled={shown.every(s=>profile.files[s.id]?.type==='application/pdf')} onClick={()=>setRotation(v=>(v+90)%360)}>{copy.rotate}</button>
    {canCompare&&<button type="button" aria-pressed={compare} onClick={()=>{setCompare(v=>!v);reset()}}>{compare?copy.single:copy.compare}</button>}
   </div>
   <div className={'kyc-material-previews'+(compare&&canCompare?' kyc-material-compare':'')}>
    {shown.map(slot=>{const file=profile.files[slot.id]!;const label=legacyText(slot.label,locale);return <figure key={slot.id}>
     <figcaption>{label}</figcaption>
     {file.type==='application/pdf'?<object data={url(file.id)} type="application/pdf" aria-label={label}><p>{copy.fallback}</p></object>:<div className="kyc-material-image"><div className="kyc-material-stage" style={{width:`${zoom*100}%`,aspectRatio:rotation%180?1/(ratios[file.id]||1):(ratios[file.id]||1)}}><img src={url(file.id)} alt={label} onLoad={e=>{const image=e.currentTarget;if(image.naturalWidth&&image.naturalHeight)setRatios(v=>({...v,[file.id]:image.naturalWidth/image.naturalHeight}))}} style={{width:rotation%180?`${(ratios[file.id]||1)*100}%`:'100%',transform:`rotate(${rotation}deg)`+({90:' translateY(-100%)',180:' translate(-100%, -100%)',270:' translateX(-100%)'}[rotation]||'')}}/></div></div>}
     <a href={url(file.id)} download>{copy.download} · {label}</a>
    </figure>})}
   </div>
  </>}
 </section>;
}
