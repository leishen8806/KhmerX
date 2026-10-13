# PayEase client artifact

This image serves files from `dist-separated/client`, proxies `/api/*` to the
API/gateway service, and sends page routes that are not static files back to
the API service supplied through `PAYEASE_API_UPSTREAM` for the current SSR
runtime.

Build after `npm run build:separated`:

```bash
docker build -f deploy/client/Dockerfile -t payease-client .
```

The image must not receive D1/R2 volumes, database credentials, Telegram tokens,
KYC encryption keys, or ClamAV credentials. Keep the public browser origin and
API path same-origin during the compatibility phase. This is an edge/static
asset container in the transition phase, not yet a fully static SPA; keep the
page-route fallback until the client-rendering spike produces an SPA entry.
