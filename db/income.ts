import { getDatabase } from './database';
import { Income } from '../types';

export async function getAllIncome(): Promise<Income[]> {
  const db = await getDatabase();
  return db.getAllAsync<Income>('SELECT * FROM income ORDER BY date DESC');
}

export async function getIncomeById(id: number): Promise<Income | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Income>('SELECT * FROM income WHERE id = ?', [id]);
}

export type IncomePageOptions = {
  limit?: number;
  offset?: number;
  /** Inclusive range, both required to apply. */
  start?: string;
  end?: string;
  /** Matches the source or note. */
  search?: string;
};

/** A page of income entries (newest first) for long lists. */
export async function getIncomePage(options: IncomePageOptions = {}): Promise<Income[]> {
  const db = await getDatabase();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (options.start && options.end) {
    where.push('date BETWEEN ? AND ?');
    params.push(options.start, options.end);
  }
  const search = options.search?.trim();
  if (search) {
    where.push('(source LIKE ? OR note LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const sql =
    `SELECT * FROM income${where.length ? ' WHERE ' + where.join(' AND ') : ''} ` +
    'ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(options.limit ?? 50, options.offset ?? 0);
  return db.getAllAsync<Income>(sql, params);
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

/** Updates only the fields you pass; everything else keeps its current value. */
export async function updateIncome(id: number, updates: Partial<Income>): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<Income>('SELECT * FROM income WHERE id = ?', [id]);
  if (!existing) return;

  const pick = <K extends keyof Income>(key: K): Income[K] =>
    (updates[key] !== undefined ? updates[key] : existing[key]) as Income[K];

  await db.runAsync(
    'UPDATE income SET amount = ?, source = ?, date = ?, note = ?, updated_at = ? WHERE id = ?',
    [pick('amount'), pick('source'), pick('date'), pick('note'), new Date().toISOString(), id]
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

/** Full income rows for CSV/PDF export. */
export async function getIncomeRowsForExport(
  startDate?: string,
  endDate?: string
): Promise<{ date: string; source: string | null; amount: number; note: string | null }[]> {
  const db = await getDatabase();
  let query = 'SELECT date, source, amount, note FROM income';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY date DESC';
  return db.getAllAsync(query, params);
}