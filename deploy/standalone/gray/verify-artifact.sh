#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'GRAY ARTIFACT CHECK: FAIL (%s)\n' "$1" >&2; exit 1; }
[[ $# -ge 1 && $# -le 2 && "$1" =~ ^[a-f0-9]{40}$ ]] || fail 'expected full commit SHA [--running]'
[[ $# -eq 1 || "$2" == --running ]] || fail 'unknown option'
[[ -d dist && ! -L dist && -s dist/dist.sha256 && -s dist/BUILD_INFO.json ]] || fail 'missing artifact'
[[ -z "$(find dist ! -type d ! -type f -print -quit)" ]] || fail 'unsupported artifact file type'
cmp -s dist/dist.sha256 <(
  find dist -type f ! -path dist/BUILD_INFO.json ! -path dist/dist.sha256 -print0 |
    LC_ALL=C sort -z | xargs -0 sha256sum
) || fail 'file inventory or checksum mismatch'
node - "$1" "${2:-}" <<'JS'
const fs = require('node:fs');
async function verify() {
  const info = JSON.parse(fs.readFileSync('dist/BUILD_INFO.json', 'utf8'));
  const keys = ['gitSha', 'builtAt', 'nodeVersion', 'lockfileSha256', 'buildId', 'fileCount'];
  if (Object.keys(info).sort().join() !== keys.sort().join() ||
      info.gitSha !== process.argv[2] || info.nodeVersion !== 'v22.22.1' ||
      typeof info.builtAt !== 'string' || !Number.isFinite(Date.parse(info.builtAt)) ||
      !/^[a-f0-9]{64}$/.test(info.lockfileSha256) ||
      typeof info.buildId !== 'string' || !info.buildId ||
      info.buildId !== fs.readFileSync('dist/server/BUILD_ID', 'utf8').trim() ||
      info.fileCount !== fs.readFileSync('dist/dist.sha256', 'utf8').trim().split('\n').length)
    throw Error('metadata mismatch');
  if (process.argv[3] === '--running') {
    const response = await fetch('http://127.0.0.1:4300/version', {signal: AbortSignal.timeout(5000)});
    if (!response.ok || (await response.json()).buildId !== info.buildId) throw Error('running build mismatch');
    console.log('RUNNING BUILD CHECK: PASS');
  }
  console.log('GRAY ARTIFACT CHECK: PASS');
}
verify().catch(() => {console.error('GRAY ARTIFACT CHECK: FAIL (metadata or running version)');process.exitCode = 1});
JS
