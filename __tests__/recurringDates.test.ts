import { getMissedDueDates } from '../utils/recurringDates';

describe('getMissedDueDates', () => {
  it('returns one date when exactly due today', () => {
    expect(
      getMissedDueDates({ next_due_date: '2026-10-17', frequency: 'monthly', anchor_day: 17 }, '2026-10-17')
    ).toEqual(['2026-10-17']);
  });

  it('returns nothing when the next due date is in the future', () => {
    expect(
      getMissedDueDates({ next_due_date: '2026-10-18', frequency: 'weekly', anchor_day: null }, '2026-10-17')
    ).toEqual([]);
  });

  it('catches up every missed weekly cycle', () => {
    expect(
      getMissedDueDates({ next_due_date: '2026-09-26', frequency: 'weekly', anchor_day: null }, '2026-10-17')
    ).toEqual(['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17']);
  });

  it('catches up missed monthly cycles from the 31st without drifting', () => {
    expect(
      getMissedDueDates({ next_due_date: '2026-01-31', frequency: 'monthly', anchor_day: 31 }, '2026-04-30')
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
});
