import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';

import { addDonation, getAllDonations, deleteDonation, getDonationTotals } from '@/db/donations';
import { getDueTotals } from '@/db/donationDues';
import { Donation, DonationType } from '@/types';
import DonationListItem from '@/components/DonationListItem';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

const TYPES: { key: DonationType; label: string }[] = [
  { key: 'zakat', label: 'Zakat' },
  { key: 'sadqa', label: 'Sadqa' },
];

export default function DonationScreen() {
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
  const [date, setDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const list = await getAllDonations();
    setDonations(list);

    const [zakatDue, sadqaDue, zakatGiven, sadqaGiven] = await Promise.all([
      getDueTotals('zakat'),
      getDueTotals('sadqa'),
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
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid donation amount.');
      return;
    }

    // "Due" already reflects what's actually left to donate (it's reduced as you donate),
    // so it IS the remaining amount — no need to subtract "Given" from it here.
    const remaining = type === 'zakat' ? breakdown.zakatDue : breakdown.sadqaDue;

    if (numericAmount > remaining) {
      Alert.alert(
        'Amount too high',
        `You can donate at most Rs ${remaining.toFixed(0)} for ${type === 'zakat' ? 'Zakat' : 'Sadqa'} right now. You've entered Rs ${numericAmount.toFixed(0)}.`
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
    setDate(todayString());

    loadData();
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Delete donation?', 'This will also remove the linked expense entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDonation(id);
          loadData();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.summaryLabel}>To Be Donated</Text>
          <Text style={styles.summaryAmount}>Rs {totalDue.toFixed(0)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#16a34a' }]}>
          <Text style={styles.summaryLabel}>Donated</Text>
          <Text style={styles.summaryAmount}>Rs {totalGiven.toFixed(0)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logDueButton} onPress={() => router.push('/donation-due')}>
        <Text style={styles.logDueButtonText}>+ Log Donation (Zakat/Sadqa Due)</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Breakdown by Type</Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Zakat</Text>
          <Text style={styles.breakdownRemaining}>
            To Be Donated: Rs {breakdown.zakatDue.toFixed(0)}
          </Text>
          <Text style={styles.breakdownLine}>Donated: Rs {breakdown.zakatGiven.toFixed(0)}</Text>
        </View>
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Sadqa</Text>
          <Text style={styles.breakdownRemaining}>
            To Be Donated: Rs {breakdown.sadqaDue.toFixed(0)}
          </Text>
          <Text style={styles.breakdownLine}>Donated: Rs {breakdown.sadqaGiven.toFixed(0)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Record a Donation Given</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeSelector}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeButton, type === t.key && styles.typeButtonActive]}
              onPress={() => setType(t.key)}
            >
              <Text style={[styles.typeButtonText, type === t.key && styles.typeButtonTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>To Whom</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Edhi Foundation, Ali"
          value={recipient}
          onChangeText={setRecipient}
        />

        <Text style={styles.label}>When</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text>{date}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(date)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
            }}
          />
        )}

        <Text style={styles.label}>Why (optional)</Text>
        <TextInput style={styles.input} placeholder="Reason / note" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Donation</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Donations Given</Text>
      {donations.length === 0 ? (
        <Text style={styles.empty}>No donations logged yet.</Text>
      ) : (
        donations.map((d) => <DonationListItem key={d.id} donation={d} onDelete={handleDelete} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  breakdownCard: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12 },
  breakdownTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  breakdownLine: { fontSize: 12, color: '#666' },
  breakdownRemaining: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginTop: 4 },
  form: { paddingHorizontal: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  typeButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: '#333' },
  typeButtonTextActive: { color: '#fff' },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 10, marginBottom: 20 },
});