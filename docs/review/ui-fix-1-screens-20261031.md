# UI-FIX-1 screenshot evidence

Generated locally with Playwright against the same `origin/main` baseline and the implementation branch. The local-only `__sites_local_auth=1` fixture and synthetic identity headers were used; no production session or external write was involved.

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
before-h5-390.png          c4ed26ec750acb6d1422aa703dc3cb8855a63c3147a638e3cc944259b287a23d
after-h5-390.png           834ca0a9258af5dc7b532ceb0d15070cb7dfc491aa9a9f1b175be56fc1e307cc
```
