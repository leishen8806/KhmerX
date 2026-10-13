# PayEase API / gateway artifact

This image uses the separated server bundle while retaining the current
standalone gateway behavior: identity proof injection, host validation, Cookie
sessions, D1/R2 persistence and internal scanner access.

Build after `npm run build:separated`:

```bash
docker build -f deploy/api/Dockerfile -t payease-api .
```

The service must remain behind the public gateway/reverse proxy. Do not expose
the Miniflare port directly to the Internet, and keep `/data` outside the image.

Runtime checks:

- `GET /healthz` — process liveness, no database access.
- `GET /readyz` — database readiness and separated build id.
- `GET /version` — service name and build id for release evidence.

The compose healthcheck uses `/readyz`; these endpoints are intended for the
internal gateway and orchestrator and do not replace authenticated business
API access.
