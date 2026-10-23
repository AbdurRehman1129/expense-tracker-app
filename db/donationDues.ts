import { getDatabase, runInTransaction } from './database';
import { DonationDue, DonationType } from '../types';
import { DbError } from './errors';
import { round2, toCents } from '../utils/money';

/**
 * LEDGER MODEL
 * A "due" is a pledge: how much you decided to donate. Pledges are never
 * deleted or shrunk when you give. What is left to give is simply:
 *
 *   remaining(type) = SUM(donation_dues) - SUM(donations)
 *
 * so editing or deleting a donation can never corrupt the numbers.
 */

export async function getAllDonationDues(): Promise<DonationDue[]> {
  const db = await getDatabase();
  return db.getAllAsync<DonationDue>('SELECT * FROM donation_dues ORDER BY date DESC, id DESC');
}

export async function getDonationDueById(id: number): Promise<DonationDue | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DonationDue>('SELECT * FROM donation_dues WHERE id = ?', [id]);
}

/**
 * The automatic row the v2 migration adds per type ("pledges you already gave").
 * It keeps old numbers correct, so it can't be edited or deleted by hand.
 */
export function isMigrationDue(due: Pick<DonationDue, 'note'>): boolean {
  return (due.note ?? '').startsWith('Migration:');
}

export async function addDonationDue(due: {
  type: DonationType;
  amount: number;
  date: string;
  note?: string;
  linked_income_id?: number;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO donation_dues (type, amount, date, note, linked_income_id) VALUES (?, ?, ?, ?, ?)',
    [due.type, due.amount, due.date, due.note ?? null, due.linked_income_id ?? null]
  );
  return result.lastInsertRowId;
}

/** Total pledged for a type (optionally within a date range). */
export async function getPledgedTotal(
  type: DonationType,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const db = await getDatabase();
  let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM donation_dues WHERE type = ?';
  const params: (string | number)[] = [type];

  if (startDate && endDate) {
    query += ' AND date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const result = await db.getFirstAsync<{ total: number }>(query, params);
  return result?.total ?? 0;
}

/** pledged - given, NOT clamped (can be negative if data is inconsistent). */
export async function getRawRemaining(type: DonationType): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pledged: number; given: number }>(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM donation_dues WHERE type = ?) AS pledged,
       (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE type = ?) AS given`,
    [type, type]
  );
  return round2((row?.pledged ?? 0) - (row?.given ?? 0));
}

/** What is still "To Be Donated" for a type (never below 0). */
export async function getRemaining(type: DonationType): Promise<number> {
  return Math.max(0, await getRawRemaining(type));
}

/**
 * Deleting a pledge is only allowed if what was already given still fits in
 * the remaining pledges (otherwise "To Be Donated" would go negative).
 */
export async function deleteDonationDue(id: number): Promise<void> {
  await runInTransaction(async () => {
    const db = await getDatabase();
    const due = await db.getFirstAsync<DonationDue>('SELECT * FROM donation_dues WHERE id = ?', [id]);
    if (!due) return;
    if (isMigrationDue(due)) {
      throw new DbError('LOCKED_ENTRY', 'This automatic entry cannot be deleted.');
    }

    const remainingAfter = (await getRawRemaining(due.type)) - due.amount;
    if (toCents(remainingAfter) < 0) {
      throw new DbError(
        'DUE_IN_USE',
        'This pledge has already been donated and cannot be deleted.',
        { shortBy: round2(-remainingAfter) }
      );
    }
    await db.runAsync('DELETE FROM donation_dues WHERE id = ?', [id]);
  });
}

/**
 * Edits a pledge. The change is refused if it would leave less pledged than
 * has already been donated (so "To Be Donated" can never go negative).
 */
export async function updateDonationDue(
  id: number,
  updates: { type?: DonationType; amount?: number; date?: string; note?: string | null }
): Promise<void> {
  await runInTransaction(async () => {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<DonationDue>('SELECT * FROM donation_dues WHERE id = ?', [id]);
    if (!existing) return;

    if (isMigrationDue(existing)) {
      throw new DbError('LOCKED_ENTRY', 'This automatic entry cannot be edited.');
    }

    const type = updates.type ?? existing.type;
    const amount = updates.amount ?? existing.amount;
    const date = updates.date ?? existing.date;
    const note = updates.note !== undefined ? updates.note : existing.note;

    // Remaining of the ORIGINAL type once this pledge is taken out of it...
    let remainingAfter = (await getRawRemaining(existing.type)) - existing.amount;
    // ...plus the new amount if it stays in that same type.
    if (type === existing.type) remainingAfter += amount;

    if (toCents(remainingAfter) < 0) {
      throw new DbError(
        'DUE_IN_USE',
        'Part of this pledge has already been donated, so it cannot be reduced that far.',
        { shortBy: round2(-remainingAfter) }
      );
    }

    await db.runAsync(
      'UPDATE donation_dues SET type = ?, amount = ?, date = ?, note = ?, updated_at = ? WHERE id = ?',
      [type, amount, date, note, new Date().toISOString(), id]
    );
  });
}
