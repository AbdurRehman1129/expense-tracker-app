import { getDatabase } from './database';

const TABLES = [
  'categories',
  'expenses',
  'income',
  'donations',
  'donation_dues',
  'recurring_expenses',
  'budgets',
  'settings',
] as const;

export async function exportAllData(): Promise<string> {
  const db = await getDatabase();
  const data: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }

  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data });
}

export async function importAllData(jsonString: string): Promise<void> {
  const parsed = JSON.parse(jsonString);
  const data = parsed.data as Record<string, Record<string, unknown>[]>;
  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');
  try {
    // Delete in reverse-dependency order, insert in forward-dependency order
    const deleteOrder = [...TABLES].reverse();
    for (const table of deleteOrder) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const table of TABLES) {
      const rows = data[table] ?? [];
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((c) => row[c]);
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | null)[]
        );
      }
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }
}