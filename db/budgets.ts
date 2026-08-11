import { getDatabase } from './database';
import { Budget } from '../types';

export async function getAllBudgets(): Promise<Budget[]> {
  const db = await getDatabase();
  return db.getAllAsync<Budget>('SELECT * FROM budgets');
}

export async function getBudgetForCategory(categoryId: number): Promise<Budget | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE category_id = ?',
    [categoryId]
  );
  return result ?? null;
}

export async function setBudget(categoryId: number, monthlyLimit: number): Promise<void> {
  const db = await getDatabase();
  const existing = await getBudgetForCategory(categoryId);

  if (existing) {
    await db.runAsync('UPDATE budgets SET monthly_limit = ? WHERE category_id = ?', [
      monthlyLimit,
      categoryId,
    ]);
  } else {
    await db.runAsync('INSERT INTO budgets (category_id, monthly_limit) VALUES (?, ?)', [
      categoryId,
      monthlyLimit,
    ]);
  }
}

export async function deleteBudget(categoryId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM budgets WHERE category_id = ?', [categoryId]);
}