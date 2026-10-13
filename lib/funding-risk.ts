export type FundingRiskLevel='normal'|'attention'|'warning'|'frozen';

export type FundingRiskSnapshot={
  availableCents:number;
  poolCents:number;
  warningPercent:number;
  blocked?:boolean;
};

/** Classifies a snapshot for display and server-side policy decisions. */
export function fundingRiskLevel(snapshot:FundingRiskSnapshot):FundingRiskLevel{
  if(!Number.isSafeInteger(snapshot.availableCents)||!Number.isSafeInteger(snapshot.poolCents)||snapshot.poolCents<=0)return 'frozen';
  if(snapshot.blocked||snapshot.availableCents<=0)return 'frozen';
  const ratio=snapshot.availableCents/snapshot.poolCents*100;
  if(ratio<=snapshot.warningPercent)return 'warning';
  if(ratio<=30)return 'attention';
  return 'normal';
}

export function fundingRiskEventType(level:FundingRiskLevel){
  return level==='frozen'?'funding_regulatory_freeze':level==='warning'?'funding_regulatory_warning':level==='attention'?'funding_regulatory_attention':null;
}
