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

function todayStringForCheck() {
  return new Date().toISOString().split('T')[0];
}

/** Whether at least one expense has already been logged today (any category, manual or donation). */
export async function hasExpenseLoggedToday(): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM expenses WHERE date = ?',
    [todayStringForCheck()]
  );
  return (result?.count ?? 0) > 0;
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

export async function getExpensesByCategory(
  startDate?: string,
  endDate?: string
): Promise<{ category_id: number; category_name: string; total: number }[]> {
  const db = await getDatabase();
  let query = `
    SELECT e.category_id, c.name as category_name, SUM(e.amount) as total
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
  `;
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE e.date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ' GROUP BY e.category_id ORDER BY total DESC';

  return db.getAllAsync<{ category_id: number; category_name: string; total: number }>(
    query,
    params
  );
}

/**
 * Total expenses grouped by month (YYYY-MM), for the last `months` months
 * including the current one. Months with no expenses are still included with total 0.
 */
export async function getMonthlyExpenseTrend(
  months: number
): Promise<{ month: string; total: number }[]> {
  const db = await getDatabase();
  const now = new Date();
  const buckets: { month: string; total: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ month: key, total: 0 });
  }

  const earliest = buckets[0].month;
  const rows = await db.getAllAsync<{ month: string; total: number }>(
    `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
     FROM expenses
     WHERE strftime('%Y-%m', date) >= ?
     GROUP BY month`,
    [earliest]
  );

  const rowMap = new Map(rows.map((r) => [r.month, r.total]));
  return buckets.map((b) => ({ month: b.month, total: rowMap.get(b.month) ?? 0 }));
}

/** Full expense rows with category name, for CSV/PDF export. */
export async function getExpenseRowsForExport(
  startDate?: string,
  endDate?: string
): Promise<
  { date: string; category_name: string; amount: number; payment_method: string | null; note: string | null; source: string }[]
> {
  const db = await getDatabase();
  let query = `
    SELECT e.date, c.name as category_name, e.amount, e.payment_method, e.note, e.source
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
  `;
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE e.date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY e.date DESC';

  return db.getAllAsync(query, params);
}