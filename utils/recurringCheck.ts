import { Alert } from 'react-native';
import {
  getDueRecurringExpenses,
  markNotifiedToday,
  advanceNextDueDate,
} from '@/db/recurringExpenses';
import { addExpense } from '@/db/expenses';
import { getAllCategories } from '@/db/categories';
import { sendRecurringDueNotification } from '@/utils/notifications';

export async function checkAndPromptRecurringExpenses() {
  const dueItems = await getDueRecurringExpenses();
  if (dueItems.length === 0) return;

  const categories = await getAllCategories();

  for (const item of dueItems) {
    const categoryName = categories.find((c) => c.id === item.category_id)?.name ?? 'Expense';

    await sendRecurringDueNotification(categoryName, item.amount);
    await markNotifiedToday(item.id);

    await new Promise<void>((resolve) => {
      Alert.alert(
        'Recurring Payment Due',
        `${categoryName} — Rs ${item.amount.toFixed(0)} is due. Add it now?`,
        [
          {
            text: 'Skip',
            style: 'cancel',
            onPress: () => resolve(),
          },
          {
            text: 'Add',
            onPress: async () => {
              await addExpense({
                amount: item.amount,
                category_id: item.category_id,
                date: item.next_due_date,
                note: item.note ?? undefined,
                payment_method: item.payment_method ?? undefined,
              });
              await advanceNextDueDate(item.id, item.frequency, item.next_due_date);
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  }
}