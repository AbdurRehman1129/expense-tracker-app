import { useEffect, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EditScaffold } from '@/components/ui/EditScaffold';
import { FormField } from '@/components/ui/FormField';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { DateInputField } from '@/components/ui/DateInputField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DONATION_TYPE_OPTIONS } from '@/constants/options';
import { deleteDonation, getDonationById, updateDonation } from '@/db/donations';
import { getRemaining } from '@/db/donationDues';
import { isDbError } from '@/db/errors';
import { useRecord } from '@/hooks/use-record';
import { confirmDelete, notifySaved } from '@/utils/dialogs';
import { formatMoney, toCents } from '@/utils/money';
import { DonationType } from '@/types';

type Form = { type: DonationType; amount: string; recipient: string; date: string; note: string };

export default function EditDonationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const donationId = Number(id);
  const state = useRecord(donationId, getDonationById);
  const original = state.status === 'ready' ? state.record : null;

  const [form, setForm] = useState<Form | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!original) return;
    setForm({
      type: original.type,
      amount: String(original.amount),
      recipient: original.recipient ?? '',
      date: original.date,
      note: original.note ?? '',
    });
  }, [original]);

  const formType = form?.type;
  useEffect(() => {
    if (formType) getRemaining(formType).then(setRemaining).catch(() => undefined);
  }, [formType]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  // What this donation may be, at most: what is left plus its own old amount (same type only).
  const room = remaining + (original && form && form.type === original.type ? original.amount : 0);
  const typeLabel = form?.type === 'zakat' ? 'Zakat' : 'Sadqa';

  const handleSave = async () => {
    if (!form) return;
    Keyboard.dismiss();

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid donation amount.');
      return;
    }
    if (toCents(amount) > toCents(room)) {
      Alert.alert('Amount too high', `You can donate at most ${formatMoney(room)} for ${typeLabel} here.`);
      return;
    }

    setSaving(true);
    try {
      await updateDonation(donationId, {
        type: form.type,
        amount,
        recipient: form.recipient.trim() || null,
        date: form.date,
        note: form.note.trim() || null,
      });
      notifySaved('Donation updated.', () => router.back());
    } catch (err) {
      if (isDbError(err, 'INSUFFICIENT_DUE')) {
        Alert.alert('Amount too high', `You can donate at most ${formatMoney(err.details.remaining)} for ${typeLabel} here.`);
      } else {
        console.error('Failed to update donation:', err);
        Alert.alert('Could not save', 'Something went wrong while saving. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    confirmDelete(
      'Delete donation?',
      'This also removes its expense entry, and the amount goes back to "To Be Donated".',
      async () => {
        try {
          await deleteDonation(donationId);
          router.back();
        } catch (err) {
          console.error('Failed to delete donation:', err);
          Alert.alert('Could not delete', 'Something went wrong. Please try again.');
        }
      }
    );

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
          <FormField label="Type">
            <SegmentedControl
              value={form.type}
              options={DONATION_TYPE_OPTIONS}
              onChange={(type) => set({ type })}
            />
          </FormField>
          <FormField
            label="Amount"
            hint={`Most you can give for ${typeLabel}: ${formatMoney(room)} (includes this donation)`}
          >
            <FormTextInput
              keyboardType="numeric"
              placeholder="0"
              value={form.amount}
              onChangeText={(amount) => set({ amount })}
            />
          </FormField>
          <FormField label="To Whom">
            <FormTextInput
              placeholder="e.g. Edhi Foundation, Ali"
              value={form.recipient}
              onChangeText={(recipient) => set({ recipient })}
            />
          </FormField>
          <FormField label="When">
            <DateInputField value={form.date} onChange={(date) => set({ date })} />
          </FormField>
          <FormField label="Why (optional)">
            <FormTextInput
              placeholder="Reason / note"
              value={form.note}
              onChangeText={(note) => set({ note })}
            />
          </FormField>
        </>
      )}
    </EditScaffold>
  );
}
