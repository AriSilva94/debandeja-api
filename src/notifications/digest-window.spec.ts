import { previousDayWindow } from './digest-window';

describe('previousDayWindow', () => {
  it('às 08:00 de Brasília resume o dia anterior inteiro', () => {
    const window = previousDayWindow(new Date('2026-09-24T11:00:00Z'));
    expect(window.start.toISOString()).toBe('2026-09-23T03:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-09-24T03:00:00.000Z');
    expect(window.label).toBe('23/09/2026');
  });

  it('usa a data de Brasília mesmo quando em UTC já é outro dia', () => {
    const window = previousDayWindow(new Date('2026-09-25T01:30:00Z'));
    expect(window.label).toBe('23/09/2026');
  });
});
