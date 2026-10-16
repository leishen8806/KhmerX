#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
if [[ $# -gt 0 ]]; then
  [[ $# -eq 2 && "$1" == --declared-scales ]] || { echo "Use --declared-scales JSON" >&2; exit 2; }
  export DECLARED_SCALES="$2"
fi
: "${ROWS_MANIFEST:?private manifest required}" "${BASE_URL:?matching fixture origin required}" "${CUSTOMER_ROWS:?mode required}"
VUS=${VUS:-50}
REPORT_PREFIX=${REPORT_PREFIX:-scripts/loadtest/reports/rows-local}
node scripts/loadtest/rows-preflight.mjs "$ROWS_MANIFEST" "$BASE_URL" "$CUSTOMER_ROWS" "$VUS" "${DATASET:-main}"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {declaredScales} from "./scripts/loadtest/rows-preflight.mjs"; if(JSON.parse(readFileSync(process.env.ROWS_MANIFEST)).target.profile==="gray-config") declaredScales(process.env.DECLARED_SCALES)'
mkdir -p "$(dirname "$REPORT_PREFIX")"
export VUS BASE_URL ROWS_MANIFEST
export START_AT=$(( $(date +%s) * 1000 + 15000 ))
export GIT_HEAD
GIT_HEAD=$(git rev-parse HEAD)
export ROWS_SUMMARY="$REPORT_PREFIX-summary.json"
export K6_CSV_TIME_FORMAT=unix_nano
"${K6_BIN:-k6}" run --out "csv=$REPORT_PREFIX.csv" scripts/loadtest/rows-flow.js
node scripts/loadtest/analyze-rows.mjs "$REPORT_PREFIX.csv" "$ROWS_SUMMARY" "$REPORT_PREFIX.json"
