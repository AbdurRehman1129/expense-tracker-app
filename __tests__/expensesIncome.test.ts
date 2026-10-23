/** @jest-environment node */
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => require('../test-utils/dbState').state.current,
}));

import { setupFreshDb } from '../test-utils/setupDb';
import {
  addExpense,
  getAllExpenses,
  getExpenseById,
  getExpensesByCategory,
  getExpensesPage,
  getTotalExpenses,
  updateExpense,
} from '../db/expenses';
import { addIncome, getAllIncome, getIncomeById, getIncomePage, updateIncome } from '../db/income';

let ctx: Awaited<ReturnType<typeof setupFreshDb>>;
beforeEach(async () => {
  ctx = await setupFreshDb();
});

describe('updateExpense merges instead of overwriting', () => {
  it('changing only the note keeps every other field', async () => {
    const id = await addExpense({
      amount: 250,
      category_id: ctx.categories.food,
      date: '2026-10-05',
      note: 'lunch',
      payment_method: 'Card',
    });

    await updateExpense(id, { note: 'team lunch' });

    const [e] = await getAllExpenses();
    expect(e).toMatchObject({
      amount: 250,
      category_id: ctx.categories.food,
      date: '2026-10-05',
      note: 'team lunch',
      payment_method: 'Card',
    });
    expect(e.updated_at).toBeTruthy();
  });

  it('an explicit null clears a field', async () => {
    const id = await addExpense({ amount: 10, category_id: 1, date: '2026-10-05', note: 'x' });
    await updateExpense(id, { note: null });
    expect((await getAllExpenses())[0].note).toBeNull();
  });

  it('keeps the expense in its category totals after a partial edit', async () => {
    const id = await addExpense({ amount: 100, category_id: ctx.categories.food, date: '2026-10-05' });
    await updateExpense(id, { amount: 120 });

    const totals = await getExpensesByCategory();
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ category_name: 'Food', total: 120 });
  });

  it('ignores an id that does not exist', async () => {
    await expect(updateExpense(999, { amount: 5 })).resolves.toBeUndefined();
  });
});

describe('updateIncome merges instead of overwriting', () => {
  it('changing only the source keeps amount and date', async () => {
    const id = await addIncome({ amount: 5000, source: 'Client A', date: '2026-10-01', note: 'inv 1' });
    await updateIncome(id, { source: 'Client B' });

    const [i] = await getAllIncome();
    expect(i).toMatchObject({ amount: 5000, source: 'Client B', date: '2026-10-01', note: 'inv 1' });
  });
});

describe('getExpensesPage', () => {
  beforeEach(async () => {
    for (let day = 1; day <= 5; day++) {
      await addExpense({
        amount: day * 10,
        category_id: day % 2 ? ctx.categories.food : ctx.categories.donation,
        date: `2026-10-0${day}`,
        note: day === 3 ? 'Electric bill' : `item ${day}`,
        payment_method: day === 4 ? 'Bank' : 'Cash',
      });
    }
  });

  it('returns newest first and pages with limit/offset', async () => {
    const first = await getExpensesPage({ limit: 2 });
    expect(first.map((e) => e.date)).toEqual(['2026-10-05', '2026-10-04']);
    const second = await getExpensesPage({ limit: 2, offset: 2 });
    expect(second.map((e) => e.date)).toEqual(['2026-10-03', '2026-10-02']);
  });

  it('filters by category', async () => {
    const rows = await getExpensesPage({ categoryId: ctx.categories.food });
    expect(rows.map((e) => e.amount).sort()).toEqual([10, 30, 50]);
  });

  it('filters by an inclusive date range', async () => {
    const rows = await getExpensesPage({ start: '2026-10-02', end: '2026-10-04' });
    expect(rows).toHaveLength(3);
  });

  it('searches note and payment method', async () => {
    expect((await getExpensesPage({ search: 'electric' }))[0].amount).toBe(30);
    expect((await getExpensesPage({ search: 'bank' }))[0].amount).toBe(40);
    expect(await getExpensesPage({ search: 'nothing matches' })).toHaveLength(0);
  });

  it('totals still add up', async () => {
    expect(await getTotalExpenses()).toBe(150);
    expect(await getTotalExpenses('2026-10-02', '2026-10-03')).toBe(50);
  });
});

describe('lookups by id', () => {
  it('finds an expense and an income entry, or null', async () => {
    const e = await addExpense({ amount: 5, category_id: 1, date: '2026-10-05' });
    const i = await addIncome({ amount: 9, date: '2026-10-05' });
    expect(await getExpenseById(e)).toMatchObject({ amount: 5 });
    expect(await getIncomeById(i)).toMatchObject({ amount: 9 });
    expect(await getExpenseById(999)).toBeNull();
    expect(await getIncomeById(999)).toBeNull();
  });
});

describe('getIncomePage', () => {
  beforeEach(async () => {
    await addIncome({ amount: 100, source: 'Client A', date: '2026-09-30', note: 'inv 1' });
    await addIncome({ amount: 200, source: 'Client B', date: '2026-10-02' });
    await addIncome({ amount: 300, source: 'Salary', date: '2026-10-03', note: 'october' });
  });

  it('newest first with paging', async () => {
    expect((await getIncomePage()).map((r) => r.amount)).toEqual([300, 200, 100]);
    expect((await getIncomePage({ limit: 2 })).map((r) => r.amount)).toEqual([300, 200]);
    expect((await getIncomePage({ limit: 2, offset: 2 })).map((r) => r.amount)).toEqual([100]);
  });

  it('filters by date range and searches source/note', async () => {
    expect((await getIncomePage({ start: '2026-10-01', end: '2026-10-31' })).map((r) => r.amount)).toEqual([300, 200]);
    expect((await getIncomePage({ search: 'client' })).map((r) => r.amount)).toEqual([200, 100]);
    expect((await getIncomePage({ search: 'october' })).map((r) => r.amount)).toEqual([300]);
  });
});
