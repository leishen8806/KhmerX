# D-42 channel authentication plan

## Scope

Separate the regular H5/App phone-code channel from the Telegram Mini App
channel without changing funding, KYC, or database schemas.

## Decisions

- `PAYEASE_H5_AUTH_MODE` is the explicit mode for ordinary H5/App requests and
  falls back to the existing `PAYEASE_AUTH_MODE` for backward compatibility.
- `PAYEASE_TELEGRAM_AUTH_MODE` is the Telegram channel mode and defaults to
  `telegram`; the Telegram route never uses the H5 mode.
- The H5 client sends `X-Telegram-Init-Data` only when the Telegram WebApp
  provides signed init data. The server uses presence of this channel signal
  only to select the runtime; `/api/h5/auth/telegram` still performs the
  cryptographic verification before creating a Telegram session.
- Gray enables `KHMERX_TEST_MODE=true`, `PAYEASE_H5_AUTH_MODE=demo`, and keeps
  Telegram Mini App authentication on `telegram`. Standalone production still
  rejects test mode.

## Verification

- Unit coverage proves channel selection and existing demo/Telegram fail-closed
  behavior.
- Gray config preflight requires the explicit split and rejects production,
  missing credentials, or an H5 mode other than demo.
- Full local H5/KYC/loan/signing acceptance and three-language screenshots are
  recorded separately in the review report; no VPS or production write is part
  of this plan.
