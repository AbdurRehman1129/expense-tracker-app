import { getDatabase } from './database';
import { Category } from '../types';

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name');
}

export async function addCategory(name: string, icon: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, is_default) VALUES (?, ?, 0)',
    [name, icon]
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDatabase();

  // Never allow a default/system category to be deleted
  const category = await db.getFirstAsync<{ is_default: number }>(
    'SELECT is_default FROM categories WHERE id = ?',
    [id]
  );

  if (!category) {
    throw new Error('Category not found.');
  }

  if (category.is_default === 1) {
    throw new Error('Default categories cannot be deleted.');
  }

  // Check whether this category is already being used
  const usage = await db.getFirstAsync<{
    expense_count: number;
    budget_count: number;
  }>(
    `
    SELECT
      (SELECT COUNT(*) FROM expenses WHERE category_id = ?) AS expense_count,
      (SELECT COUNT(*) FROM budgets WHERE category_id = ?) AS budget_count
    `,
    [id, id]
  );

  if (
    (usage?.expense_count ?? 0) > 0 ||
    (usage?.budget_count ?? 0) > 0
  ) {
    throw new Error(
      'This category is already being used by an expense or budget.'
    );
  }

  await db.runAsync(
    'DELETE FROM categories WHERE id = ?',
    [id]
  );
}