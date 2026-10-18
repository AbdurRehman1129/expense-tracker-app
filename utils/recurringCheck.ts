import { Alert } from 'react-native';
import {
  getDueRecurringExpenses,
  markNotifiedToday,
  advanceNextDueDate,
} from '@/db/recurringExpenses';
import { addExpense } from '@/db/expenses';
import { getAllCategories } from '@/db/categories';
import { sendRecurringDueNotification } from '@/utils/notifications';
import { todayString } from '@/utils/date';
import { getMissedDueDates } from '@/utils/recurringDates';

export async function checkAndPromptRecurringExpenses() {
  const dueItems = await getDueRecurringExpenses();
  if (dueItems.length === 0) return;

  const categories = await getAllCategories();
  const today = todayString();

  for (const item of dueItems) {
    const categoryName = categories.find((c) => c.id === item.category_id)?.name ?? 'Expense';
    const missed = getMissedDueDates(item, today);
    if (missed.length === 0) continue;

    await sendRecurringDueNotification(categoryName, item.amount);
    await markNotifiedToday(item.id);

    const message =
      missed.length === 1
        ? `${categoryName} — Rs ${item.amount.toFixed(0)} is due. Add it now?`
        : `${categoryName} — Rs ${item.amount.toFixed(0)}: ${missed.length} payments are due ` +
          `(since ${missed[0]}). Add all ${missed.length}?`;

    await new Promise<void>((resolve) => {
      Alert.alert(
        'Recurring Payment Due',
        message,
        [
          {
            text: 'Skip',
            style: 'cancel',
            onPress: () => resolve(),
          },
          {
            text: missed.length === 1 ? 'Add' : `Add all (${missed.length})`,
            onPress: async () => {
              try {
                for (const dueDate of missed) {
                  await addExpense({
                    amount: item.amount,
                    category_id: item.category_id,
                    date: dueDate,
                    note: item.note ?? undefined,
                    payment_method: item.payment_method ?? undefined,
                  });
                }
                // One step after the last missed date = first date in the future.
                await advanceNextDueDate(item.id, item.frequency, missed[missed.length - 1]);
              } catch (err) {
                console.error('Failed to add recurring expense:', err);
                Alert.alert('Could not add', 'Something went wrong while adding the recurring expense.');
              }
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  }
}
