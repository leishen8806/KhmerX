import {env} from 'cloudflare:workers';

/**
 * Single point of truth for the test-mode switch and the production marker (S3).
 *
 * KHMERX_TEST_MODE simultaneously lowers MFA step-up, dual-control approvals,
 * file scanning and password issuance guards in lib/team/server.ts and
 * lib/kyc/server.ts. Production is detected with the same semantic the rest
 * of the worker already uses (PAYEASE_IDENTITY_PROOF_REQUIRED=true, see
 * app/chatgpt-auth.ts); deploy/standalone/server.mjs additionally refuses to
 * boot while KHMERX_TEST_MODE=true. Keeping the reads here makes the blast
 * radius auditable and lets a readiness probe advertise the runtime state.
 */
export function isTestMode(): boolean {
  return (env as unknown as Record<string, unknown>).KHMERX_TEST_MODE === 'true';
}

export function isProduction(): boolean {
  const values = env as unknown as Record<string, unknown>;
  const environment = String(values.PAYEASE_ENV || '').toLowerCase();
  // Gray/local retain the identity-proof middleware, but are not production
  // deployment environments. This distinction lets gray exercise the real
  // proof path without making its isolated H5 demo OTP look like production.
  return values.PAYEASE_IDENTITY_PROOF_REQUIRED === 'true' && !['local', 'gray'].includes(environment);
}

/**
 * Independent H5-only demo OTP switch. It is deliberately not tied to
 * KHMERX_TEST_MODE: that switch also relaxes MFA, dual-control approvals,
 * virus scanning, and password issuance guards.
 */
export function demoOtpAllowed(): boolean {
  const values = env as unknown as Record<string, unknown>;
  const enabled = values.PAYEASE_DEMO_OTP_ALLOWED === 'true';
  const environment = String(values.PAYEASE_ENV || '').toLowerCase();
  return enabled && ['local', 'gray'].includes(environment) && !isProduction();
}

export function institutionMode(): 'embedded'|'external' {
  const mode = String((env as unknown as Record<string, unknown>).PAYEASE_INSTITUTION_MODE || '').toLowerCase();
  return mode === 'external' ? 'external' : 'embedded';
}

/** Refuse to run a production worker that still has the test-mode switch on. */
export function assertProductionSafe(): void {
  if (isTestMode() && isProduction()) {
    throw new Error('KHMERX_TEST_MODE must be disabled while PAYEASE_IDENTITY_PROOF_REQUIRED=true');
  }
  const values = env as unknown as Record<string, unknown>;
  if (values.PAYEASE_DEMO_OTP_ALLOWED === 'true' && isProduction()) {
    throw new Error('PAYEASE_DEMO_OTP_ALLOWED must be disabled in production');
  }
}

/** Readiness-facing snapshot of the runtime guards. */
export function runtimeGuardStatus(): {testMode: boolean; production: boolean; demoOtpAllowed: boolean; blocked: boolean} {
  const testMode = isTestMode();
  const production = isProduction();
  const demoOtp = demoOtpAllowed();
  return {testMode, production, demoOtpAllowed: demoOtp, blocked: (testMode || demoOtp) && production};
}
