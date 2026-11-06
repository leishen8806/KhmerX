# H5 login locale audit — 2026-11-05

## Scope and result

`app/h5/login.tsx` now reads all login-page copy through the shared `messages` dictionary. English and Khmer screenshots were captured at 390×844 and contain no CJK characters in the rendered body text, including the test-funds banner. The Chinese screenshot remains the source-language variant. The legacy greeting DOM patch was removed from `app/h5/layout.tsx`; no CJK remains in the H5 login/layout source files.

The language switcher is intentionally excluded from the English/Khmer body-copy assertion and renders each locale's native label (`中文`, `English`, `ភាសាខ្មែរ`).

The scan command was:

```sh
rg -nP '[\x{4e00}-\x{9fff}]' app/h5
```

It returned no matches. The only prior hardcoded H5 strings were in `login.tsx` (titles, phone/password labels, OTP/error/status copy, recovery/navigation text, side-panel steps, and the test-funds footer) plus the obsolete `你好，{name}` mutation in `layout.tsx`. All feasible login strings moved to `auth*` dictionary keys in `lib/i18n.tsx`; the obsolete mutation was deleted. Customer-entered values, API error payloads, and the separate password-recovery component remain unchanged and are not silently rewritten.

## Screenshot evidence

All captures use Playwright with `{ width: 390, height: 844 }`. The local API response was a synthetic demo-mode response with no session, so no credential or online write was used.

| locale | screenshot | sha256 | rendered CJK |
|---|---|---|---|
| en | [`en.png`](./h5-login-locale-20261105/en.png) | `bc2fad681194f56cf9fcacc092ec1346c08bbd339a03c17fbfb6eae0272e0c26` | no |
| km | [`km.png`](./h5-login-locale-20261105/km.png) | `16465ab1abcaf8f73293b98eb17dd41064747dc9cad25e6301cf07a50d0336a1` | no |
| zh | [`zh.png`](./h5-login-locale-20261105/zh.png) | `03e15b2f30e6f5d11903fbd608d2d02edb610c44ba69e2a301dd6e2cf111cfd8` | expected |

Text dumps with the same hashes are beside each image (`en.txt`, `km.txt`, `zh.txt`).

## Gates

- Focused locale and H5 navigation tests: pass (6/6).
- Typecheck: pass.
- `npm run build:separated`: pass; client-boundary check passed, separated build reported `leaks: 0`.
- `npm run lint`: pass with the repository's existing warnings and 0 errors.
- Full `TMPDIR=/private/tmp npm test`: 525 pass, 1 failure, 16 skipped. The only failure is the existing Docker Desktop bootstrap (`Q4 bootstrap metadata repairs...`: Docker Desktop unable to start); the locale-focused and H5 navigation tests pass.
- GitHub Web gate: pass. Run `42017425690`, job `127211335234` (`gates`).
