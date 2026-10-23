import { useEffect, useState } from 'react';
import { Alert, Keyboard, StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/ui/AppText';
import { EditScaffold } from '@/components/ui/EditScaffold';
import { FormField } from '@/components/ui/FormField';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { SelectField } from '@/components/ui/SelectField';
import { DateInputField } from '@/components/ui/DateInputField';
import { FREQUENCY_OPTIONS } from '@/constants/options';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { getAllCategories } from '@/db/categories';
import {
  deleteRecurringExpense,
  getRecurringExpenseById,
  updateRecurringExpense,
} from '@/db/recurringExpenses';
import { useRecord } from '@/hooks/use-record';
import { confirmDelete, notifySaved } from '@/utils/dialogs';
import { parseDateString } from '@/utils/date';
import { Category, RecurringFrequency } from '@/types';

type Form = {
  amount: string;
  categoryId: number | null;
  frequency: RecurringFrequency;
  nextDueDate: string;
  note: string;
  active: boolean;
};

export default function EditRecurringScreen() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const state = useRecord(itemId, getRecurringExpenseById);

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const r = state.record;
    setForm({
      amount: String(r.amount),
      categoryId: r.category_id,
      frequency: r.frequency,
      nextDueDate: r.next_due_date,
      note: r.note ?? '',
      active: r.is_active === 1,
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
      await updateRecurringExpense(itemId, {
        amount,
        category_id: form.categoryId,
        frequency: form.frequency,
        next_due_date: form.nextDueDate,
        // Monthly items return to this day of the month after short months.
        anchor_day: parseDateString(form.nextDueDate).getDate(),
        note: form.note.trim() || null,
        is_active: form.active ? 1 : 0,
      });
      notifySaved('Recurring expense updated.', () => router.back());
    } catch (err) {
      console.error('Failed to update recurring expense:', err);
      Alert.alert('Could not save', 'Something went wrong while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    confirmDelete('Delete recurring expense?', 'This cannot be undone.', async () => {
      try {
        await deleteRecurringExpense(itemId);
        router.back();
      } catch (err) {
        console.error('Failed to delete recurring expense:', err);
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
          <FormField label="Frequency">
            <SelectField
              value={form.frequency}
              options={FREQUENCY_OPTIONS}
              onChange={(frequency) => set({ frequency })}
              title="Frequency"
            />
          </FormField>
          <FormField label="Next Due Date" hint="You'll be asked to add it on this date.">
            <DateInputField value={form.nextDueDate} onChange={(nextDueDate) => set({ nextDueDate })} />
          </FormField>
          <FormField label="Note (optional)">
            <FormTextInput
              placeholder="e.g. Netflix subscription"
              value={form.note}
              onChangeText={(note) => set({ note })}
            />
          </FormField>
          <View style={styles.activeRow}>
            <AppText style={styles.activeLabel}>Active (paused items won&apos;t ask you)</AppText>
            <Switch value={form.active} onValueChange={(active) => set({ active })} />
          </View>
        </>
      )}
    </EditScaffold>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingVertical: 4,
    },
    activeLabel: { flex: 1, fontSize: 14, color: c.text, marginRight: 12 },
  });
