#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'GRAY ARTIFACT BUILD: FAIL (%s)\n' "$1" >&2; exit 1; }
[[ $# -eq 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || fail 'expected full commit SHA'
[[ -f /.dockerenv && "$(node -v)" == v22.22.1 ]] || fail 'use node:22.22.1-bookworm-slim'
command -v git >/dev/null || fail 'Git must be provided by the build environment'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'dirty worktree'
[[ "$(git rev-parse HEAD)" == "$1" ]] || fail 'HEAD differs from expected SHA'
git merge-base --is-ancestor "$1" origin/main || fail 'commit is not an origin/main ancestor'
case "${GRAY_ARTIFACT_REUSE_DEPS:-0}" in
  0) npm ci ;;
  1) [[ -d node_modules ]] || fail 'existing locked dependencies are required' ;;
  *) fail 'invalid dependency reuse setting' ;;
esac
npm run build
[[ -d dist && ! -L dist && -s dist/server/BUILD_ID ]] || fail 'missing build output or BUILD_ID'
[[ -z "$(find dist ! -type d ! -type f -print -quit)" ]] || fail 'unsupported artifact file type'
# Keep the manifest inside the already-ignored release directory, including on a second build.
manifest=$(find dist -type f ! -path dist/BUILD_INFO.json ! -path dist/dist.sha256 -print0 |
  LC_ALL=C sort -z | xargs -0 sha256sum)
printf '%s\n' "$manifest" > dist/dist.sha256
node - "$1" <<'JS'
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const info = {
  gitSha: process.argv[2], builtAt: new Date().toISOString(), nodeVersion: process.version,
  lockfileSha256: createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'),
  buildId: fs.readFileSync('dist/server/BUILD_ID', 'utf8').trim(),
  fileCount: fs.readFileSync('dist/dist.sha256', 'utf8').trim().split('\n').length,
};
if (!info.buildId) throw Error('Empty BUILD_ID');
fs.writeFileSync('dist/BUILD_INFO.json', JSON.stringify(info, null, 2) + '\n');
JS
printf 'GRAY ARTIFACT BUILD: PASS\n'
