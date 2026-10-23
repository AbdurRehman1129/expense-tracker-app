import { useEffect, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EditScaffold } from '@/components/ui/EditScaffold';
import { FormField } from '@/components/ui/FormField';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { DateInputField } from '@/components/ui/DateInputField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DONATION_TYPE_OPTIONS } from '@/constants/options';
import {
  deleteDonationDue,
  getDonationDueById,
  isMigrationDue,
  updateDonationDue,
} from '@/db/donationDues';
import { isDbError } from '@/db/errors';
import { useRecord } from '@/hooks/use-record';
import { confirmDelete, notifySaved } from '@/utils/dialogs';
import { formatMoney } from '@/utils/money';
import { DonationType } from '@/types';

type Form = { type: DonationType; amount: string; date: string; note: string };

export default function EditDueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dueId = Number(id);
  const state = useRecord(dueId, getDonationDueById);
  const record = state.status === 'ready' ? state.record : null;

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setForm({ type: record.type, amount: String(record.amount), date: record.date, note: record.note ?? '' });
  }, [record]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const explainInUse = (shortBy: number) =>
    Alert.alert(
      "Can't change this pledge",
      `${formatMoney(shortBy)} of it has already been donated. Delete or reduce the matching donations first.`
    );

  const handleSave = async () => {
    if (!form) return;
    Keyboard.dismiss();

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount to donate.');
      return;
    }

    setSaving(true);
    try {
      await updateDonationDue(dueId, {
        type: form.type,
        amount,
        date: form.date,
        note: form.note.trim() || null,
      });
      notifySaved('Pledge updated.', () => router.back());
    } catch (err) {
      if (isDbError(err, 'DUE_IN_USE')) {
        explainInUse(err.details.shortBy);
      } else {
        console.error('Failed to update pledge:', err);
        Alert.alert('Could not save', 'Something went wrong while saving. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    confirmDelete('Delete this pledge?', 'This cannot be undone.', async () => {
      try {
        await deleteDonationDue(dueId);
        router.back();
      } catch (err) {
        if (isDbError(err, 'DUE_IN_USE')) {
          explainInUse(err.details.shortBy);
        } else {
          console.error('Failed to delete pledge:', err);
          Alert.alert('Could not delete', 'Something went wrong. Please try again.');
        }
      }
    });

  return (
    <EditScaffold
      loading={state.status === 'loading' || (state.status === 'ready' && !form)}
      missing={state.status === 'missing'}
      saving={saving}
      onSave={handleSave}
      onDelete={handleDelete}
      readOnlyNotice={
        record && isMigrationDue(record)
          ? 'This entry was added automatically when the app was updated. It stands for pledges you have already donated, so it keeps your "To Be Donated" numbers correct and cannot be edited or deleted.'
          : undefined
      }
    >
      {form && (
        <>
          <FormField label="Type">
            <SegmentedControl
              value={form.type}
              options={DONATION_TYPE_OPTIONS}
              onChange={(type) => set({ type })}
            />
          </FormField>
          <FormField label="Amount To Be Donated">
            <FormTextInput
              keyboardType="numeric"
              placeholder="0"
              value={form.amount}
              onChangeText={(amount) => set({ amount })}
              editable={!(record && isMigrationDue(record))}
            />
          </FormField>
          <FormField label="Date">
            <DateInputField value={form.date} onChange={(date) => set({ date })} />
          </FormField>
          <FormField label="Note (optional)">
            <FormTextInput
              placeholder="Notes"
              value={form.note}
              onChangeText={(note) => set({ note })}
              editable={!(record && isMigrationDue(record))}
            />
          </FormField>
        </>
      )}
    </EditScaffold>
  );
}
