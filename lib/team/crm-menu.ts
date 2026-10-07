export const crmQueueSections = ['customers','reports','notifications','tickets','kyc','loans','funding','repayment','postloan'] as const;
export type CrmQueueSection=(typeof crmQueueSections)[number];

export const crmQueueLabels:Record<CrmQueueSection,string>={
 customers:'客户中心',reports:'数据报表',notifications:'通知管理',tickets:'客服工单',kyc:'KYC审核',loans:'贷款申请',funding:'放款管理',repayment:'还款管理',postloan:'贷后催收'
};

export function isCrmQueueSection(value:unknown):value is CrmQueueSection{return typeof value==='string'&&crmQueueSections.includes(value as CrmQueueSection)}
