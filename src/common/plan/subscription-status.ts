import { SubscriptionStatus } from '../../../generated/prisma/enums';

export const PAST_DUE_GRACE_DAYS = 5;
export const DATA_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const READ_ONLY_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.SUSPENDED,
  SubscriptionStatus.CANCELED,
];

type SubscriptionDates = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export function effectiveSubscriptionStatus(
  { status, trialEndsAt, currentPeriodEnd }: SubscriptionDates,
  now = new Date(),
): SubscriptionStatus {
  if (status === SubscriptionStatus.TRIAL) {
    return trialEndsAt && trialEndsAt <= now
      ? SubscriptionStatus.SUSPENDED
      : status;
  }
  const billable =
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE;
  if (!billable || !currentPeriodEnd || currentPeriodEnd > now) return status;

  const graceEnd =
    currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * MS_PER_DAY;
  return now.getTime() < graceEnd
    ? SubscriptionStatus.PAST_DUE
    : SubscriptionStatus.SUSPENDED;
}

export function isReadOnlyStatus(status: SubscriptionStatus) {
  return READ_ONLY_STATUSES.includes(status);
}

export function isTrialSubscription(currentPeriodEnd: Date | null) {
  return currentPeriodEnd === null;
}

export function dataPurgeAt(canceledAt: Date | null) {
  return canceledAt
    ? new Date(canceledAt.getTime() + DATA_RETENTION_DAYS * MS_PER_DAY)
    : null;
}

export function purgeCutoff(now = new Date()) {
  return new Date(now.getTime() - DATA_RETENTION_DAYS * MS_PER_DAY);
}
