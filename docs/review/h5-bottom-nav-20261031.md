# H5 bottom navigation visual check — 2026-10-31

Local-only Playwright acceptance run against the Wrangler worker and proxy at `http://localhost:8080/h5`, viewport `390x844`, device scale factor 1. No production or remote service was changed.

The authenticated home screenshots show the bottom navigation flush with the viewport bottom and the disclaimer/content ending above the navigation. The error screenshot shows the reload action in English; the button label is selected from the current authentication locale (`zh`, `km`, or `en`).

| Capture | SHA-256 |
| --- | --- |
| [zh.png](assets/h5-bottom-nav-20261031/zh.png) | `ae6a2dfe55d3757bdc5b77ab890723f054279e310083bf96a3d114def0522851` |
| [en.png](assets/h5-bottom-nav-20261031/en.png) | `3260f52e4a276ffd57ccc4e8b69e203bb55df860820812f8bdcad4315a0ffeff` |
| [km.png](assets/h5-bottom-nav-20261031/km.png) | `1d0b8a7630c5ae8b907eec124515e34d43874ba7c7b1128b62c9f8c4053a5ea6` |
| [error.png](assets/h5-bottom-nav-20261031/error.png) | `e64eb19254ecedb87d7c8bfea83a9482ff17042cece2ffbd7417c4bf594c3603` |

All captures are `390x844` PNGs.
