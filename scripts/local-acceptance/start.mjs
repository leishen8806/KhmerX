import { cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = process.env.LOCAL_ACCEPTANCE_ROOT || '/private/tmp/khmerx-local-acceptance';
const app = join(root, 'app');
const data = join(root, 'data');
const port = Number(process.env.LOCAL_ACCEPTANCE_PORT || 4300);
const companyId = 't_00000000-0000-4000-8000-000000000001';
const secret = () => randomBytes(32).toString('hex');
const password = `local-${randomBytes(18).toString('base64url')}`;
const telegramToken = `123456:${randomBytes(24).toString('base64url')}`;
const institutionSecret = secret();

if (!existsSync(join(repo, 'dist-separated', 'api', 'server'))) {
  const result = spawnSync('npm', ['run', 'build:separated'], { cwd: repo, stdio: 'inherit', env: { ...process.env, TMPDIR: '/private/tmp' } });
  if (result.status !== 0) throw new Error('build:separated failed');
}
await mkdir(join(app, 'dist'), { recursive: true });
await mkdir(data, { recursive: true });
await cp(join(repo, 'dist-separated', 'api', 'server'), join(app, 'dist', 'server'), { recursive: true });
await cp(join(repo, 'dist-separated', 'api', 'deploy'), join(app, 'deploy'), { recursive: true });
await cp(join(repo, 'dist-separated', 'api', 'drizzle'), join(app, 'drizzle'), { recursive: true });
await cp(join(repo, 'dist-separated', 'client'), join(app, 'dist', 'client'), { recursive: true });
const cfg = {
  host: '127.0.0.1',
  publicClientHosts: ['127.0.0.1', 'localhost'],
  adminHosts: ['admin.localhost'],
  apiHosts: ['api.localhost'],
  accessUser: `local-${randomUUID()}`,
  accessPassword: password,
  sessionSecret: secret(),
  customerCompanyId: companyId,
  companies: [{ id: companyId, name: 'KhmerX Gray', slug: 'khmerx-gray', accounts: [{ role: 'admin', email: 'gray-admin@example.test', hash: 'replace-with-seed-admin-hash' }] }],
  bindings: {
    PAYEASE_ENV: 'gray', KHMERX_TEST_MODE: 'false', PAYEASE_IDENTITY_PROOF_REQUIRED: 'true',
    PAYEASE_AUTH_SECRET: secret(), PAYEASE_IDENTITY_PROOF_SECRET: secret(), KYC_SCAN_TOKEN: secret(),
    POSTLOAN_JOB_SECRET: secret(), PAYEASE_LIMIT_SCALE: '1', PAYEASE_GATEWAY_RATE_SCALE: '1',
    PAYEASE_AUTH_MODE: 'telegram', PAYEASE_H5_AUTH_MODE: 'demo', PAYEASE_DEMO_OTP_ALLOWED: 'true',
    PAYEASE_TELEGRAM_AUTH_MODE: 'telegram', TELEGRAM_GATEWAY_TOKEN: telegramToken,
    TELEGRAM_BOT_TOKEN_1: telegramToken, TELEGRAM_BOT_TOKEN_2: '', KYC_DATA_SECRET: secret(),
    INSTITUTION_CALLBACK_SECRETS_JSON: JSON.stringify({ [companyId + ':institution']: institutionSecret }),
    KYC_SCAN_URL: 'http://127.0.0.1:9999/scan', CUSTOMER_ROWS: 'off',
  },
};
await writeFile(join(data, 'config.json'), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
await writeFile(join(data, 'local-acceptance-secrets.json'), JSON.stringify({ accessUser: cfg.accessUser, accessPassword: cfg.accessPassword, telegramToken, institutionSecret }, null, 2) + '\n', { mode: 0o600 });
const child = spawn(process.execPath, [join(repo, 'deploy/standalone/server.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PAYEASE_STANDALONE_ROOT: root, PAYEASE_STANDALONE_PORT: String(port), SCANNER_TOKEN_PATH: join(data, 'scanner-token') },
});
const stop = () => { if (!child.killed) child.kill('SIGTERM'); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
child.once('exit', code => process.exit(code ?? 1));
console.log(JSON.stringify({ event: 'local_acceptance_started', root, url: `http://127.0.0.1:${port}`, companyId, secrets: join(data, 'local-acceptance-secrets.json') }));
