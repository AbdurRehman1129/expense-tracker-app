import { useEffect, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EditScaffold } from '@/components/ui/EditScaffold';
import { FormField } from '@/components/ui/FormField';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { DateInputField } from '@/components/ui/DateInputField';
import { deleteIncome, getIncomeById, updateIncome } from '@/db/income';
import { useRecord } from '@/hooks/use-record';
import { confirmDelete, notifySaved } from '@/utils/dialogs';

type Form = { amount: string; source: string; date: string; note: string };

export default function EditIncomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const incomeId = Number(id);
  const state = useRecord(incomeId, getIncomeById);

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const i = state.record;
    setForm({ amount: String(i.amount), source: i.source ?? '', date: i.date, note: i.note ?? '' });
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

    setSaving(true);
    try {
      await updateIncome(incomeId, {
        amount,
        source: form.source.trim() || null,
        date: form.date,
        note: form.note.trim() || null,
      });
      notifySaved('Income updated.', () => router.back());
    } catch (err) {
      console.error('Failed to update income:', err);
      Alert.alert('Could not save', 'Something went wrong while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    confirmDelete('Delete income entry?', 'This cannot be undone.', async () => {
      try {
        await deleteIncome(incomeId);
        router.back();
      } catch (err) {
        console.error('Failed to delete income:', err);
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
          <FormField label="Source (optional)">
            <FormTextInput
              placeholder="e.g. Client project, Salary"
              value={form.source}
              onChangeText={(source) => set({ source })}
            />
          </FormField>
          <FormField label="Date">
            <DateInputField value={form.date} onChange={(date) => set({ date })} />
          </FormField>
          <FormField label="Note (optional)">
            <FormTextInput
              placeholder="e.g. Invoice #23"
              value={form.note}
              onChangeText={(note) => set({ note })}
            />
          </FormField>
        </>
      )}
    </EditScaffold>
  );
}
