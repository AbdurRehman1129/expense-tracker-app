/** @jest-environment node */
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => require('../test-utils/dbState').state.current,
}));

import { setupFreshDb } from '../test-utils/setupDb';
import {
  addDonation,
  deleteDonation,
  getAllDonations,
  getDonationById,
  getDonationsPage,
  getDonationTotals,
  updateDonation,
} from '../db/donations';
import {
  addDonationDue,
  deleteDonationDue,
  getAllDonationDues,
  getDonationDueById,
  getPledgedTotal,
  getRemaining,
  isMigrationDue,
  updateDonationDue,
} from '../db/donationDues';
import { addExpense, deleteExpense, getAllExpenses, getTotalExpenses } from '../db/expenses';
import { DbError, isDbError } from '../db/errors';

const pledge = (type: 'zakat' | 'sadqa', amount: number) =>
  addDonationDue({ type, amount, date: '2026-10-01' });
const give = (type: 'zakat' | 'sadqa', amount: number, extra: { recipient?: string; note?: string } = {}) =>
  addDonation({ type, amount, date: '2026-10-05', ...extra });

let ctx: Awaited<ReturnType<typeof setupFreshDb>>;
beforeEach(async () => {
  ctx = await setupFreshDb();
});

describe('To Be Donated (ledger model)', () => {
  it('remaining = pledged - given, and pledges are never consumed', async () => {
    await pledge('sadqa', 1000);
    await give('sadqa', 600);

    expect(await getRemaining('sadqa')).toBe(400);
    expect(await getPledgedTotal('sadqa')).toBe(1000); // still 1000: history is intact
    expect(await getAllDonationDues()).toHaveLength(1);
  });

  it('keeps zakat and sadqa separate', async () => {
    await pledge('zakat', 250);
    await pledge('sadqa', 1000);
    await give('zakat', 100);

    expect(await getRemaining('zakat')).toBe(150);
    expect(await getRemaining('sadqa')).toBe(1000);
  });

  it('creates the linked expense in the Donation category', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 600, { recipient: 'Edhi' });

    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      amount: 600,
      category_id: ctx.categories.donation,
      source: 'donation',
      linked_donation_id: id,
    });
    expect(await getTotalExpenses()).toBe(600);
  });
});

describe('over-donating is refused', () => {
  it('rejects more than what is left and saves nothing', async () => {
    await pledge('sadqa', 1000);
    await give('sadqa', 600);

    const attempt = give('sadqa', 500);
    await expect(attempt).rejects.toBeInstanceOf(DbError);
    await attempt.catch((e) => {
      expect(isDbError(e, 'INSUFFICIENT_DUE')).toBe(true);
      expect(e.details.remaining).toBe(400);
    });

    expect(await getAllDonations()).toHaveLength(1);
    expect(await getAllExpenses()).toHaveLength(1);
    expect(await getRemaining('sadqa')).toBe(400);
  });

  it('allows exactly the remaining amount, even with float noise', async () => {
    await pledge('sadqa', 0.1);
    await pledge('sadqa', 0.2);
    await expect(give('sadqa', 0.3)).resolves.toBeGreaterThan(0); // 0.1 + 0.2 !== 0.3 in floats
    expect(await getRemaining('sadqa')).toBe(0);
  });

  it('refuses when nothing was pledged at all', async () => {
    await expect(give('zakat', 10)).rejects.toMatchObject({ code: 'INSUFFICIENT_DUE' });
  });

  it('two quick taps cannot overspend: one wins, one is refused', async () => {
    await pledge('sadqa', 1000);

    const results = await Promise.allSettled([give('sadqa', 600), give('sadqa', 600)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(isDbError(rejected.reason, 'INSUFFICIENT_DUE')).toBe(true);
    expect(await getAllDonations()).toHaveLength(1);
    expect(await getRemaining('sadqa')).toBe(400);
  });
});

describe('all-or-nothing saves', () => {
  it('a failure half-way leaves no orphan expense', async () => {
    await pledge('sadqa', 1000);
    // Make the donation insert fail AFTER the expense row has been created.
    await ctx.db.execAsync(
      "CREATE TRIGGER fail_donation BEFORE INSERT ON donations BEGIN SELECT RAISE(ABORT, 'boom'); END;"
    );

    await expect(give('sadqa', 100)).rejects.toBeTruthy();

    expect(await getAllExpenses()).toHaveLength(0);
    expect(await getAllDonations()).toHaveLength(0);
    expect(await getRemaining('sadqa')).toBe(1000);
  });
});

describe('deleting', () => {
  it('deleting a donation removes its expense and gives the amount back', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 600);

    await deleteDonation(id);

    expect(await getAllDonations()).toHaveLength(0);
    expect(await getAllExpenses()).toHaveLength(0);
    expect(await getRemaining('sadqa')).toBe(1000);
  });

  it('deleting the expense from the expense list removes the donation and restores the amount', async () => {
    await pledge('sadqa', 1000);
    await give('sadqa', 600);
    const [expense] = await getAllExpenses();

    await deleteExpense(expense.id);

    expect(await getAllDonations()).toHaveLength(0);
    expect(await getRemaining('sadqa')).toBe(1000);
  });

  it('deleting an ordinary expense does not touch donations', async () => {
    await pledge('sadqa', 1000);
    await give('sadqa', 600);
    const food = await addExpense({ amount: 50, category_id: ctx.categories.food, date: '2026-10-05' });

    await deleteExpense(food);

    expect(await getAllDonations()).toHaveLength(1);
    expect(await getRemaining('sadqa')).toBe(400);
  });
});

