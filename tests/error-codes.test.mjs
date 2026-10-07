import test from 'node:test';
import assert from 'node:assert/strict';
import {codeForError, addErrorCode} from '../lib/error-codes.ts';
import {AuthError} from '../lib/h5-auth-core.ts';
import {KycError} from '../lib/kyc/core.ts';

test('API errors expose stable machine-readable categories',()=>{
 assert.equal(codeForError('客户登录已失效，请重新验证手机号',401),'AUTH_REQUIRED');
 assert.equal(codeForError('不允许跨站操作',403),'FORBIDDEN');
 assert.equal(codeForError('文件类型不支持'),'INVALID_FILE');
 assert.equal(codeForError('请求过大',413),'PAYLOAD_TOO_LARGE');
 assert.equal(new AuthError('验证码无效').code,'INVALID_VERIFICATION_CODE');
 assert.equal(new KycError('资料不完整').code,'INVALID_KYC');
});

test('json payload keeps legacy error and adds code without overwriting explicit codes',()=>{
 assert.deepEqual(addErrorCode({error:'请求格式无效'},415),{error:'请求格式无效',code:'INVALID_REQUEST'});
 assert.deepEqual(addErrorCode({error:'自定义失败',code:'CUSTOM_CODE'}),{error:'自定义失败',code:'CUSTOM_CODE'});
 assert.deepEqual(addErrorCode({ok:true}),{ok:true});
});
