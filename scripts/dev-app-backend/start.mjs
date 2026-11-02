// One command for local APP development:
//   node scripts/dev-app-backend/start.mjs
// 1. starts the built Miniflare worker (`wrangler dev --local`) in test mode with
//    simulated verification codes (this preserves POST request bodies, unlike the
//    vinext dev server)
// 2. waits until it answers and has applied migrations
// 3. seeds the public test workspace (idempotent)
// 4. starts the gateway stand-in on :80 so the Android emulator reaches it at
//    http://10.0.2.2  (the app's dev base URL)
// Test funds only. No Telegram message is ever sent (demo mode returns the code).
process.env.KHMERX_TEST_MODE = 'true';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { ROOT, MF_PORT, MF_ORIGIN } from './common.mjs';

const ping = (path = '/api/h5/auth') =>
  new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: MF_PORT, path, timeout: 4000 }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
  });

let child;
if (!(await ping())) {
  console.log(`starting Miniflare worker (wrangler dev --local) on :${MF_PORT}…`);
  child = spawn(
    process.platform === 'win32' ? 'node' : 'node',
    [
      '--import', './scripts/sites-env.mjs',
      './node_modules/wrangler/bin/wrangler.js',
      'dev', '--config', 'dist/server/wrangler.json', '--local',
      '--persist-to', '.wrangler/state', '--ip', '127.0.0.1',
      '--port', String(MF_PORT), '--inspector-port', '0',
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        KHMERX_TEST_MODE: 'true',
        PAYEASE_AUTH_MODE: process.env.PAYEASE_AUTH_MODE || 'demo',
        // The local harness must always have a signing key. Production and
        // preprod provide this through their secret store; this fallback is
        // intentionally test-only and never used by deployed workers.
        PAYEASE_AUTH_SECRET: process.env.PAYEASE_AUTH_SECRET || 'local-harness-auth-secret-change-me',
        KYC_DATA_SECRET: process.env.KYC_DATA_SECRET || 'local-harness-kyc-secret-change-me-32',
        KYC_REVIEWER_EMAILS: process.env.KYC_REVIEWER_EMAILS || 'b0-runner@example.test',
      },
    },
  );
  for (let i = 0; i < 90 && !(await ping()); i++) await new Promise((r) => setTimeout(r, 2000));
  if (!(await ping())) { console.error(`Miniflare worker did not come up on ${MF_ORIGIN}`); process.exit(1); }
}
console.log(`Miniflare worker ready at ${MF_ORIGIN}`);

await import('./seed.mjs');
await import('./proxy.mjs');
process.on('SIGINT', () => { child?.kill(); process.exit(0); });
