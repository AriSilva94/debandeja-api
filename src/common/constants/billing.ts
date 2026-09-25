export const DEFAULT_PLAN_CODE = 'ESSENCIAL';
export const TRIAL_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function trialDaysRemaining(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil((trialEndsAt.getTime() - Date.now()) / MS_PER_DAY),
  );
}
