/** Stable API error identifiers. Clients must localize by code, not by error text. */
export type ApiErrorCode=string;
export function codeForError(message:string,status=400):ApiErrorCode{
 const m=message.toLowerCase();
 if(status===401||m.includes('登录已失效')||m.includes('请先登录')||m.includes('请先进入'))return 'AUTH_REQUIRED';
 if(status===403||m.includes('无权')||m.includes('没有权限')||m.includes('没有此公司的员工权限')||m.includes('不允许跨站'))return 'FORBIDDEN';
 if(status===404||m.includes('不存在')||m.includes('未找到'))return 'NOT_FOUND';
 if(status===409||m.includes('已变化')||m.includes('已锁定')||m.includes('重复'))return 'CONFLICT';
 if(status===413||m.includes('过大'))return 'PAYLOAD_TOO_LARGE';
 if(status===415||m.includes('请求格式'))return 'INVALID_REQUEST';
 if(status===429||m.includes('过于频繁'))return 'RATE_LIMITED';
 if(status>=500||m.includes('服务')||m.includes('数据库')||m.includes('配置'))return 'SERVICE_UNAVAILABLE';
 if(m.includes('手机号')||m.includes('电话号码'))return 'INVALID_PHONE';
 if(m.includes('验证码'))return 'INVALID_VERIFICATION_CODE';
 if(m.includes('文件')||m.includes('材料'))return 'INVALID_FILE';
 if(m.includes('kyc')||m.includes('资料'))return 'INVALID_KYC';
 if(m.includes('无效'))return 'INVALID_ARGUMENT';
 return 'REQUEST_FAILED';
}
export function addErrorCode<T>(data:T,status=400):T{
 if(!data||typeof data!=='object'||Array.isArray(data))return data;
 const value=data as Record<string,unknown>;
 if(!('error' in value)||typeof value.code==='string')return data;
 const message=typeof value.error==='string'?value.error:'Request failed';
 return {...value,code:codeForError(message,status)} as T;
}
