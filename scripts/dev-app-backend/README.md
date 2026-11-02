# Local backend for the Android APP (dev only)

Lets the APP run against a local backend with **test funds and simulated verification codes**. It does not touch production, never sends a Telegram message, and does not modify any business code.

## Why this exists
The APP is a browser-compatible client (Cookie session + Origin, no Bearer). The production gateway adds a visitor identity and the public workspace; the plain dev server does not, so the APP got `401 AUTH_REQUIRED` and an empty database. `proxy.mjs` plays the gateway's role and `seed.mjs` creates the public test workspace.

## Backend: built Miniflare worker (not the vinext dev server)
The APP backend is the **built worker** (`dist/server`) run through `wrangler dev --local`. This is required: the vinext dev server consumed the POST request body before it reached the `/api/h5/auth` route, so `POST /api/h5/auth/send|verify|account|recovery|logout` all returned `400 INVALID_REQUEST` (GET worked). `wrangler dev --local` uses `mf.dispatchFetch`, which preserves the body, matching production (`deploy/standalone/server.mjs`).

Run `npm run build` (vinext build) first if the worker source changed, so `dist/server` reflects the latest backend code.

For a local `/team` demo, the harness seeds a fictional admin identity. Start it
with the test-only identity override below; this changes only headers emitted by
the localhost proxy and is ignored by the production gateway:
```sh
DEV_TEAM_USER_ID=b0-runner@example.test \
DEV_TEAM_USER_EMAIL=b0-runner@example.test \
DEV_TEAM_LOCALHOST=true \
APP_BACKEND_PORT=8092 APP_MF_PORT=8794 \
node scripts/dev-app-backend/start.mjs
```
Open `http://127.0.0.1:8092/team`. The seeded company is `khmerx-test`; no
production account, password, or Telegram message is used.

## Use (Windows PowerShell — run each line separately; PowerShell 5.1 has no `&&`)
All commands start from the repository root `E:\KhmerX\KhmerX` (not `E:\KhmerX`).

Terminal 1 — backend (keep it open; port 80 must be free):
```powershell
cd E:\KhmerX\KhmerX
node scripts/dev-app-backend/start.mjs
```
Terminal 2 — the APP on the emulator (its dev base URL is `http://10.0.2.2`):
```powershell
cd E:\KhmerX\KhmerX\mobile
flutter run
```
Register with a fictional number `+12025550100` … `+12025550199`; in demo mode the verification code is `123456` (the server returns it; no message is sent).

To get a loan (with contract data) for the read-only screens, **after registering in the app**, in a third terminal:
```powershell
cd E:\KhmerX\KhmerX
node scripts/dev-app-backend/seed-loan.mjs
```
Pull down to refresh in the app.

## KYC testing helpers (dev only)
```powershell
cd E:\KhmerX\KhmerX
node scripts/dev-app-backend/kyc-smoke.mjs            # full KYC flow against the real backend (fictional customer)
node scripts/dev-app-backend/kyc-review.mjs status    # print the latest case status
node scripts/dev-app-backend/kyc-review.mjs needs_info "Photo is blurry"   # act as the reviewer
node scripts/dev-app-backend/kyc-review.mjs approved
```
Pull down to refresh Home in the app after changing the status.

## Environment
| Variable | Default | Meaning |
|---|---|---|
| `APP_BACKEND_PORT` | `80` | Port the emulator reaches at `10.0.2.2` (the APP's dev base URL has no port, so keep 80) |
| `APP_MF_PORT` | `8788` | Where `wrangler dev --local` (the Miniflare worker) listens |
| `DEV_TEAM_USER_ID` | random visitor | Used only with `DEV_TEAM_LOCALHOST=true` by the test-only localhost proxy |
| `DEV_TEAM_USER_EMAIL` | `<id>@visitor.invalid` | Used only with `DEV_TEAM_LOCALHOST=true` by the test-only localhost proxy |
| `DEV_TEAM_LOCALHOST` | false | Enables the fictional admin identity override only for local test mode |

Port 80 needs to be free. Requires Node ≥ 22.13 (`node:sqlite`). The seeded workspace id is `t_00000000-0000-4000-8000-000000000001`; the APP never sees or sends it.

## Not for production
Test mode, demo verification and the signed-visitor stand-in must never be used outside local development.
