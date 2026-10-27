#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'GRAY ARTIFACT BUILD: FAIL (%s)\n' "$1" >&2; exit 1; }
[[ $# -eq 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || fail 'expected full commit SHA'
[[ -f /.dockerenv && "$(node -v)" == v22.22.1 ]] || fail 'use node:22.22.1-bookworm-slim'
command -v git >/dev/null || fail 'Git must be provided by the build environment'
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'dirty worktree'
[[ "$(git rev-parse HEAD)" == "$1" ]] || fail 'HEAD differs from expected SHA'
git merge-base --is-ancestor "$1" origin/main || fail 'commit is not an origin/main ancestor'
[[ ! -e dist && ! -L dist ]] || fail 'dist exists; build in a disposable build directory'
case "${GRAY_ARTIFACT_REUSE_DEPS:-0}" in
  0) npm ci ;;
  1) [[ -d node_modules ]] || fail 'existing locked dependencies are required' ;;
  *) fail 'invalid dependency reuse setting' ;;
esac
deps=$(node - "${GRAY_ARTIFACT_REUSE_DEPS:-0}" <<'JS'
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  const source = fs.readFileSync('package-lock.json');
  if (!fs.existsSync('node_modules/.package-lock.json')) throw Error('node_modules: missing installed lock');
  const installed = fs.readFileSync('node_modules/.package-lock.json');
  const wanted = JSON.parse(source).packages, actual = JSON.parse(installed).packages;
  if (!wanted || !actual) throw Error('node_modules: invalid package inventory');
  const entries = Object.entries(actual).filter(([name]) => name !== '');
  if (!entries.length) throw Error('node_modules: empty package inventory');
  for (const [name, entry] of entries) {
    const expected = wanted[name];
    if (!expected) throw Error(`${name}: absent from source lock`);
    for (const key of ['version', 'resolved', 'integrity'])
      if ((key === 'version' || (entry[key] && expected[key])) && entry[key] !== expected[key])
        throw Error(`${name}: ${key} mismatch`);
    if (!fs.existsSync(`${name}/package.json`)) throw Error(`${name}: package missing`);
    if (JSON.parse(fs.readFileSync(`${name}/package.json`)).version !== entry.version)
      throw Error(`${name}: installed version mismatch`);
  }
  const matches = (values, target) => !values || (!values.includes(`!${target}`) &&
    (!values.some(value => !value.startsWith('!')) || values.includes(target)));
  for (const [name, entry] of Object.entries(wanted)) {
    if (!name) continue;
    // The pinned bookworm build image uses glibc, not musl.
    const platformBinding = (entry.os || entry.cpu) && matches(entry.os, process.platform) &&
      matches(entry.cpu, process.arch) && matches(entry.libc, 'glibc') && !name.includes('linuxmusl') && !name.endsWith('-musl');
    if ((!entry.optional || platformBinding) && !actual[name]) throw Error(`${name}: required package missing`);
  }
  console.log(JSON.stringify({mode: process.argv[2] === '1' ? 'reused' : 'npm-ci',
    lockfileSha256: hash(source), installedLockSha256: hash(installed),
    installedPackages: entries.length, checkedPackages: entries.length}));
} catch (error) {
  console.error(`GRAY ARTIFACT BUILD: FAIL (${error instanceof SyntaxError ? 'node_modules: invalid package JSON' : error.code ? 'node_modules: unreadable package inventory' : error.message})`);
  process.exitCode = 1;
}
JS
)
npm run build
[[ -d dist && ! -L dist && -s dist/server/BUILD_ID ]] || fail 'missing build output or BUILD_ID'
[[ -z "$(find dist ! -type d ! -type f -print -quit)" ]] || fail 'unsupported artifact file type'
printf '%s\n' "$deps" > dist/BUILD_DEPS.json
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
