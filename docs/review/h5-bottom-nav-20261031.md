# H5 bottom navigation visual check — 2026-10-31

Local-only Playwright acceptance run against the Wrangler worker and proxy at `http://localhost:8080/h5`, viewport `390x844`, device scale factor 1. No production or remote service was changed.

The authenticated home screenshots show the bottom navigation flush with the viewport bottom and the disclaimer/content ending above the navigation. The three error captures were taken with the language preference explicitly set to each locale; the error message, reload action, and language switcher agree in every capture.

| Capture | SHA-256 |
| --- | --- |
| [zh.png](assets/h5-bottom-nav-20261031/zh.png) | `ae6a2dfe55d3757bdc5b77ab890723f054279e310083bf96a3d114def0522851` |
| [en.png](assets/h5-bottom-nav-20261031/en.png) | `3260f52e4a276ffd57ccc4e8b69e203bb55df860820812f8bdcad4315a0ffeff` |
| [km.png](assets/h5-bottom-nav-20261031/km.png) | `1d0b8a7630c5ae8b907eec124515e34d43874ba7c7b1128b62c9f8c4053a5ea6` |
| [error-zh.png](assets/h5-bottom-nav-20261031/error-zh.png) | `c29f41596ed0d3042f5f72be1635ca7763558c1a2358aa3cce52697ca522f3bf` |
| [error-en.png](assets/h5-bottom-nav-20261031/error-en.png) | `a878289910960f3be6bde1005f69263382306fcefdb7471803b3ce4bfe18efee` |
| [error-km.png](assets/h5-bottom-nav-20261031/error-km.png) | `05d0bc14e69cc1cbf93e710e9b2c1ac915af74392c0c8cec7e0f8e02806155da` |

All captures are `390x844` PNGs. Verified error copy: zh `网络连接失败，请检查网络后重试` / `重新加载`; en `Network connection failed. Check your connection and try again` / `Reload`; km `ការតភ្ជាប់បណ្តាញបានបរាជ័យ សូមពិនិត្យបណ្តាញ ហើយព្យាយាមម្តងទៀត` / `ផ្ទុកឡើងវិញ`.

## 后续

登录页右上角的语言切换命名仍需统一：英文状态显示 `English / Khmer`，高棉语状态显示 `English / ភាសាខ្មែរ`，历史截图还出现过 `中文 / Khmer`。后续 UI 修复应统一列出三种语言名称：`中文 / English / ភាសាខ្មែរ`，并高亮当前语言。
