# H5 blocked-channel page evidence

Local-only acceptance evidence for the independent blocked-page PR. The worker was built with fictional local data and `PAYEASE_H5_CHANNEL_STATUS=disabled`; the browser then mocked only the H5 auth boot response to exercise all three stable error codes. No deployed or VPS environment was contacted.

At a 390×844 viewport, each code renders an icon, localized title, localized description, and one action button. The page has no `input[type="tel"]` (the Playwright assertion reported `inputs=0` for all nine captures). The OTP expiry, invalid-code, and rate-limit paths remain in the existing form flow because only the three channel codes set `blocked`.

The layout follows the #186 prototypes:

- `client-mini-mismatch-km.png`: `docs/review/assets/channel-config-ui/client-mini-mismatch-km.png`
- `client-maintenance-zh.png`: `docs/review/assets/channel-config-ui/client-maintenance-zh.png`
- `client-h5-disabled-km.png`: `docs/review/assets/channel-config-ui/client-h5-disabled-km.png`

## Captures and SHA-256

| Code | Locale | Capture | SHA-256 |
| --- | --- | --- | --- |
| `CHANNEL_COMPANY_MISMATCH` | zh | `blocked-channel-company-mismatch-zh.png` | `14f6696425b7d53754b0c44cf249b87128f286e3ed844f8318514a9a5edf9d31` |
| `CHANNEL_COMPANY_MISMATCH` | en | `blocked-channel-company-mismatch-en.png` | `672d865ffcc40f864815f1827d456d4b18a4038dc86ba58d88dc31e988eb9870` |
| `CHANNEL_COMPANY_MISMATCH` | km | `blocked-channel-company-mismatch-km.png` | `863c89b4d417856c32132737d0599b1d94a6f54f9a1a339e30350ed24e8087eb` |
| `CHANNEL_MAINTENANCE` | zh | `blocked-channel-maintenance-zh.png` | `8ca50eaf328dab5913fbf0db3ecd0b2a0e76f7e6bd4b5250efdc17685e517f20` |
| `CHANNEL_MAINTENANCE` | en | `blocked-channel-maintenance-en.png` | `7562a86826266917f94da62e1094f6cc5970252895e8af8d8fda153e67ccbe3` |
| `CHANNEL_MAINTENANCE` | km | `blocked-channel-maintenance-km.png` | `d5155d6c29214781a69f4d39139451697d151a6ea07a0188d8fda153e67ccbe3` |
| `CHANNEL_DISABLED` | zh | `blocked-channel-disabled-zh.png` | `29ba874a34ed1d57bc4bc896be3842aacae5c6bee481be1aaf23182514f78b82` |
| `CHANNEL_DISABLED` | en | `blocked-channel-disabled-en.png` | `f3b01baf38a8f8f33f702584434fc810ca46b1637bc2fd34bc4cbe68322a5018` |
| `CHANNEL_DISABLED` | km | `blocked-channel-disabled-km.png` | `d20ad854d2d65aac8acb6e5ebf6810e9b40a0838c641f408a02e6616db211a22` |

All nine hashes are distinct; there is no duplicate screenshot blob. Reproduce with `TMPDIR=/private/tmp npm run build:separated`, the local dev backend, and the isolated Playwright harness used for these captures.
