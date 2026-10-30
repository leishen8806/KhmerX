# Plan R-2: audit sequence backfill (local/backup only)

This runbook is intentionally not a deployment procedure. It may be used only
against a copied local SQLite/D1 backup. It must not be pointed at a remote D1,
production, a server, or a live Wrangler binding.

## Dry run

```sh
TMPDIR=/private/tmp node scripts/audit-manifest-backfill.mjs --db /path/to/local.sqlite
```

The JSON receipt records `count`, `unique`, and the first/last planned ids. A
zero-count dry run is the expected post-backfill result. Review the receipt and
compare v2 manifest results before and after; row count, digest, last-created-at,
and last-id must remain unchanged.

## Apply to a disposable copy

```sh
cp /path/to/backup.sqlite /private/tmp/audit-backfill.sqlite
TMPDIR=/private/tmp node scripts/audit-manifest-backfill.mjs --db /private/tmp/audit-backfill.sqlite --apply
TMPDIR=/private/tmp node scripts/audit-manifest-backfill.mjs --db /private/tmp/audit-backfill.sqlite
```

The script updates only rows whose `seq` is NULL, ordered by
`created_at ASC, id ASC`, and rejects `--remote`/`--production`. No command in
this document authorizes applying the change to any environment.

