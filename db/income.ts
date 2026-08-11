import { getDatabase } from './database';
import { Income } from '../types';

export async function getAllIncome(): Promise<Income[]> {
  const db = await getDatabase();
  return db.getAllAsync<Income>('SELECT * FROM income ORDER BY date DESC');
}

export async function addIncome(income: {
  amount: number;
  source?: string;
  date: string;
  note?: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO income (amount, source, date, note) VALUES (?, ?, ?, ?)',
    [income.amount, income.source ?? null, income.date, income.note ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateIncome(id: number, updates: Partial<Income>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE income SET amount = ?, source = ?, date = ?, note = ? WHERE id = ?',
    [updates.amount ?? null, updates.source ?? null, updates.date ?? null, updates.note ?? null, id]
  );
}

export async function deleteIncome(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM income WHERE id = ?', [id]);
}

export async function getTotalIncome(startDate?: string, endDate?: string): Promise<number> {
  const db = await getDatabase();
  let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM income';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const result = await db.getFirstAsync<{ total: number }>(query, params);
  return result?.total ?? 0;
}