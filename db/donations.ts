import { getDatabase } from './database';
import { Donation, DonationType } from '../types';
import { addExpense, deleteExpense, updateExpense } from './expenses';
import { reduceDueAmount, restoreDueAmount } from './donationDues';

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

  // Subtract this donation from "To Be Donated" (consumes oldest due entries first)
  await reduceDueAmount(donation.type, donation.amount);

  return result.lastInsertRowId;
}

export async function updateDonation(id: number, updates: Partial<Donation>): Promise<void> {
  const db = await getDatabase();
  const donation = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
  if (!donation) return;

  const newType = updates.type ?? donation.type;
  const newAmount = updates.amount ?? donation.amount;

  await db.runAsync(
    'UPDATE donations SET type = ?, recipient = ?, amount = ?, date = ?, note = ? WHERE id = ?',
    [
      newType,
      updates.recipient ?? donation.recipient,
      newAmount,
      updates.date ?? donation.date,
      updates.note ?? donation.note,
      id,
    ]
  );

  // Keep linked expense in sync
  if (donation.linked_expense_id) {
    await updateExpense(donation.linked_expense_id, {
      amount: newAmount,
      date: updates.date ?? donation.date,
      note: `${newType} donation${(updates.recipient ?? donation.recipient) ? ' to ' + (updates.recipient ?? donation.recipient) : ''}`,
    });
  }

  // If the type or amount changed, undo the old consumption and re-apply with new values
  if (newType !== donation.type || newAmount !== donation.amount) {
    await restoreDueAmount(donation.type, donation.amount, donation.date, 'Restored (donation edited)');
    await reduceDueAmount(newType, newAmount);
  }
}

export async function deleteDonation(id: number): Promise<void> {
  const db = await getDatabase();
  const donation = await db.getFirstAsync<Donation>('SELECT * FROM donations WHERE id = ?', [id]);
  if (!donation) return;

  if (donation.linked_expense_id) {
    await deleteExpense(donation.linked_expense_id);
  }

  // Give the donated amount back to "To Be Donated"
  await restoreDueAmount(donation.type, donation.amount, donation.date, 'Restored (donation deleted)');

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