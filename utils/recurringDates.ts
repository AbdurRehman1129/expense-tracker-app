import { advanceByFrequency } from './date';

type DueItem = {
  next_due_date: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  anchor_day: number | null;
};

/**
 * Every due date of a recurring item up to and including `today`, oldest first.
 * Normally one date; several if the app wasn't opened for a while, so missed
 * cycles are not silently lost.
 */
export function getMissedDueDates(item: DueItem, today: string): string[] {
  const dates: string[] = [];
  let d = item.next_due_date;
  while (d <= today && dates.length < 366) {
    dates.push(d);
    d = advanceByFrequency(d, item.frequency, item.anchor_day);
  }
  return dates;
}
