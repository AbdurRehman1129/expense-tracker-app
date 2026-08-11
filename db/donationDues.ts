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