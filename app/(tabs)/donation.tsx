import { useState, useCallback } from 'react';
import { useDateField } from '@/hooks/use-today';
import { toDateString, parseDateString } from '@/utils/date';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';

import { addDonation, getDonationsPage, deleteDonation, getDonationTotals } from '@/db/donations';
import { getRemaining } from '@/db/donationDues';
import { isDbError } from '@/db/errors';
import { Donation, DonationType } from '@/types';
import DonationListItem from '@/components/DonationListItem';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';
import { openDonationEditor, openHistory } from '@/utils/navigation';

const TYPES: { key: DonationType; label: string }[] = [
  { key: 'zakat', label: 'Zakat' },
  { key: 'sadqa', label: 'Sadqa' },
];

export default function DonationScreen() {
  const styles = useThemedStyles(makeStyles);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [totalGiven, setTotalGiven] = useState(0);
  const [breakdown, setBreakdown] = useState({
    zakatDue: 0,
    zakatGiven: 0,
    sadqaDue: 0,
    sadqaGiven: 0,
  });

  const [type, setType] = useState<DonationType>('sadqa');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const { date, setDate, reset: resetDate } = useDateField();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const list = await getDonationsPage({ limit: 20 });
    setDonations(list);

    const [zakatDue, sadqaDue, zakatGiven, sadqaGiven] = await Promise.all([
      getRemaining('zakat'),
      getRemaining('sadqa'),
      getDonationTotals('zakat'),
      getDonationTotals('sadqa'),
    ]);

    setTotalDue(zakatDue + sadqaDue);
    setTotalGiven(zakatGiven + sadqaGiven);
    setBreakdown({ zakatDue, zakatGiven, sadqaDue, sadqaGiven });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
  Keyboard.dismiss();

  try {
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid donation amount.');
      return;
    }

    const remaining =
      type === 'zakat' ? breakdown.zakatDue : breakdown.sadqaDue;

    if (numericAmount > remaining) {
      Alert.alert(
        'Amount too high',
        `You can donate at most ${formatMoney(remaining)} for ${
          type === 'zakat' ? 'Zakat' : 'Sadqa'
        } right now. You've entered ${formatMoney(numericAmount)}.`
      );
      return;
    }

    await addDonation({
      type,
      recipient: recipient.trim() || undefined,
      amount: numericAmount,
      date,
      note: note.trim() || undefined,
    });

    setAmount('');
    setRecipient('');
    setNote('');
    resetDate();

    await loadData();

    Alert.alert('Success', 'Donation saved successfully!');
  } catch (error) {
    if (isDbError(error, 'INSUFFICIENT_DUE')) {
      // The database is the final judge (e.g. two quick taps): explain and refresh the numbers.
      Alert.alert(
        'Amount too high',
        `You can donate at most ${formatMoney(error.details.remaining)} for ${
          type === 'zakat' ? 'Zakat' : 'Sadqa'
        } right now.`
      );
      await loadData();
      return;
    }
    console.error('Failed to save donation:', error);

    Alert.alert(
      'Save failed',
      'Something went wrong while saving the donation.'
    );
  }
};

 const handleDelete = async (id: number) => {
  Alert.alert(
    'Delete donation?',
    'This will also remove the linked expense entry.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDonation(id);
            await loadData();

            Alert.alert('Success', 'Donation deleted successfully!');
          } catch (error) {
            console.error('Failed to delete donation:', error);

            Alert.alert(
              'Delete failed',
              'Something went wrong while deleting the donation.'
            );
          }
        },
      },
    ]
  );
};
  return (
    <FormScrollView style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#f59e0b' }]}>
          <AppText style={styles.summaryLabel}>To Be Donated</AppText>
          <AppText style={styles.summaryAmount}>{formatMoney(totalDue)}</AppText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#16a34a' }]}>
          <AppText style={styles.summaryLabel}>Donated</AppText>
          <AppText style={styles.summaryAmount}>{formatMoney(totalGiven)}</AppText>
        </View>
      </View>

      <TouchableOpacity style={styles.logDueButton} onPress={() => router.push('/donation-due')}>
        <AppText style={styles.logDueButtonText}>+ Log Donation (Zakat/Sadqa Due)</AppText>
      </TouchableOpacity>

      <AppText style={styles.sectionTitle}>Breakdown by Type</AppText>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownCard}>
          <AppText style={styles.breakdownTitle}>Zakat</AppText>
          <AppText style={styles.breakdownRemaining}>
            To Be Donated: {formatMoney(breakdown.zakatDue)}
          </AppText>
          <AppText style={styles.breakdownLine}>Donated: {formatMoney(breakdown.zakatGiven)}</AppText>
        </View>
        <View style={styles.breakdownCard}>
          <AppText style={styles.breakdownTitle}>Sadqa</AppText>
          <AppText style={styles.breakdownRemaining}>
            To Be Donated: {formatMoney(breakdown.sadqaDue)}
          </AppText>
          <AppText style={styles.breakdownLine}>Donated: {formatMoney(breakdown.sadqaGiven)}</AppText>
        </View>
      </View>

      <AppText style={styles.sectionTitle}>Record a Donation Given</AppText>
      <View style={styles.form}>
        <AppText style={styles.label}>Type</AppText>
        <View style={styles.typeSelector}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeButton, type === t.key && styles.typeButtonActive]}
              onPress={() => setType(t.key)}
            >
              <AppText style={[styles.typeButtonText, type === t.key && styles.typeButtonTextActive]}>
                {t.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <AppText style={styles.label}>Amount</AppText>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <AppText style={styles.label}>To Whom</AppText>
        <TextField
          style={styles.input}
          placeholder="e.g. Edhi Foundation, Ali"
          value={recipient}
          onChangeText={setRecipient}
        />

        <AppText style={styles.label}>When</AppText>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <AppText>{date}</AppText>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={parseDateString(date)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(toDateString(selectedDate));
            }}
          />
        )}

        <AppText style={styles.label}>Why (optional)</AppText>
        <TextField style={styles.input} placeholder="Reason / note" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <AppText style={styles.saveButtonText}>Save Donation</AppText>
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionTitle}>Recent Donations Given</AppText>
      {donations.length === 0 ? (
        <AppText style={styles.empty}>No donations logged yet.</AppText>
      ) : (
        donations.map((d) => (
          <DonationListItem
            key={d.id}
            donation={d}
            onEdit={(x) => openDonationEditor(x.id)}
            onDelete={handleDelete}
          />
        ))
      )}
      <TouchableOpacity onPress={() => openHistory('donations')}>
        <AppText style={styles.viewAllLink}>View all donations →</AppText>
      </TouchableOpacity>
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
    summaryCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
    summaryLabel: { color: '#fff', fontSize: 12 },
    summaryAmount: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
    logDueButton: {
      marginHorizontal: 16,
      marginTop: 4,
      backgroundColor: '#f59e0b',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    logDueButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 20, marginBottom: 8 },
    breakdownRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
    breakdownCard: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12 },
    breakdownTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
    breakdownLine: { fontSize: 12, color: c.textMuted },
    breakdownRemaining: { fontSize: 12, fontWeight: '700', color: c.primary, marginTop: 4 },
    form: { paddingHorizontal: 16 },
    label: { fontSize: 13, color: c.textMuted, marginTop: 12, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, fontSize: 15 },
    typeSelector: { flexDirection: 'row', gap: 8 },
    typeButton: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    typeButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    typeButtonText: { fontSize: 14, fontWeight: '600', color: c.text },
    typeButtonTextActive: { color: '#fff' },
    saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 10, marginBottom: 20 },
    viewAllLink: { textAlign: 'center', color: c.primary, fontWeight: '600', padding: 16 },
  });