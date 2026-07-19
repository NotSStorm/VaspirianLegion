export type TimeWindow = 'weekly' | 'monthly' | 'all-time';

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateSafe(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getWindowCutoff(window: TimeWindow, now = new Date()): Date | null {
  if (window === 'all-time') {
    return null;
  }

  const days = window === 'weekly' ? 7 : 30;
  return new Date(now.getTime() - days * DAY_MS);
}

export function isInTimeWindow(date: Date, window: TimeWindow, now = new Date()): boolean {
  const cutoff = getWindowCutoff(window, now);
  if (!cutoff) {
    return true;
  }

  return date >= cutoff;
}
