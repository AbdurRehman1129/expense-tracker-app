import { useEffect, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EditScaffold } from '@/components/ui/EditScaffold';
import { FormField } from '@/components/ui/FormField';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { SelectField } from '@/components/ui/SelectField';
import { DateInputField } from '@/components/ui/DateInputField';
import { PAYMENT_OPTIONS } from '@/constants/options';
import { getAllCategories } from '@/db/categories';
import { deleteExpense, getExpenseById, updateExpense } from '@/db/expenses';
import { useRecord } from '@/hooks/use-record';
import { scheduleDailyReminder } from '@/utils/notifications';
import { confirmDelete, notifySaved } from '@/utils/dialogs';
import { Category } from '@/types';

type Form = { amount: string; categoryId: number | null; date: string; payment: string | null; note: string };

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const state = useRecord(expenseId, getExpenseById);

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const e = state.record;
    // An expense that belongs to a donation is edited through the donation.
    if (e.source === 'donation' && e.linked_donation_id) {
      router.replace({ pathname: '/edit/donation/[id]', params: { id: String(e.linked_donation_id) } });
      return;
    }
    setForm({
      amount: String(e.amount),
      categoryId: e.category_id,
      date: e.date,
      payment: e.payment_method,
      note: e.note ?? '',
    });
  }, [state]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const handleSave = async () => {
    if (!form) return;
    Keyboard.dismiss();

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!form.categoryId) {
      Alert.alert('Category required', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      await updateExpense(expenseId, {
        amount,
        category_id: form.categoryId,
        date: form.date,
        payment_method: form.payment,
        note: form.note.trim() || null,
      });
      scheduleDailyReminder().catch((err) => console.error('Failed to reschedule reminder:', err));
      notifySaved('Expense updated.', () => router.back());
    } catch (err) {
      console.error('Failed to update expense:', err);
      Alert.alert('Could not save', 'Something went wrong while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    confirmDelete('Delete expense?', 'This cannot be undone.', async () => {
      try {
        await deleteExpense(expenseId);
        scheduleDailyReminder().catch((err) => console.error('Failed to reschedule reminder:', err));
        router.back();
      } catch (err) {
        console.error('Failed to delete expense:', err);
        Alert.alert('Could not delete', 'Something went wrong. Please try again.');
      }
    });

  return (
    <EditScaffold
      loading={state.status === 'loading' || (state.status === 'ready' && !form)}
      missing={state.status === 'missing'}
      saving={saving}
      onSave={handleSave}
      onDelete={handleDelete}
    >
      {form && (
        <>
          <FormField label="Amount">
            <FormTextInput
              keyboardType="numeric"
              placeholder="0"
              value={form.amount}
              onChangeText={(amount) => set({ amount })}
            />
          </FormField>
          <FormField label="Category">
            <SelectField
              value={form.categoryId}
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
              onChange={(categoryId) => set({ categoryId })}
              placeholder="Select category"
              title="Category"
            />
          </FormField>
          <FormField label="Date">
            <DateInputField value={form.date} onChange={(date) => set({ date })} />
          </FormField>
          <FormField label="Payment Method">
            <SelectField
              value={form.payment}
              options={PAYMENT_OPTIONS}
              onChange={(payment) => set({ payment })}
              placeholder="Not set"
              title="Payment Method"
            />
          </FormField>
          <FormField label="Note (optional)">
            <FormTextInput
              placeholder="e.g. groceries"
              value={form.note}
              onChangeText={(note) => set({ note })}
            />
          </FormField>
        </>
      )}
    </EditScaffold>
  );
}
