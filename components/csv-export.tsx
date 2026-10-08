'use client';
import {Button} from '@/components/ui/button';

function cell(value:any){return `"${String(value??'').replaceAll('"','""').replaceAll('\n',' ')}"`}
export function CsvExport({filename,columns,rows}:{filename:string;columns:string[];rows:any[]}){
 const download=()=>{const text='\ufeff'+[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url)};
 return <Button type="button" variant="outline" onClick={download}>导出当前结果 CSV</Button>;
}
