import type {Locale} from './i18n';

export const errorCodes = [
 'ACCOUNT_ALREADY_REGISTERED','AUTH_DEMO_FORBIDDEN','AUTH_REQUIRED','BOT_ACCESS_FORBIDDEN','BOT_CONFIG_INVALID','BOT_NOT_CONFIGURED','BOT_VERIFICATION_FAILED','CHANNEL_COMPANY_MISMATCH','CHANNEL_DISABLED','CHANNEL_MAINTENANCE','REGISTRATION_STEP_DISABLED',
 'BROWSER_SESSION_MISMATCH','BROWSER_TOKEN_RATE_LIMITED','CALLBACK_HEADERS_INVALID','CALLBACK_NOT_CONFIGURED','CALLBACK_REPLAYED','CALLBACK_SIGNATURE_INVALID',
 'COMPANY_ACCESS_FORBIDDEN','COMPANY_NOT_FOUND','CONFLICT','CROSS_SITE_REQUEST','CUSTOMER_SETTLEMENT_FORBIDDEN','EMERGENCY_TARGET_MISMATCH','EMERGENCY_TARGET_REQUIRED',
 'EVENT_ENVELOPE_INVALID','EVENT_PAYLOAD_MISMATCH','FORBIDDEN','FUNDING_DUAL_CONTROL_REQUIRED','FUNDING_LIMIT_EXCEEDED','FUNDING_RISK_ACTION_INVALID','FUNDING_RISK_FORBIDDEN',
 'FUNDING_RISK_NOT_FOUND','FUNDING_RISK_REASON_REQUIRED','FUNDING_RISK_STATE_CONFLICT','FUNDING_SETTINGS_CONFLICT','FUNDING_SETTINGS_FORBIDDEN','FUNDING_SETTINGS_INVALID',
 'GEOCODE_RATE_LIMITED','IDEMPOTENCY_KEY_INVALID','IDEMPOTENCY_PAYLOAD_MISMATCH','INSTITUTION_NOT_FOUND','INTERNAL_ERROR','INVALID_ARGUMENT','INVALID_FILE','INVALID_KYC',
 'INVALID_PHONE','INVALID_REQUEST','INVALID_VERIFICATION_CODE','VERIFICATION_EXPIRED','VERIFICATION_RATE_LIMITED','INVITE_COMPANY_INVALID','INVITE_PORTAL_MISMATCH','INVITE_STATE_CHANGED','INVITE_TOKEN_INVALID','INVITE_TOKEN_REQUIRED',
 'JOB_UNAUTHORIZED','KYC_DOC_VALIDITY','KYC_REVISION_CONFLICT','KYC_SCAN_REQUIRED','MFA_ATTEMPTS_EXCEEDED','MFA_REQUIRED_FOR_INVITE','MFA_REQUIRED_FOR_SSO','MFA_STEP_UP_REQUIRED',
 'MISSING_ORIGIN','NOT_FOUND','NOTIFICATION_AMOUNT_FORBIDDEN','NOTIFICATION_TEMPLATE_FORBIDDEN','PASSWORD_ADMIN_ISSUE_FORBIDDEN','PASSWORD_ADMIN_RESET_FORBIDDEN',
 'PAYLOAD_TOO_LARGE','PAYMENT_RECEIPT_AMOUNT_MISMATCH','PAYMENT_RECEIPT_UNVERIFIED','PLATFORM_BOOTSTRAP_EXPIRED','POSTLOAN_JOB_FAILED','RATE_LIMITED','REPAYMENT_AMOUNT_INVALID',
 'REPAYMENT_LEDGER_NOT_RECORDED','REPAYMENT_RECEIPT_NOT_RECORDED','REQUEST_FAILED','RISK_KYC_DOC_REVIEW','RISK_RULE_INVALID_ACTION','RISK_RULE_INVALID_CONDITION','RISK_RULE_INVALID_INPUT',
 'RISK_RULE_NOT_FOUND','RISK_RULE_NOT_MATCHED','RISK_RULE_SELF_APPROVAL','RISK_RULE_STATE_CONFLICT','RISK_RULE_VERSION_CONFLICT','RISK_RULES_FORBIDDEN','SERVICE_UNAVAILABLE',
 'STAFF_DUAL_CONTROL_REQUIRED','STATE_MUTATION_FAILED','TELEGRAM_INITDATA_EXPIRED','TELEGRAM_INITDATA_INVALID','TELEGRAM_INITDATA_REPLAY','TELEGRAM_SUBSCRIPTION_REPLAY','TICKET_READ_ONLY',
 'VALIDATION_FAILED','VERIFICATION_UNAVAILABLE','WORKSPACE_PAYLOAD_LIMIT','ZERO_RESULTS',
] as const;

