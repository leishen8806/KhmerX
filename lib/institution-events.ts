export const institutionEventTypes=['loan.approved','loan.rejected','funding.confirmed','repayment.confirmed','payment.failed'] as const;
export type InstitutionEventType=typeof institutionEventTypes[number];

export function normalizeInstitutionEvent(payload:Record<string,unknown>,institutionId:string){
 const eventType=typeof payload.eventType==='string'?payload.eventType.trim():'';
 if(!/^[a-z][a-z0-9_.-]{2,79}$/.test(eventType))throw new Error('事件类型无效');
 if(payload.institutionId!==undefined&&payload.institutionId!==institutionId)throw new Error('事件机构与签名机构不一致');
 const eventId=typeof payload.eventId==='string'?payload.eventId.trim():'';
 if(eventId&&!/^[A-Za-z0-9._:-]{3,120}$/.test(eventId))throw new Error('事件编号无效');
 const loanId=typeof payload.loanId==='string'?payload.loanId.trim():'';
 if(loanId&&!/^[A-Za-z0-9._:-]{3,120}$/.test(loanId))throw new Error('贷款编号无效');
 const occurredAt=typeof payload.occurredAt==='string'?payload.occurredAt.trim():'';
 if(occurredAt&&(Number.isNaN(Date.parse(occurredAt))||occurredAt.length>60))throw new Error('事件时间无效');
 return {eventType,eventId:eventId||null,loanId:loanId||null,institutionId,occurredAt:occurredAt||null,data:payload.data&&typeof payload.data==='object'&&!Array.isArray(payload.data)?payload.data:{}};
}
