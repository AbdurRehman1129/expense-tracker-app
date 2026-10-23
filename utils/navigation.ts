import { router } from 'expo-router';
import type { Expense } from '@/types';

export type HistoryTab = 'expenses' | 'income' | 'donations';

/** An expense that belongs to a donation is edited through that donation. */
export function openExpenseEditor(expense: Pick<Expense, 'id' | 'source' | 'linked_donation_id'>) {
  if (expense.source === 'donation' && expense.linked_donation_id) {
    openDonationEditor(expense.linked_donation_id);
    return;
  }
  router.push({ pathname: '/edit/expense/[id]', params: { id: String(expense.id) } });
}

export function openIncomeEditor(id: number) {
  router.push({ pathname: '/edit/income/[id]', params: { id: String(id) } });
}

export function openDonationEditor(id: number) {
  router.push({ pathname: '/edit/donation/[id]', params: { id: String(id) } });
}

export function openDueEditor(id: number) {
  router.push({ pathname: '/edit/due/[id]', params: { id: String(id) } });
}

export function openRecurringEditor(id: number) {
  router.push({ pathname: '/edit/recurring/[id]', params: { id: String(id) } });
}

export function openHistory(tab: HistoryTab) {
  router.push({ pathname: '/history', params: { tab } });
}