type ErrorCode = typeof errorCodes[number];
const locales: Locale[] = ['en','km','zh'];
const copy: Record<Locale, Record<string,string>> = {
 en: {
  REQUEST_FAILED:'The request could not be completed. Please try again.', AUTH_REQUIRED:'Your session has expired. Sign in again.', FORBIDDEN:'You do not have permission to do this.',
  NOT_FOUND:'The requested information is unavailable.', CONFLICT:'This information changed. Refresh and try again.', PAYLOAD_TOO_LARGE:'The selected file or request is too large.',
  INVALID_REQUEST:'The request format is invalid.', RATE_LIMITED:'Too many attempts. Please try again later.', INVALID_PHONE:'Enter a valid phone number.',
  INVALID_VERIFICATION_CODE:'The verification code is invalid or expired.', INVALID_FILE:'This file is invalid or cannot be accepted.', INVALID_KYC:'Check the required information and try again.',
  INVALID_ARGUMENT:'Check the information and try again.', SERVICE_UNAVAILABLE:'The service is temporarily unavailable.', INTERNAL_ERROR:'Something went wrong. Contact support with the request ID.',
  VALIDATION_FAILED:'Check the highlighted information and try again.', ACCOUNT_ALREADY_REGISTERED:'This phone number is already registered. Sign in with a verification code or password.',
  CROSS_SITE_REQUEST:'This request could not be verified. Refresh and try again.', MISSING_ORIGIN:'This request could not be verified. Refresh and try again.', TELEGRAM_INITDATA_EXPIRED:'Your Telegram login has expired. Reopen the Mini App from the bot.', TELEGRAM_INITDATA_INVALID:'Telegram login data is invalid. Reopen the Mini App from the bot.',
  BROWSER_TOKEN_RATE_LIMITED:'Too many attempts. Please wait and try again.', GEOCODE_RATE_LIMITED:'Address lookup is temporarily limited. Try again later.', CHANNEL_COMPANY_MISMATCH:'This Mini App belongs to a different company. Reopen the correct company link.', CHANNEL_DISABLED:'This channel is currently disabled.', CHANNEL_MAINTENANCE:'This channel is temporarily under maintenance.', REGISTRATION_STEP_DISABLED:'This registration step is currently disabled.', VERIFICATION_EXPIRED:'This verification code has expired. Request a new code.', VERIFICATION_RATE_LIMITED:'Too many verification requests. Please wait before trying again.',
 },
 km: {
  REQUEST_FAILED:'សំណើមិនអាចបញ្ចប់បានទេ។ សូមព្យាយាមម្ដងទៀត។', AUTH_REQUIRED:'សម័យចូលប្រើរបស់អ្នកបានផុតកំណត់។ សូមចូលម្ដងទៀត។', FORBIDDEN:'អ្នកមិនមានសិទ្ធិធ្វើសកម្មភាពនេះទេ។',
  NOT_FOUND:'ព័ត៌មានដែលស្នើសុំមិនមានទេ។', CONFLICT:'ព័ត៌មាននេះបានផ្លាស់ប្តូរ។ សូមធ្វើបច្ចុប្បន្នភាព ហើយព្យាយាមម្ដងទៀត។', PAYLOAD_TOO_LARGE:'ឯកសារ ឬសំណើនេះធំពេក។',
  INVALID_REQUEST:'ទម្រង់សំណើមិនត្រឹមត្រូវទេ។', RATE_LIMITED:'មានការព្យាយាមច្រើនពេក។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។', INVALID_PHONE:'សូមបញ្ចូលលេខទូរស័ព្ទត្រឹមត្រូវ។',
  INVALID_VERIFICATION_CODE:'លេខកូដផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវ ឬផុតកំណត់។', INVALID_FILE:'ឯកសារនេះមិនត្រឹមត្រូវ ឬមិនអាចទទួលយកបានទេ។', INVALID_KYC:'សូមពិនិត្យព័ត៌មានដែលត្រូវបំពេញ ហើយព្យាយាមម្ដងទៀត។',
  INVALID_ARGUMENT:'សូមពិនិត្យព័ត៌មាន ហើយព្យាយាមម្ដងទៀត។', SERVICE_UNAVAILABLE:'សេវាកម្មមិនអាចប្រើបានបណ្តោះអាសន្ន។', INTERNAL_ERROR:'មានបញ្ហាមួយកើតឡើង។ សូមទាក់ទងជំនួយដោយផ្តល់លេខសំណើ។',
  VALIDATION_FAILED:'សូមពិនិត្យព័ត៌មាន ហើយព្យាយាមម្ដងទៀត។', ACCOUNT_ALREADY_REGISTERED:'លេខទូរស័ព្ទនេះបានចុះឈ្មោះរួចហើយ។ សូមចូលដោយលេខកូដផ្ទៀងផ្ទាត់ ឬពាក្យសម្ងាត់។',
  CROSS_SITE_REQUEST:'មិនអាចផ្ទៀងផ្ទាត់សំណើនេះបានទេ។ សូមផ្ទុកឡើងវិញ ហើយព្យាយាមម្ដងទៀត។', MISSING_ORIGIN:'មិនអាចផ្ទៀងផ្ទាត់សំណើនេះបានទេ។ សូមផ្ទុកឡើងវិញ ហើយព្យាយាមម្ដងទៀត។', TELEGRAM_INITDATA_EXPIRED:'ការចូល Telegram បានផុតកំណត់។ សូមបើក Mini App ពី Bot ម្តងទៀត។', TELEGRAM_INITDATA_INVALID:'ទិន្នន័យចូល Telegram មិនត្រឹមត្រូវ។ សូមបើក Mini App ពី Bot ម្តងទៀត។',
  BROWSER_TOKEN_RATE_LIMITED:'មានការព្យាយាមច្រើនពេក។ សូមរង់ចាំ ហើយព្យាយាមម្ដងទៀត។', GEOCODE_RATE_LIMITED:'ការស្វែងរកអាសយដ្ឋានត្រូវបានកំណត់បណ្តោះអាសន្ន។ សូមព្យាយាមពេលក្រោយ។', CHANNEL_COMPANY_MISMATCH:'Mini App នេះជារបស់ក្រុមហ៊ុនផ្សេង។ សូមបើកតំណរបស់ក្រុមហ៊ុនត្រឹមត្រូវ។', CHANNEL_DISABLED:'បណ្តាញនេះត្រូវបានបិទជាបណ្តោះអាសន្ន។', CHANNEL_MAINTENANCE:'បណ្តាញនេះកំពុងថែទាំជាបណ្តោះអាសន្ន។', REGISTRATION_STEP_DISABLED:'ជំហានចុះឈ្មោះនេះត្រូវបានបិទជាបណ្តោះអាសន្ន។', VERIFICATION_EXPIRED:'លេខកូដផ្ទៀងផ្ទាត់នេះបានផុតកំណត់។ សូមស្នើលេខកូដថ្មី។', VERIFICATION_RATE_LIMITED:'ការស្នើលេខកូដមានច្រើនពេក។ សូមរង់ចាំមុនព្យាយាមម្ដងទៀត។',
 },
 zh: {
  REQUEST_FAILED:'请求未完成，请重试。', AUTH_REQUIRED:'登录状态已失效，请重新登录。', FORBIDDEN:'你没有权限执行此操作。',
  NOT_FOUND:'请求的信息不存在或无法访问。', CONFLICT:'信息已发生变化，请刷新后重试。', PAYLOAD_TOO_LARGE:'文件或请求内容过大。',
  INVALID_REQUEST:'请求格式无效。', RATE_LIMITED:'操作过于频繁，请稍后重试。', INVALID_PHONE:'请输入有效的手机号。',
  INVALID_VERIFICATION_CODE:'验证码无效或已过期。', INVALID_FILE:'文件无效或无法通过检查。', INVALID_KYC:'请检查必填资料后重试。',
  INVALID_ARGUMENT:'请检查输入内容后重试。', SERVICE_UNAVAILABLE:'服务暂时不可用，请稍后重试。', INTERNAL_ERROR:'系统发生错误，请联系客服并提供请求编号。',
  VALIDATION_FAILED:'请检查填写内容后重试。', ACCOUNT_ALREADY_REGISTERED:'该手机号已注册，请使用验证码或密码登录。',
  CROSS_SITE_REQUEST:'请求无法通过验证，请刷新后重试。', MISSING_ORIGIN:'请求无法通过验证，请刷新后重试。', TELEGRAM_INITDATA_EXPIRED:'Telegram 登录已过期，请重新从机器人打开 Mini App。', TELEGRAM_INITDATA_INVALID:'Telegram 登录凭证无效，请重新从机器人打开 Mini App。',
  BROWSER_TOKEN_RATE_LIMITED:'操作过于频繁，请稍后重试。', GEOCODE_RATE_LIMITED:'地址查询暂时受限，请稍后重试。', CHANNEL_COMPANY_MISMATCH:'此 Mini App 属于其他公司，请重新打开正确的公司链接。', CHANNEL_DISABLED:'当前渠道已停用。', CHANNEL_MAINTENANCE:'当前渠道正在维护，请稍后再试。', REGISTRATION_STEP_DISABLED:'当前注册步骤已停用。', VERIFICATION_EXPIRED:'验证码已过期，请重新获取。', VERIFICATION_RATE_LIMITED:'验证码请求过于频繁，请稍后再试。',
 },
};

