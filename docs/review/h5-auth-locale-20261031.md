# H5 登录页语言切换 visual check — 2026-10-31

Local Playwright run against the Wrangler worker/proxy at `http://localhost:8082/h5/login`, viewport `375x844`, device scale factor 1. No production or remote service was changed.

The auth language control always renders the three native names `中文 / English / ភាសាខ្មែរ`. The selected locale has `aria-pressed="true"`; the other two have `aria-pressed="false"`. All three buttons stayed on one row with at least 44px touch height and no horizontal overflow.

| Locale | Screenshot | SHA-256 |
| --- | --- | --- |
| zh | [zh.png](assets/h5-auth-locale-20261031/zh.png) | `5b3b475a8dbcc37b7b462bf7a1a1fb364ef07d24607ee72346d98cf7a1b58154` |
| en | [en.png](assets/h5-auth-locale-20261031/en.png) | `ada0ecc73851fdb9d9b994ace8bde28ec4ba8d6634d89a794b1f98caccafbc55` |
| km | [km.png](assets/h5-auth-locale-20261031/km.png) | `7c36800b6e86e4bdd59e40c9713c9f0f52b0e9fa95353a34d13269be111da0b7` |

The zh/en/km button-state assertions were captured during the same run: each locale had exactly one pressed button matching its locale and the same three labels in the list.
