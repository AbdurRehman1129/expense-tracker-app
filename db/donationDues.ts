import { getDatabase } from './database';
import { DonationDue, DonationType } from '../types';

export async function getAllDonationDues(): Promise<DonationDue[]> {
  const db = await getDatabase();
  return db.getAllAsync<DonationDue>('SELECT * FROM donation_dues ORDER BY date DESC');
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

export async function deleteDonationDue(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM donation_dues WHERE id = ?', [id]);
}

export async function getDueTotals(
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

/**
 * Consume `amount` worth of "due" from the oldest due entries of `type` first (FIFO).
 * Entries are fully deleted once used up, or reduced if only partially consumed.
 * Call this whenever a donation is actually given, so "To Be Donated" reflects
 * what's actually left to give (not just a display-time subtraction).
 */
export async function reduceDueAmount(type: DonationType, amount: number): Promise<void> {
  if (amount <= 0) return;
  const db = await getDatabase();

  let remaining = amount;
  const dues = await db.getAllAsync<DonationDue>(
    'SELECT * FROM donation_dues WHERE type = ? ORDER BY date ASC, id ASC',
    [type]
  );

  for (const due of dues) {
    if (remaining <= 0) break;

    if (due.amount <= remaining + 1e-9) {
      remaining -= due.amount;
      await db.runAsync('DELETE FROM donation_dues WHERE id = ?', [due.id]);
    } else {
      await db.runAsync('UPDATE donation_dues SET amount = ? WHERE id = ?', [
        due.amount - remaining,
        due.id,
      ]);
      remaining = 0;
    }
  }
  // If remaining > 0 here, more was donated than was on record as due (shouldn't
  // happen since the UI blocks over-donating), so there's simply nothing left to consume.
}

/**
 * Adds `amount` back as a new due entry of `type`. Used to undo reduceDueAmount
 * when a donation is deleted or edited.
 */
export async function restoreDueAmount(
  type: DonationType,
  amount: number,
  date: string,
  note?: string
): Promise<void> {
  if (amount <= 0) return;
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO donation_dues (type, amount, date, note) VALUES (?, ?, ?, ?)',
    [type, amount, date, note ?? 'Restored (donation deleted/edited)']
  );
}