const generic: Record<Locale, {forbidden:string;conflict:string;limited:string;missing:string;invalid:string;unavailable:string}> = {
 en:{forbidden:'You do not have permission to do this.',conflict:'This information changed. Refresh and try again.',limited:'Too many attempts. Please try again later.',missing:'The requested information is unavailable.',invalid:'Check the information and try again.',unavailable:'The service is temporarily unavailable.'},
 km:{forbidden:'អ្នកមិនមានសិទ្ធិធ្វើសកម្មភាពនេះទេ។',conflict:'ព័ត៌មាននេះបានផ្លាស់ប្តូរ។ សូមផ្ទុកឡើងវិញ ហើយព្យាយាមម្ដងទៀត។',limited:'មានការព្យាយាមច្រើនពេក។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។',missing:'ព័ត៌មានដែលស្នើសុំមិនមានទេ។',invalid:'សូមពិនិត្យព័ត៌មាន ហើយព្យាយាមម្ដងទៀត។',unavailable:'សេវាកម្មមិនអាចប្រើបានបណ្តោះអាសន្ន។'},
 zh:{forbidden:'你没有权限执行此操作。',conflict:'信息已发生变化，请刷新后重试。',limited:'操作过于频繁，请稍后重试。',missing:'请求的信息不存在或无法访问。',invalid:'请检查输入内容后重试。',unavailable:'服务暂时不可用，请稍后重试。'},
};

