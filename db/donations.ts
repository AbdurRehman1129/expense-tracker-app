import { getDatabase, runInTransaction } from './database';
import { Donation, DonationType } from '../types';
import { addExpense, updateExpense } from './expenses';
import { getRawRemaining } from './donationDues';
import { DbError } from './errors';
import { round2, toCents } from '../utils/money';

const DONATION_CATEGORY_NAME = 'Donation';

async function getDonationCategoryId(): Promise<number> {
  const db = await getDatabase();
  const cat = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ?',
    [DONATION_CATEGORY_NAME]
  );
  if (!cat) throw new Error('Donation category not found');
  return cat.id;
}

function expenseNote(type: DonationType, recipient: string | null | undefined): string {
  return `${type} donation${recipient ? ' to ' + recipient : ''}`;
}

function insufficient(remaining: number): DbError {
  return new DbError(
    'INSUFFICIENT_DUE',
    'This donation is more than what is left to donate.',
    { remaining: round2(Math.max(0, remaining)) }
  );
}

export async function getAllDonations(): Promise<Donation[]> {
  const db = await getDatabase();
  return db.getAllAsync<Donation>('SELECT * FROM donations ORDER BY date DESC, id DESC');
}

export async function getDonationById(id: number): Promise<Donation | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
}

export type DonationPageOptions = {
  limit?: number;
  offset?: number;
  type?: DonationType;
  /** Inclusive range, both required to apply. */
  start?: string;
  end?: string;
  /** Matches the recipient or note. */
  search?: string;
};

/** A page of donations (newest first) for long lists. */
export async function getDonationsPage(options: DonationPageOptions = {}): Promise<Donation[]> {
  const db = await getDatabase();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (options.type) {
    where.push('type = ?');
    params.push(options.type);
  }
  if (options.start && options.end) {
    where.push('date BETWEEN ? AND ?');
    params.push(options.start, options.end);
  }
  const search = options.search?.trim();
  if (search) {
    where.push('(recipient LIKE ? OR note LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const sql =
    `SELECT * FROM donations${where.length ? ' WHERE ' + where.join(' AND ') : ''} ` +
    'ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(options.limit ?? 50, options.offset ?? 0);
  return db.getAllAsync<Donation>(sql, params);
}

/**
 * Records a donation AND its linked expense in one all-or-nothing step.
 * Throws DbError('INSUFFICIENT_DUE') if it exceeds what is left to donate.
 */
export async function addDonation(donation: {
  type: DonationType;
  recipient?: string;
  amount: number;
  date: string;
  note?: string;
  linked_income_id?: number;
}): Promise<number> {
  const categoryId = await getDonationCategoryId();

  return runInTransaction(async () => {
    const db = await getDatabase();

    const remaining = await getRawRemaining(donation.type);
    if (toCents(donation.amount) > toCents(remaining)) throw insufficient(remaining);

    const expenseId = await addExpense({
      amount: donation.amount,
      category_id: categoryId,
      date: donation.date,
      note: expenseNote(donation.type, donation.recipient),
      source: 'donation',
    });

    const result = await db.runAsync(
      `INSERT INTO donations (type, recipient, amount, date, note, linked_income_id, linked_expense_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        donation.type,
        donation.recipient ?? null,
        donation.amount,
        donation.date,
        donation.note ?? null,
        donation.linked_income_id ?? null,
        expenseId,
      ]
    );

    await db.runAsync('UPDATE expenses SET linked_donation_id = ? WHERE id = ?', [
      result.lastInsertRowId,
      expenseId,
    ]);

    return result.lastInsertRowId;
  });
}

/**
 * Edits a donation and keeps its linked expense in sync (the expense keeps its
 * category). Fields you don't pass are left unchanged.
 * Throws DbError('INSUFFICIENT_DUE') if the new amount/type doesn't fit.
 */
export async function updateDonation(id: number, updates: Partial<Donation>): Promise<void> {
  await runInTransaction(async () => {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
    if (!existing) return;

    const type = updates.type ?? existing.type;
    const amount = updates.amount ?? existing.amount;
    const recipient = updates.recipient !== undefined ? updates.recipient : existing.recipient;
    const date = updates.date ?? existing.date;
    const note = updates.note !== undefined ? updates.note : existing.note;

    // Room available = what is left, plus this donation's own old amount if it stays in the same type.
    const room = (await getRawRemaining(type)) + (type === existing.type ? existing.amount : 0);
    if (toCents(amount) > toCents(room)) throw insufficient(room);

    await db.runAsync(
      `UPDATE donations SET type = ?, recipient = ?, amount = ?, date = ?, note = ?, updated_at = ? WHERE id = ?`,
      [type, recipient, amount, date, note, new Date().toISOString(), id]
    );

    if (existing.linked_expense_id) {
      await updateExpense(existing.linked_expense_id, {
        amount,
        date,
        note: expenseNote(type, recipient),
      });
    }
  });
}

/** Deletes a donation and its linked expense together. */
export async function deleteDonation(id: number): Promise<void> {
  await runInTransaction(async () => {
    const db = await getDatabase();
    const donation = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
    if (!donation) return;

    // The donation points at its expense, so remove the donation first.
    await db.runAsync('DELETE FROM donations WHERE id = ?', [id]);
    if (donation.linked_expense_id) {
      await db.runAsync('DELETE FROM expenses WHERE id = ?', [donation.linked_expense_id]);
    }
  });
}

export async function getDonationTotals(
  type: DonationType,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const db = await getDatabase();
  let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE type = ?';
  const params: (string | number)[] = [type];

  if (startDate && endDate) {
    query += ' AND date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const result = await db.getFirstAsync<{ total: number }>(query, params);
  return result?.total ?? 0;
}

/** Full donation rows for CSV/PDF export. */
export async function getDonationRowsForExport(
  startDate?: string,
  endDate?: string
): Promise<{ date: string; type: DonationType; recipient: string | null; amount: number; note: string | null }[]> {
  const db = await getDatabase();
  let query = 'SELECT date, type, recipient, amount, note FROM donations';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY date DESC';
  return db.getAllAsync(query, params);
}
