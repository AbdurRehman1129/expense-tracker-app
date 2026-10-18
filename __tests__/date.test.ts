import {
  toDateString,
  todayString,
  parseDateString,
  monthRange,
  getMonthRange,
  getYearRange,
  addDays,
  addMonthsClamped,
  advanceByFrequency,
} from '../utils/date';

// Run under several timezones (see "test:tz" in package.json). The old code only
// failed in timezones AHEAD of UTC, so every assertion here must hold in all of them.

afterEach(() => {
  jest.useRealTimers();
});

describe('toDateString / parseDateString', () => {
  it('round-trips a date without shifting it', () => {
    for (const s of ['2026-10-31', '2026-01-01', '2028-02-29', '2026-12-31']) {
      expect(toDateString(parseDateString(s))).toBe(s);
    }
  });

  it('uses the local calendar day, not the UTC day', () => {
    const lateNight = new Date(2026, 9, 17, 0, 30, 0); // 17 Oct 00:30 LOCAL
    expect(toDateString(lateNight)).toBe('2026-10-17');
    const justBeforeMidnight = new Date(2026, 9, 17, 23, 59, 0);
    expect(toDateString(justBeforeMidnight)).toBe('2026-10-17');
  });
});

describe('todayString', () => {
  it('returns the local date at 00:30 (the "after 12 am" bug)', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 0, 30, 0));
    expect(todayString()).toBe('2026-10-17');
  });

  it('returns the local date at 23:59', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 23, 59, 0));
    expect(todayString()).toBe('2026-10-17');
  });
});

describe('monthRange', () => {
  it('includes the 31st in October and starts November on the 1st (the "31st" bug)', () => {
    expect(monthRange(2026, 9)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthRange(2026, 10)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('handles February in normal and leap years', () => {
    expect(monthRange(2026, 1).end).toBe('2026-02-28');
    expect(monthRange(2028, 1).end).toBe('2028-02-29');
  });

  it('rolls over the year boundary', () => {
    expect(monthRange(2026, 11)).toEqual({ start: '2026-12-01', end: '2026-12-31' });
    expect(monthRange(2026, 12)).toEqual({ start: '2027-01-01', end: '2027-01-31' });
    expect(monthRange(2026, -1)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
});

describe('getMonthRange / getYearRange', () => {
  it('current, previous and next month relative to "now"', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 31, 0, 10, 0)); // 31 Jan, 00:10
    expect(getMonthRange()).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    expect(getMonthRange(-1)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(getMonthRange(1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('year range is Jan 1 to Dec 31', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    expect(getYearRange()).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('addMonthsClamped', () => {
  it('does not overflow: Jan 31 + 1 month = Feb 28 (not Mar 3)', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('returns to the 31st using the anchor day', () => {
    expect(addMonthsClamped('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-03-31', 1, 31)).toBe('2026-04-30');
  });

  it('keeps a monthly schedule from the 31st for 12 months', () => {
    let d = '2026-01-31';
    const seen: string[] = [d];
    for (let i = 0; i < 12; i++) {
      d = advanceByFrequency(d, 'monthly', 31);
      seen.push(d);
    }
    expect(seen).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
      '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31',
      '2027-01-31',
    ]);
  });
});

describe('advanceByFrequency', () => {
  it('daily and weekly', () => {
    expect(advanceByFrequency('2026-10-31', 'daily')).toBe('2026-11-01');
    expect(advanceByFrequency('2026-10-31', 'weekly')).toBe('2026-11-07');
  });
});
