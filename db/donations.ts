import { getDatabase } from './database';
import { Donation, DonationType } from '../types';
import { addExpense, deleteExpense, updateExpense } from './expenses';

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

export async function getAllDonations(): Promise<Donation[]> {
  const db = await getDatabase();
  return db.getAllAsync<Donation>('SELECT * FROM donations ORDER BY date DESC');
}

export async function addDonation(donation: {
  type: DonationType;
  recipient?: string;
  amount: number;
  date: string;
  note?: string;
  linked_income_id?: number;
}): Promise<number> {
  const db = await getDatabase();
  const categoryId = await getDonationCategoryId();

  // Create linked expense first
  const expenseId = await addExpense({
    amount: donation.amount,
    category_id: categoryId,
    date: donation.date,
    note: `${donation.type} donation${donation.recipient ? ' to ' + donation.recipient : ''}`,
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

  // Link the expense back to this donation
  await db.runAsync('UPDATE expenses SET linked_donation_id = ? WHERE id = ?', [
    result.lastInsertRowId,
    expenseId,
  ]);

  return result.lastInsertRowId;
}

export async function updateDonation(id: number, updates: Partial<Donation>): Promise<void> {
  const db = await getDatabase();
  const donation = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
  if (!donation) return;

  await db.runAsync(
    'UPDATE donations SET type = ?, recipient = ?, amount = ?, date = ?, note = ? WHERE id = ?',
    [
      updates.type ?? donation.type,
      updates.recipient ?? donation.recipient,
      updates.amount ?? donation.amount,
      updates.date ?? donation.date,
      updates.note ?? donation.note,
      id,
    ]
  );

  // Keep linked expense in sync
  if (donation.linked_expense_id) {
    await updateExpense(donation.linked_expense_id, {
      amount: updates.amount ?? donation.amount,
      date: updates.date ?? donation.date,
      note: `${updates.type ?? donation.type} donation${(updates.recipient ?? donation.recipient) ? ' to ' + (updates.recipient ?? donation.recipient) : ''}`,
    });
  }
}

export async function deleteDonation(id: number): Promise<void> {
  const db = await getDatabase();
  const donation = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
  if (!donation) return;

  if (donation.linked_expense_id) {
    await deleteExpense(donation.linked_expense_id);
  }
  await db.runAsync('DELETE FROM donations WHERE id = ?', [id]);
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