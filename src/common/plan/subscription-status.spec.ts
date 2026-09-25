import { SubscriptionStatus } from '../../../generated/prisma/enums';
import {
  dataPurgeAt,
  effectiveSubscriptionStatus,
  isReadOnlyStatus,
  purgeCutoff,
} from './subscription-status';

const { TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELED } = SubscriptionStatus;
const now = new Date('2026-09-24T12:00:00Z');
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

function status(
  current: SubscriptionStatus,
  dates: { trialEndsAt?: Date; currentPeriodEnd?: Date },
) {
  return effectiveSubscriptionStatus(
    {
      status: current,
      trialEndsAt: dates.trialEndsAt ?? null,
      currentPeriodEnd: dates.currentPeriodEnd ?? null,
    },
    now,
  );
}

describe('effectiveSubscriptionStatus', () => {
  it('trial vigente continua trial; vencido suspende', () => {
    expect(status(TRIAL, { trialEndsAt: daysFromNow(1) })).toBe(TRIAL);
    expect(status(TRIAL, { trialEndsAt: daysFromNow(0) })).toBe(SUSPENDED);
  });

  it('período vencido dá 5 dias de carência antes de suspender', () => {
    expect(status(ACTIVE, { currentPeriodEnd: daysFromNow(3) })).toBe(ACTIVE);
    expect(status(ACTIVE, { currentPeriodEnd: daysFromNow(-1) })).toBe(
      PAST_DUE,
    );
    expect(status(PAST_DUE, { currentPeriodEnd: daysFromNow(-4) })).toBe(
      PAST_DUE,
    );
    expect(status(ACTIVE, { currentPeriodEnd: daysFromNow(-5) })).toBe(
      SUSPENDED,
    );
    expect(status(PAST_DUE, { currentPeriodEnd: daysFromNow(-6) })).toBe(
      SUSPENDED,
    );
  });

  it('suspensa e cancelada só mudam por ação manual', () => {
    expect(status(SUSPENDED, { currentPeriodEnd: daysFromNow(10) })).toBe(
      SUSPENDED,
    );
    expect(status(CANCELED, { currentPeriodEnd: daysFromNow(-100) })).toBe(
      CANCELED,
    );
  });

  it('somente leitura em suspensa e cancelada', () => {
    expect([TRIAL, ACTIVE, PAST_DUE].some(isReadOnlyStatus)).toBe(false);
    expect([SUSPENDED, CANCELED].every(isReadOnlyStatus)).toBe(true);
  });
});

describe('retenção após cancelamento', () => {
  it('dados excluídos 90 dias depois do cancelamento', () => {
    expect(dataPurgeAt(now)).toEqual(daysFromNow(90));
    expect(dataPurgeAt(null)).toBeNull();
    expect(purgeCutoff(now)).toEqual(daysFromNow(-90));
  });
});
