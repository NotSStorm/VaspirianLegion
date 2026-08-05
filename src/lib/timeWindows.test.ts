import { describe, expect, it } from 'vitest';
import { getWindowCutoff, isInTimeWindow } from './timeWindows';

describe('timeWindows', () => {
  it('uses a rolling 7-day window for weekly windows', () => {
    const now = new Date('2026-08-05T12:00:00');
    const cutoff = getWindowCutoff('weekly', now);

    expect(cutoff?.toISOString()).toBe(new Date('2026-07-29T12:00:00').toISOString());
    expect(isInTimeWindow(new Date('2026-07-29T12:00:01'), 'weekly', now)).toBe(true);
    expect(isInTimeWindow(new Date('2026-07-29T11:59:59'), 'weekly', now)).toBe(false);
  });

  it('uses a rolling 30-day window for monthly windows', () => {
    const now = new Date('2026-08-05T12:00:00');
    const cutoff = getWindowCutoff('monthly', now);

    expect(cutoff?.toISOString()).toBe(new Date('2026-07-06T12:00:00').toISOString());
    expect(isInTimeWindow(new Date('2026-07-06T12:00:01'), 'monthly', now)).toBe(true);
    expect(isInTimeWindow(new Date('2026-07-06T11:59:59'), 'monthly', now)).toBe(false);
  });
});
