# Android APK download on the VPS

Internal-test APK only. It is a release-mode build signed with the local **debug key**
(`KHMERX_INTERNAL_SIGNING=1`), so it can be installed by testers but is **not** for any store and
cannot be updated by a later, properly signed build (testers must uninstall first). A real release
needs `mobile/android/key.properties` + an upload keystore the owner generates and backs up.

## Link layout

| What | Path |
|---|---|
| Newest APK (stable link to hand out) | `https://<domain>/download/khmerx-latest.apk` |
| Versioned, immutable file | `https://<domain>/download/khmerx-<version>-<sha8>.apk` |
| Metadata (version, sha256, size) | `https://<domain>/download/latest.json` |
| Files on the VPS | `/opt/payease/downloads/` |

Until a domain with HTTPS exists, the same paths work on the IP (`http://159.223.92.104/download/...`)
for a browser download. The **app's API address must still be https**: Android release builds refuse
cleartext HTTP, so `-ApiBaseUrl` has to be an https host (a domain behind Caddy TLS).

## One-time VPS setup

```bash
sudo mkdir -p /opt/payease/downloads
sudo chown root:root /opt/payease/downloads && sudo chmod 755 /opt/payease/downloads
```

Add to the Caddyfile (usually `/etc/caddy/Caddyfile`), inside the site block that serves the host,
**above** the reverse_proxy to 4300 so the app/gateway never sees these requests:

```caddy
	handle_path /download/* {
		root * /opt/payease/downloads
		@apk path *.apk
		header @apk Content-Type application/vnd.android.package-archive
		header @apk Content-Disposition "attachment"
		header X-Content-Type-Options nosniff
		@json path *.json
		header @json Cache-Control "no-store"
		file_server
	}
```

Then `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.
Check: `curl -I https://<domain>/download/khmerx-latest.apk` -> 200 and the APK content type.

If the site is behind the Basic-auth gateway, leave `/download/*` outside it (public) or testers
cannot download; the APK contains no secrets (no keys, no server addresses beyond the public API).

## Build + publish

```powershell
# build only
.\scripts\apk\publish.ps1 -ApiBaseUrl https://<api-host>

# build, upload, verify sha256 on the server, switch khmerx-latest.apk
.\scripts\apk\publish.ps1 -ApiBaseUrl https://<api-host> -Upload -SshTarget root@159.223.92.104 -PublicBase https://<domain>/download
```

Output is also kept locally in `build/apk/` (`khmerx-<version>-<sha8>.apk`, `.sha256`, `latest.json`).
The upload is `.part` file -> sha256 check on the server -> atomic rename -> symlink switch, so a
half-uploaded file is never served.

## Testers

Open the link on the phone, allow "install unknown apps" for the browser, install. Give them the
sha256 from `latest.json` if they want to verify the file.
