# Q14 Flutter CI acceptance — 2026-10-16

Executor: 苏晨 / Codex. Result: PASS, pending review of this evidence PR.
Baseline: `ecd0afac56706f866eab60290731c5b174eec499` (`origin/main`).
This closes the Actions evidence blocker recorded in the October 15 checkpoint.

## Version and unchanged scope

- The existing workflow pins Flutter `3.47.0`, stable; no workflow change is needed.
- `mobile/pubspec.lock` requires Dart `>=3.12.0 <4.0.0` and Flutter `>=3.44.0`.
  The previous Flutter 3.29.3 pin was incompatible; commit `940519b` corrected it.
- Main contains that correction and the subsequent Flutter import fixes.
- `git diff --exit-code 7df2a35 origin/main -- mobile .github/workflows/flutter.yml`
  returned 0: the verified successful CI source matches this baseline's Flutter
  source and workflow. This is not a newly triggered main CI run.
- No business code, dependencies, migrations, deployment configuration or
  workflow settings are changed by this acceptance PR.

## Positive CI evidence

- [Main success run 38707708817](https://github.com/leishen8806/KhmerX/actions/runs/38707708817)
  tested commit `7df2a35bb96c23401bd38e5cdba2f642bfe91446`.
- [Successful analyze-and-test job](https://github.com/leishen8806/KhmerX/actions/runs/38707708817/job/116331136647)
  completed dependency installation, analysis and tests. Run duration: 3m 1s.
- The PR #26 run also succeeded:
  [38707695989](https://github.com/leishen8806/KhmerX/actions/runs/38707695989).
  PR #8's earlier failure is historical and is not relabeled as a success.
- Screenshot: [main CI success](evidence/Q14-ci-success.png).

## Deliberate failure experiment

1. Created temporary branch `test/app/Q14-analyze-failure-20261016` from the
   baseline; the only added file was `mobile/lib/q14_ci_failure_probe.dart`.
2. The file referenced an intentionally undefined, synthetic symbol. No secrets,
   networking, runtime hooks or production changes were involved.
3. Pushed commit `7e3907ffd395c8f9e630b1acc9d90dd2528c9e20`.
4. [Push run 38878742304](https://github.com/leishen8806/KhmerX/actions/runs/38878742304)
   failed in [Analyze](https://github.com/leishen8806/KhmerX/actions/runs/38878742304/job/116900038030).
   Dependency installation succeeded; Analyze reported exactly one issue:
   `undefined_identifier` at `lib/q14_ci_failure_probe.dart:1:27`, naming
   `q14IntentionallyUndefinedSymbol`, and exited with code 1. Test was skipped.
   Thus this was an analyzer rejection, not a runner/setup failure.
5. Captured the [failure screenshot](evidence/Q14-ci-negative.png), then checked
   that the remote branch still pointed to the exact probe SHA and deleted it.
   A subsequent `git ls-remote --heads` for that ref returned no result.
6. The probe was never proposed for merge. The evidence branch starts at the
   clean baseline and does not contain the probe file or commit.

## Local checks

Windows SDK: Flutter 3.47.0 stable / Dart 3.13.0.
Run from the evidence worktree's `mobile/` directory:

- `flutter pub get --offline`: PASS, lockfile unchanged.
- `flutter analyze`: PASS, no issues (49.0 seconds).
- `flutter test`: PASS, 410 tests.
- `git diff --check`: PASS.
- Backend checks were not rerun for this Flutter evidence-only card; the
  previously recorded backend audit/typecheck and React lint issues remain.

## Remaining queue / boundaries

- L1-A/L1-B and L1-G1/L1-G2, including the #48 safety follow-up, are in main.
- Q1/Q2/Q4/Q5/Q6/Q7 and second-tier Q8/Q10/Q11 already have merged code.
  Stale unchecked queue cells do not authorize reimplementing them.
- L2 still requires an owner-approved gray window and human operations;
  Codex must not contact the VPS hosts or production/gray product domains.
- Q12 remains blocked on actual L2 measurements and resource CSVs.
- Deferred third-tier cards are not started. No further unblocked first-tier
  code card remains after this Q14 acceptance.
- Assumption: store the required experiment proof in this small documentation
  PR because the SDK correction is already merged; do not reopen old code work.
- Rollback: revert only this evidence/queue update. Do not merge or restore the
  intentionally invalid probe into any delivery branch.
