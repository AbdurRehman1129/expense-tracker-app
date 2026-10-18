import { getDatabase } from './database';
import { RecurringExpense, RecurringFrequency } from '../types';
import { todayString, advanceByFrequency, parseDateString } from '../utils/date';

export async function getAllRecurringExpenses(): Promise<RecurringExpense[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecurringExpense>(
    'SELECT * FROM recurring_expenses ORDER BY next_due_date ASC'
  );
}

export async function addRecurringExpense(item: {
  amount: number;
  category_id: number;
  frequency: RecurringFrequency;
  payment_method?: string;
  note?: string;
  next_due_date: string;
  /** Day of month the item was started on (1-31). Lets monthly items return to the 31st after February. */
  anchor_day?: number;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO recurring_expenses (amount, category_id, frequency, payment_method, note, next_due_date, anchor_day, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      item.amount,
      item.category_id,
      item.frequency,
      item.payment_method ?? null,
      item.note ?? null,
      item.next_due_date,
      item.anchor_day ?? parseDateString(item.next_due_date).getDate(),
    ]
  );
  return result.lastInsertRowId;
}

export async function updateRecurringExpense(
  id: number,
  updates: Partial<RecurringExpense>
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<RecurringExpense>(
    'SELECT * FROM recurring_expenses WHERE id = ?',
    [id]
  );
  if (!existing) return;

  await db.runAsync(
    `UPDATE recurring_expenses
     SET amount = ?, category_id = ?, frequency = ?, payment_method = ?, note = ?, next_due_date = ?, is_active = ?
     WHERE id = ?`,
    [
      updates.amount ?? existing.amount,
      updates.category_id ?? existing.category_id,
      updates.frequency ?? existing.frequency,
      updates.payment_method ?? existing.payment_method,
      updates.note ?? existing.note,
      updates.next_due_date ?? existing.next_due_date,
      updates.is_active ?? existing.is_active,
      id,
    ]
  );
}

export async function deleteRecurringExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM recurring_expenses WHERE id = ?', [id]);
}

export async function togglePause(id: number, isActive: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE recurring_expenses SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    id,
  ]);
}

// Items that are due today or earlier, active, and not yet notified today
export async function getDueRecurringExpenses(): Promise<RecurringExpense[]> {
  const db = await getDatabase();
  const today = todayString();
  return db.getAllAsync<RecurringExpense>(
    `SELECT * FROM recurring_expenses
     WHERE is_active = 1
       AND next_due_date <= ?
       AND (last_notified_date IS NULL OR last_notified_date != ?)`,
    [today, today]
  );
}

export async function markNotifiedToday(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE recurring_expenses SET last_notified_date = ? WHERE id = ?', [
    todayString(),
    id,
  ]);
}

export async function advanceNextDueDate(id: number, frequency: RecurringFrequency, fromDate: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ anchor_day: number | null }>(
    'SELECT anchor_day FROM recurring_expenses WHERE id = ?',
    [id]
  );
  const newDate = advanceByFrequency(fromDate, frequency, row?.anchor_day);
  await db.runAsync(
    'UPDATE recurring_expenses SET next_due_date = ?, last_notified_date = NULL WHERE id = ?',
    [newDate, id]
  );
}