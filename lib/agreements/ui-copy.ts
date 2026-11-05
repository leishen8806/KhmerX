export type AgreementLocale = 'zh' | 'en' | 'km';

const copy: Record<string, Record<AgreementLocale, string>> = {
  '返回 KYC': {zh: '返回 KYC', en: 'Back to KYC', km: 'ត្រឡប់ទៅ KYC'},
  '来源：': {zh: '来源：', en: 'Source: ', km: 'ប្រភព៖ '},
  '协议版本：': {zh: '协议版本：', en: 'Agreement version: ', km: 'កំណែកិច្ចព្រមព្រៀង៖ '},
  '{title}页面内容仅用于流程查看。': {
    zh: '{title}页面内容仅用于流程查看。',
    en: '{title} is provided for process viewing only.',
    km: '{title} ផ្តល់ជូនសម្រាប់មើលលំហូរប៉ុណ្ណោះ។',
  },
  '借款协议': {zh: '借款协议', en: 'Loan agreement', km: 'កិច្ចព្រមព្រៀងកម្ចី'},
  '借款合同': {zh: '借款合同', en: 'Loan contract', km: 'កិច្ចសន្យាកម្ចី'},
};

export function agreementText(text: string, locale: AgreementLocale): string {
  return copy[text]?.[locale] ?? text;
}

export function agreementFormat(text: string, locale: AgreementLocale, values: Record<string, string>): string {
  return agreementText(text, locale).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}
