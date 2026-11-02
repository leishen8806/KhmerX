# H5 登录页语言切换 visual check — 2026-10-31

Local Playwright run against the Wrangler worker/proxy at `http://localhost:8084/h5/login`, viewport `375x844`, device scale factor 1. No production or remote service was changed. Each locale was selected by clicking the visible locale button in a fresh browser context; the run then asserted `document.documentElement.lang`, the locale button `aria-pressed` state, and the translated level-one heading before taking the screenshot.

The auth language control always renders the three native names `中文 / English / ភាសាខ្មែរ`. The selected locale has `aria-pressed="true"`; the other two have `aria-pressed="false"`. All three buttons stayed on one row with at least 44px touch height and no horizontal overflow.

| Locale | Screenshot | SHA-256 |
| --- | --- | --- |
| zh | [zh.png](assets/h5-auth-locale-20261031/zh.png) | `52075a36ff0e2b80b9f9bea92f21e4c9d6d6ba094539f724c949ad36d548b509` |
| en | [en.png](assets/h5-auth-locale-20261031/en.png) | `d5d0042e2ea1b5df917205d0d88121ad102c7e03b25ca769e464c8fbbc7a6967` |
| km | [km.png](assets/h5-auth-locale-20261031/km.png) | `ff042d417e726d4a84aed112192e5d9fbca79f9a4f5d0eb10c09d1a215f12ff2` |

The zh/en/km assertions were captured during the same run: each locale had exactly one pressed button matching its locale and the same three labels in the list. The heading assertion was `注册 / 登录` for zh, `Sign in / Register` for en, and `ចូល / ចុះឈ្មោះ` for km. The screenshots also show the P2 fix: the 44px controls are in the header row beside the brand rather than fixed over the page content.

The remaining P3 naming note is retained: the header brand says `PayEase`, while the footer workspace note says `KhmerX Test Workspace`; this is recorded as a naming consistency follow-up and is not changed in this review round.
