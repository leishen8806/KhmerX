# H5 auth error-page locale review — 2026-11-02

Local Playwright run against the Vinext dev server at `http://127.0.0.1:8084/h5/login`, viewport `375x844`, device scale factor 1. The `/api/h5/auth` request was intentionally aborted in the browser to reproduce the network-error page; no production or remote service was changed.

The run clicked the visible `ភាសាខ្មែរ` button, then asserted `document.documentElement.lang=km`, exactly one pressed locale button labelled `ភាសាខ្មែរ`, and the Khmer network-error alert before taking the screenshot. The shared header measured `327x68` at `(24,24)` and remains in the page flow beside the logo.

| Locale | Screenshot | SHA-256 |
| --- | --- | --- |
| km | [error-km.png](assets/h5-auth-locale-20261102/error-km.png) | `821a4005e8b92104612f1eb256a6d237250112d7b6ab9fbc765f2d9e116cceba` |
