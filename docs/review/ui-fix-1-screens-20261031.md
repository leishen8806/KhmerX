# UI-FIX-1 screenshot evidence

Generated locally with Playwright against the same `origin/main` baseline and the implementation branch. Team login used the local-only `__sites_local_auth=1` fixture and synthetic identity headers. H5 used the local Worker from `scripts/dev-app-backend/start.mjs`, a fictional demo phone, and the local demo login flow; no production session or external write was involved.

The earlier H5 capture was invalid because it showed the local API error surface. The replacement captures below show the authenticated H5 home. The error surface also exposed a pre-existing language-mixing issue: an English error message with a Chinese “重新加载” button. This PR records but does not change that issue.

| Viewport | Before (`origin/main`) | After (this branch) |
| --- | --- | --- |
| `/team/login` · 390px | [before-team-login-390.png](assets/ui-fix-1/before-team-login-390.png) | [after-team-login-390.png](assets/ui-fix-1/after-team-login-390.png) |
| `/team/login` · 1280px | [before-team-login-1280.png](assets/ui-fix-1/before-team-login-1280.png) | [after-team-login-1280.png](assets/ui-fix-1/after-team-login-1280.png) |
| `/h5` · 390px | [before-h5-390.png](assets/ui-fix-1/before-h5-390.png) | [after-h5-390.png](assets/ui-fix-1/after-h5-390.png) |

SHA-256:

```text
before-team-login-390.png  f5217b9e9943bf9e2eb5937504bf7098096d32cff64936b661b947519268771e
after-team-login-390.png   67925b57441090b49100c642fffba469415c6ab2d2f48d8995ece19042b316bd
before-team-login-1280.png 210c4fe118e017ca1f64746be485768036f0875a7e4dd375eb85524a867f6001
after-team-login-1280.png  77f19dcae0d00654cdb46ab223e5b49e127bbd60954fd58d36c372d7c5d19db6
before-h5-390.png          7d6f9a3d36f0e9609c7b7225201a72abe37be226675e82ca63a08d9ebba6705d
after-h5-390.png           14a960c02836cce2d5462042b4099df2ab7e06ac2db016aca5eca645c4236744
```
