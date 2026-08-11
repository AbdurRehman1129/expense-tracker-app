import { getDatabase } from './database';
import { Expense } from '../types';

export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>('SELECT * FROM expenses ORDER BY date DESC');
}

export async function addExpense(expense: {
  amount: number;
  category_id: number;
  date: string;
  note?: string;
  payment_method?: string;
  source?: 'manual' | 'donation';
  linked_donation_id?: number;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO expenses (amount, category_id, date, note, payment_method, source, linked_donation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.amount,
      expense.category_id,
      expense.date,
      expense.note ?? null,
      expense.payment_method ?? null,
      expense.source ?? 'manual',
      expense.linked_donation_id ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateExpense(id: number, updates: Partial<Expense>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses SET amount = ?, category_id = ?, date = ?, note = ?, payment_method = ? WHERE id = ?`,
    [updates.amount ?? null, updates.category_id ?? null, updates.date ?? null, updates.note ?? null, updates.payment_method ?? null, id, ]
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  const expense = await db.getFirstAsync<{ linked_donation_id: number | null }>(
    'SELECT linked_donation_id FROM expenses WHERE id = ?',
    [id]
  );
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  if (expense?.linked_donation_id) {
    await db.runAsync('DELETE FROM donations WHERE id = ?', [expense.linked_donation_id]);
  }
}

export async function getTotalExpenses(startDate?: string, endDate?: string): Promise<number> {
  const db = await getDatabase();
  let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const result = await db.getFirstAsync<{ total: number }>(query, params);
  return result?.total ?? 0;
}