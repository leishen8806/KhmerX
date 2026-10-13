# PayEase separated side-by-side deployment

This compose file runs the transition architecture on one private Docker
network:

- `client` exposes only `127.0.0.1:4310` for the host reverse proxy.
- `api` is private and reachable by the client as `http://api:4300`.
- `scanner` and `clamav` stay on the same internal network.
- `/opt/payease/data` and `/opt/payease/clamav` remain outside the images.

Load the architecture-matched images first, then run:

```bash
docker compose -f deploy/separated/compose.yaml up -d
```

Do not point Caddy at `4310` until `/readyz`, the client page, login Cookie,
Mini App API, file scanning, and rollback checks pass. The current production
container on `4300` is not changed by this file.
