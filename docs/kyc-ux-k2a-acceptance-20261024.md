# K2a acceptance — 2026-10-24

Base: `a82b563` (current main when started). Independent of K2b; no deployment.

## Scope and regression evidence

- Customer blur validation and linked `aria-invalid` / `aria-describedby` errors reuse `lib/kyc/core.ts`; no server or business-rule changes.
- Next and submit mark errors, select the first affected section, scroll and focus its control. Review-mode navigation remains read-only.
- Phone hint uses a +855 example without requiring that prefix or rewriting input; existing international-phone rules remain authoritative. Document number has an example placeholder.
- New UI copy uses whole zh/en/km templates; customer-entered values are not translated.
- Regression tests cover blur, first-error focus, ARIA linking, international phone input preservation, and cross-section submit validation.

## Gates

- `TMPDIR=/private/tmp npm test`: 298 tests, 288 passed, 10 skipped, 0 failed.
- `npm run typecheck`: exit 0.
- `npm run build:separated`: exit 0, `leaks: 0`.
- `npm run lint`: exit 0, 0 errors, 577 existing/project warnings.
- Build output was preserved outside the checkout before lint so generated artifacts did not pollute source linting.

## Local browser evidence (375 px)

- `/private/tmp/kyc-k2a-final-zh-375.png`
- `/private/tmp/kyc-k2a-final-km-375.png`
- `/private/tmp/kyc-k2a-final-km-submitted-375.png`

Used an isolated local synthetic server. Other required fields were seeded with fictional data; surname was cleared through the UI, Next produced linked errors and focused surname, then UI correction cleared the error. Uploaded a non-personal brand-image fixture for front/back/selfie through the UI and submitted through the UI. Read-only local API confirmation: `status=submitted`, revision 16. This is not a claim that every field was manually typed.

Limitations: desktop Chromium only, not physical camera/Telegram-device acceptance. Khmer translations require native-speaker review before real-customer use. K2a and K2b are independent PRs touching the same client component; combine carefully after review. No production data, deployment, authentication policy, migration, or #63 frozen content changed.
