import type {Entry} from './domain';

/** Company funding guardrails. Values are cents (USD). */
export const defaultFundingLimits = {
  dailyCents: 1_000_000,
  monthlyCents: 3_000_000,
  warningPercent: 20,
  timezone: 'Asia/Phnom_Penh',
} as const;

function dayKey(value: string | Date) {
  return new Date(value).toLocaleDateString('en-CA', {timeZone: 'Asia/Phnom_Penh'});
}

function monthKey(value: string | Date) {
  return dayKey(value).slice(0, 7);
}

export function fundingUsage(entries: Entry[], now: string | Date = new Date()) {
  const day = dayKey(now), month = monthKey(now);
  const funded = entries.filter((entry) => entry.kind === '测试放款');
  return {
    dayCents: funded.filter((entry) => dayKey(entry.at) === day).reduce((sum, entry) => sum + entry.cents, 0),
    monthCents: funded.filter((entry) => monthKey(entry.at) === month).reduce((sum, entry) => sum + entry.cents, 0),
  };
}

/**
 * Returns the operator-facing funding state without changing any ledger data.
 * Warning is reached when the remaining daily or monthly allowance is at or
 * below the configured percentage; blocked is only a hard limit condition.
 */
export function fundingStatus(entries: Entry[], now: string | Date = new Date(), limits = defaultFundingLimits) {
  const usage = fundingUsage(entries, now);
  const dailyRemainingCents = Math.max(0, limits.dailyCents - usage.dayCents);
  const monthlyRemainingCents = Math.max(0, limits.monthlyCents - usage.monthCents);
  const dailyPercent = limits.dailyCents > 0 ? Math.round((usage.dayCents / limits.dailyCents) * 100) : 100;
  const monthlyPercent = limits.monthlyCents > 0 ? Math.round((usage.monthCents / limits.monthlyCents) * 100) : 100;
  const warning = dailyRemainingCents <= limits.dailyCents * (limits.warningPercent / 100)
    || monthlyRemainingCents <= limits.monthlyCents * (limits.warningPercent / 100);
  return {
    ...usage,
    dailyRemainingCents,
    monthlyRemainingCents,
    dailyPercent: Math.min(100, dailyPercent),
    monthlyPercent: Math.min(100, monthlyPercent),
    warning,
    blocked: usage.dayCents >= limits.dailyCents || usage.monthCents >= limits.monthlyCents,
    timezone: limits.timezone,
  };
}

export function assertFundingCapacity(entries: Entry[], amountCents: number, now: string | Date = new Date(), limits = defaultFundingLimits) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('放款金额无效');
  const usage = fundingUsage(entries, now);
  const daily = usage.dayCents + amountCents;
  const monthly = usage.monthCents + amountCents;
  if (daily > limits.dailyCents || monthly > limits.monthlyCents) {
    const error = new Error('超过公司放款限额，请先完成资金监管复核');
    (error as Error & {code?: string}).code = 'FUNDING_LIMIT_EXCEEDED';
    throw error;
  }
  return {
    ...usage,
    projectedDayCents: daily,
    projectedMonthCents: monthly,
    warning: daily >= limits.dailyCents * (1 - limits.warningPercent / 100) || monthly >= limits.monthlyCents * (1 - limits.warningPercent / 100),
    dailyRemainingCents: Math.max(0, limits.dailyCents - daily),
    monthlyRemainingCents: Math.max(0, limits.monthlyCents - monthly),
    timezone: limits.timezone,
  };
}
