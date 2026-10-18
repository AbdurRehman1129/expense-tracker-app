/**
 * Local-time date helpers.
 *
 * IMPORTANT: never use `date.toISOString().split('T')[0]` to get a calendar day.
 * `toISOString()` converts to UTC, so on a phone in UTC+5 (e.g. Pakistan) local
 * midnight becomes "yesterday 19:00 UTC" and the date comes out one day early.
 * Everything here works with local year/month/day numbers instead.
 *
 * Dates are stored in the database as 'YYYY-MM-DD' strings (they sort and
 * compare correctly as text, so `BETWEEN start AND end` works).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a Date as 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar day as 'YYYY-MM-DD'. */
export function todayString(): string {
  return toDateString(new Date());
}

/** 'YYYY-MM-DD' -> Date at LOCAL midnight (never UTC). */
export function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * First and last day of a month. `monthIndex` is 0-based and may overflow
 * (-1 = December of the previous year, 12 = January of the next year).
 */
export function monthRange(year: number, monthIndex: number): { start: string; end: string } {
  const first = new Date(year, monthIndex, 1); // normalises overflow
  const y = first.getFullYear();
  const m = first.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}

/** Current month (offset 0), previous month (-1), next month (+1), ... */
export function getMonthRange(offset = 0): { start: string; end: string } {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + offset);
}

export function getPreviousMonthRange(): { start: string; end: string } {
  return getMonthRange(-1);
}

export function getYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

/** Adds days to a 'YYYY-MM-DD' string (negative allowed). */
export function addDays(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/**
 * Adds `n` months without overflowing into the following month:
 * Jan 31 + 1 month = Feb 28 (or 29), NOT Mar 3.
 * Pass `anchorDay` (the original day of month, e.g. 31) so later months
 * return to the 31st: Jan 31 -> Feb 28 -> Mar 31.
 */
export function addMonthsClamped(dateStr: string, n: number, anchorDay?: number): string {
  const d = parseDateString(dateStr);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateString(target);
}

/** Next due date for a recurring item. `anchorDay` is only used for 'monthly'. */
export function advanceByFrequency(
  dateStr: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  anchorDay?: number | null
): string {
  if (frequency === 'daily') return addDays(dateStr, 1);
  if (frequency === 'weekly') return addDays(dateStr, 7);
  return addMonthsClamped(dateStr, 1, anchorDay ?? undefined);
}
