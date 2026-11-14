// Local stand-in for the production gateway (deploy/standalone/server.mjs) for the
// APP. The Android app is a browser-compatible client (Cookie + Origin, no company ID).
// The upstream is the built Miniflare worker (`wrangler dev --local`, see start.mjs),
// reached on 127.0.0.1:<MF_PORT>. The gateway's job of choosing the public company and
// supplying the identity headers for test mode is done here. Listens where the emulator
// can reach it: http://10.0.2.2:<port>  (default 80).
//
// Test-mode identity (KHMERX_TEST_MODE=true): getChatGPTUser() only needs the
// oai-authenticated-user-{id,email} headers — the HMAC identity proof branch is skipped.
// The client side of this proxy is never trusted for those headers.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { MF_PORT, MF_ORIGIN, PROXY_PORT, PUBLIC_COMPANY_ID } from './common.mjs';

http
  .createServer(async (req, res) => {
    const headers = { ...req.headers };
    // Never trust identity/cookie headers from the client side of this proxy.
    for (const h of Object.keys(headers))
      if (h.startsWith('oai-') || h === 'x-payease-identity-proof' || h === 'x-payease-identity-proof-ts')
        delete headers[h];

    // Server-side cookie: the gateway adds the configured public company when the
    // client sends none (docs 54: the APP itself never sends a company).
    let cookie = req.headers.cookie || '';
    if (!/(?:^|;\s*)payease_company=/.test(cookie)) cookie += (cookie ? '; ' : '') + 'payease_company=' + PUBLIC_COMPANY_ID;
    headers.cookie = cookie;

    // Test-mode synthetic identity (mirrors deploy/standalone/server.mjs).
    const localDemoIdentity = process.env.KHMERX_TEST_MODE === 'true' && process.env.DEV_TEAM_LOCALHOST === 'true';
    const id = localDemoIdentity && process.env.DEV_TEAM_USER_ID ? process.env.DEV_TEAM_USER_ID : ('visitor:' + randomUUID());
    headers['oai-authenticated-user-id'] = id;
    headers['oai-authenticated-user-email'] = localDemoIdentity && process.env.DEV_TEAM_USER_EMAIL ? process.env.DEV_TEAM_USER_EMAIL : (id + '@visitor.invalid');

    // sameOrigin() checks Origin === new URL(request.url).origin, and the worker
    // derives request.url from the connection host. Rewrite both so they match the
    // Miniflare origin regardless of how the app addresses the emulator (10.0.2.2).
    headers.host = new URL(MF_ORIGIN).host;
    headers.origin = MF_ORIGIN;

    // Read the body up front and forward it explicitly. This avoids relying on
    // piped-stream framing (chunked/content-length quirks) and guarantees the body
    // reaches the worker for POST /api/h5/auth/send|verify|account|...
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (body.length) {
      headers['content-length'] = String(body.length);
      delete headers['transfer-encoding'];
    } else {
      delete headers['content-length'];
    }

    const upstream = http.request(
      { host: '127.0.0.1', port: MF_PORT, method: req.method, path: req.url, headers },
      (r) => {
        res.writeHead(r.statusCode || 502, r.headers);
        r.pipe(res);
      },
    );
    upstream.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Miniflare worker unreachable: ' + e.message, code: 'SERVICE_UNAVAILABLE' }));
    });
    upstream.end(body);
  })
  .listen(PROXY_PORT, process.env.DEV_PROXY_HOST || '0.0.0.0', () => {
    console.log(`APP dev backend on :${PROXY_PORT} -> Miniflare ${MF_ORIGIN} (workspace ${PUBLIC_COMPANY_ID})`);
  });
