import { TRIAL_DAYS } from './billing';

describe('billing constants', () => {
  it('define sete dias para o período de teste', () => {
    expect(TRIAL_DAYS).toBe(7);
  });
});