function generatedMessage(code: string, locale: Locale): string {
 const words = generic[locale];
 if (code.includes('FORBIDDEN') || code.includes('UNAUTHORIZED')) return words.forbidden;
 if (code.includes('CONFLICT') || code.includes('REPLAY') || code.includes('MISMATCH') || code.includes('STATE_CHANGED')) return words.conflict;
 if (code.includes('RATE_LIMITED') || code.includes('EXCEEDED')) return words.limited;
 if (code.includes('NOT_FOUND')) return words.missing;
 if (code.includes('UNAVAILABLE') || code.includes('NOT_CONFIGURED') || code.endsWith('_FAILED')) return words.unavailable;
 return words.invalid;
}

export const errorMessages = Object.fromEntries(locales.map(locale => [locale,
 Object.fromEntries(errorCodes.map(code => [code, copy[locale][code] || generatedMessage(code, locale)])),
])) as Record<Locale, Record<ErrorCode,string>>;

type ErrorShape = {code?:unknown;error?:unknown;message?:unknown;requestId?:unknown;params?:unknown};
export function messageForError(error: unknown, locale: Locale): string {
 const value = error && typeof error === 'object' ? error as ErrorShape : {};
 const code = typeof value.code === 'string' ? value.code : '';
 if (!code) return error instanceof Error ? error.message : errorMessages[locale].REQUEST_FAILED;
 const message = errorMessages[locale][code as ErrorCode] || errorMessages[locale].REQUEST_FAILED;
 const params = value.params && typeof value.params === 'object' ? value.params as Record<string,unknown> : {};
 const retryAfter = Number(params.retryAfterSeconds);
 const withRetry = code === 'RATE_LIMITED' && Number.isFinite(retryAfter) && retryAfter > 0
  ? `${message} ${locale === 'zh' ? `请在 ${retryAfter} 秒后重试。` : locale === 'km' ? `សូមព្យាយាមម្ដងទៀតក្រោយ ${retryAfter} វិនាទី។` : `Try again in ${retryAfter} seconds.`}`
  : message;
 const requestId = typeof value.requestId === 'string' ? value.requestId : '';
 return requestId && ['SERVICE_UNAVAILABLE','INTERNAL_ERROR'].includes(code)
  ? `${withRetry} (${locale === 'zh' ? '请求编号' : locale === 'km' ? 'លេខសំណើ' : 'Request ID'}: ${requestId})`
  : withRetry;
}

export function currentErrorLocale(): Locale {
 if (typeof document === 'undefined') return 'en';
 const root = document.querySelector<HTMLElement>('.mini-app[lang], .mini-login[lang], .admin-locale-root[lang]');
 const value = root?.lang || (typeof window !== 'undefined' && window.location.pathname.startsWith('/team') ? 'zh' : document.documentElement.lang);
 return value === 'km' || value === 'zh' || value === 'en' ? value : 'en';
}