describe('editing a donation', () => {
  it('a partial edit (note only) keeps the amount and the expense category', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 600, { recipient: 'Edhi' });

    await updateDonation(id, { note: 'for flood relief' });

    const [donation] = await getAllDonations();
    expect(donation).toMatchObject({ amount: 600, recipient: 'Edhi', note: 'for flood relief' });
    const [expense] = await getAllExpenses();
    expect(expense.category_id).toBe(ctx.categories.donation); // the old bug set this to NULL
    expect(expense.amount).toBe(600);
  });

  it('changing the amount updates the linked expense and the remaining', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 600);

    await updateDonation(id, { amount: 900 });

    expect(await getDonationTotals('sadqa')).toBe(900);
    expect((await getAllExpenses())[0].amount).toBe(900);
    expect(await getRemaining('sadqa')).toBe(100);
  });

  it('refuses an increase beyond what is left', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 600);

    await expect(updateDonation(id, { amount: 1200 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_DUE',
    });
    expect((await getAllDonations())[0].amount).toBe(600);
    expect((await getAllExpenses())[0].amount).toBe(600);
  });

  it('moving a donation to another type checks that type\'s remaining', async () => {
    await pledge('sadqa', 1000);
    await pledge('zakat', 100);
    const id = await give('sadqa', 600);

    await expect(updateDonation(id, { type: 'zakat' })).rejects.toMatchObject({ code: 'INSUFFICIENT_DUE' });

    await updateDonation(id, { type: 'zakat', amount: 100 });
    expect(await getRemaining('zakat')).toBe(0);
    expect(await getRemaining('sadqa')).toBe(1000);
  });
});

describe('deleting a pledge', () => {
  it('is allowed while the rest of the pledges still cover what was given', async () => {
    const a = await pledge('sadqa', 500);
    await pledge('sadqa', 500);
    await give('sadqa', 300);

    await deleteDonationDue(a);
    expect(await getRemaining('sadqa')).toBe(200);
  });

  it('is refused if it would push "To Be Donated" below zero', async () => {
    const a = await pledge('sadqa', 500);
    await give('sadqa', 400);

    const attempt = deleteDonationDue(a);
    await expect(attempt).rejects.toMatchObject({ code: 'DUE_IN_USE' });
    await attempt.catch((e) => expect(e.details.shortBy).toBe(400));
    expect(await getAllDonationDues()).toHaveLength(1);
  });
});

describe('editing a pledge', () => {
  it('can raise or lower a pledge while it still covers what was given', async () => {
    const id = await pledge('sadqa', 1000);
    await give('sadqa', 300);

    await updateDonationDue(id, { amount: 500, note: 'adjusted' });

    expect(await getRemaining('sadqa')).toBe(200);
    expect(await getDonationDueById(id)).toMatchObject({ amount: 500, note: 'adjusted', date: '2026-10-01' });
  });

  it('refuses to lower a pledge below what was already donated', async () => {
    const id = await pledge('sadqa', 1000);
    await give('sadqa', 600);

    const attempt = updateDonationDue(id, { amount: 400 });
    await expect(attempt).rejects.toMatchObject({ code: 'DUE_IN_USE' });
    await attempt.catch((e) => expect(e.details.shortBy).toBe(200));
    expect((await getDonationDueById(id))!.amount).toBe(1000);
  });

  it('moving a pledge to another type is refused if the old type would go negative', async () => {
    const id = await pledge('sadqa', 500);
    await give('sadqa', 300);

    await expect(updateDonationDue(id, { type: 'zakat' })).rejects.toMatchObject({ code: 'DUE_IN_USE' });
    expect(await getRemaining('sadqa')).toBe(200);

    const unused = await pledge('zakat', 100);
    await updateDonationDue(unused, { type: 'sadqa' });
    expect(await getRemaining('sadqa')).toBe(300);
    expect(await getRemaining('zakat')).toBe(0);
  });

  it('locks the automatic migration entry', async () => {
    await ctx.db.runAsync(
      "INSERT INTO donation_dues (type, amount, date, note) VALUES ('sadqa', 600, '2026-10-02', 'Migration: previously consumed dues')"
    );
    const [row] = await getAllDonationDues();
    expect(isMigrationDue(row)).toBe(true);

    await expect(updateDonationDue(row.id, { amount: 1 })).rejects.toMatchObject({ code: 'LOCKED_ENTRY' });
    await expect(deleteDonationDue(row.id)).rejects.toMatchObject({ code: 'LOCKED_ENTRY' });
  });
});

describe('donation lookups and paging', () => {
  it('finds a donation by id', async () => {
    await pledge('sadqa', 1000);
    const id = await give('sadqa', 100, { recipient: 'Edhi' });
    expect(await getDonationById(id)).toMatchObject({ recipient: 'Edhi', amount: 100 });
    expect(await getDonationById(9999)).toBeNull();
  });

  it('filters by type, date range and search, newest first', async () => {
    await pledge('sadqa', 1000);
    await pledge('zakat', 1000);
    await addDonation({ type: 'sadqa', amount: 10, date: '2026-09-30', recipient: 'Edhi' });
    await addDonation({ type: 'zakat', amount: 20, date: '2026-10-02', recipient: 'Ali', note: 'school fee' });
    await addDonation({ type: 'sadqa', amount: 30, date: '2026-10-03', recipient: 'Edhi' });

    expect((await getDonationsPage()).map((d) => d.amount)).toEqual([30, 20, 10]);
    expect((await getDonationsPage({ type: 'zakat' })).map((d) => d.amount)).toEqual([20]);
    expect((await getDonationsPage({ start: '2026-10-01', end: '2026-10-31' })).map((d) => d.amount)).toEqual([30, 20]);
    expect((await getDonationsPage({ search: 'school' })).map((d) => d.amount)).toEqual([20]);
    expect((await getDonationsPage({ limit: 1, offset: 1 })).map((d) => d.amount)).toEqual([20]);
  });
});
