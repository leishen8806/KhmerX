'use client';
import {Button} from '@/components/ui/button';

function cell(value:any){
 const text=String(value??'').replace(/\r?\n/g,' ');
 // Prefix spreadsheet formula starters so exported customer-controlled text
 // is displayed as data instead of being evaluated by Excel/Sheets.
 const safe=/^[=+\-@]/.test(text)?`'${text}`:text;
 return `"${safe.replaceAll('"','""')}"`;
}
export function CsvExport({filename,columns,rows,label='导出当前结果 CSV'}:{filename:string;columns:string[];rows:any[];label?:string}){
 const download=()=>{const text='\ufeff'+[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url)};
 return <Button type="button" variant="outline" onClick={download}>{label}</Button>;
}
