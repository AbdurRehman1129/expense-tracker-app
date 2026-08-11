import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  FlatList,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';

import { getAllIncome } from '@/db/income';
import { addDonationDue, getAllDonationDues, deleteDonationDue, getDueTotals } from '@/db/donationDues';
import { getSetting, setSetting } from '@/db/settings';
import { Income, DonationDue, DonationType } from '@/types';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

const TYPES: { key: DonationType; label: string }[] = [
  { key: 'zakat', label: 'Zakat' },
  { key: 'sadqa', label: 'Sadqa' },
];

export default function DonationDueScreen() {
  const [dues, setDues] = useState<DonationDue[]>([]);
  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [totals, setTotals] = useState({ zakat: 0, sadqa: 0 });

  const [type, setType] = useState<DonationType>('sadqa');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [percentageLocked, setPercentageLocked] = useState(false);
  const [date, setDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [showIncomePicker, setShowIncomePicker] = useState(false);
  const [linkedIncomeId, setLinkedIncomeId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const list = await getAllDonationDues();
    setDues(list);

    const income = await getAllIncome();
    setIncomeList(income);

    const zakatTotal = await getDueTotals('zakat');
    const sadqaTotal = await getDueTotals('sadqa');
    setTotals({ zakat: zakatTotal, sadqa: sadqaTotal });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    (async () => {
      const savedSadqaPercent = await getSetting('default_sadqa_percent');
      if (savedSadqaPercent) setPercentage(savedSadqaPercent);
    })();
  }, []);

  const applyType = async (newType: DonationType) => {
    setType(newType);
    if (newType === 'zakat') {
      setPercentage('2.5');
      setPercentageLocked(true);
    } else {
      setPercentageLocked(false);
      const savedSadqaPercent = await getSetting('default_sadqa_percent');
      setPercentage(savedSadqaPercent ?? '');
    }
  };

  const recalcFromIncomePercent = (income: string, percent: string) => {
    const inc = parseFloat(income);
    const pct = parseFloat(percent);
    if (inc > 0 && pct >= 0) {
      setDueAmount(((inc * pct) / 100).toFixed(2));
    }
  };

  const handleIncomeChange = (val: string) => {
    setIncomeAmount(val);
    recalcFromIncomePercent(val, percentage);
  };

  const handlePercentageChange = (val: string) => {
    setPercentage(val);
    recalcFromIncomePercent(incomeAmount, val);
  };

  const selectIncomeEntry = (inc: Income) => {
    setIncomeAmount(inc.amount.toString());
    setLinkedIncomeId(inc.id);
    recalcFromIncomePercent(inc.amount.toString(), percentage);
    setShowIncomePicker(false);
  };

  const handleSave = async () => {
  Keyboard.dismiss();

  try {
    const numericAmount = parseFloat(dueAmount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Please enter a valid amount to donate.'
      );
      return;
    }

    await addDonationDue({
      type,
      amount: numericAmount,
      date,
      note: note.trim() || undefined,
      linked_income_id: linkedIncomeId ?? undefined,
    });

    if (type === 'sadqa' && percentage) {
      await setSetting('default_sadqa_percent', percentage);
    }

    setIncomeAmount('');
    setDueAmount('');
    setNote('');
    setDate(todayString());
    setLinkedIncomeId(null);

    await loadData();

    Alert.alert('Success', 'Donation due saved successfully!');
  } catch (error) {
    console.error('Failed to save donation due:', error);

    Alert.alert(
      'Save failed',
      'Something went wrong while saving the donation due.'
    );
  }
};

  const handleDelete = async (id: number) => {
  Alert.alert('Delete this due entry?', 'This cannot be undone.', [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteDonationDue(id);
          await loadData();

          Alert.alert('Success', 'Donation due deleted successfully!');
        } catch (error) {
          console.error('Failed to delete donation due:', error);

          Alert.alert(
            'Delete failed',
            'Something went wrong while deleting the donation due.'
          );
        }
      },
    },
  ]);
};

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#7c3aed' }]}>
          <Text style={styles.summaryLabel}>Zakat Due (Total)</Text>
          <Text style={styles.summaryAmount}>Rs {totals.zakat.toFixed(0)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#0891b2' }]}>
          <Text style={styles.summaryLabel}>Sadqa Due (Total)</Text>
          <Text style={styles.summaryAmount}>Rs {totals.sadqa.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeSelector}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeButton, type === t.key && styles.typeButtonActive]}
              onPress={() => applyType(t.key)}
            >
              <Text style={[styles.typeButtonText, type === t.key && styles.typeButtonTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Income Amount</Text>
          <TouchableOpacity onPress={() => setShowIncomePicker(true)}>
            <Text style={styles.linkText}>Pick from logged income</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={incomeAmount}
          onChangeText={handleIncomeChange}
        />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Percentage {type === 'zakat' ? '(standard 2.5%)' : ''}</Text>
          {type === 'zakat' && (
            <TouchableOpacity onPress={() => setPercentageLocked(!percentageLocked)}>
              <Text style={styles.linkText}>{percentageLocked ? 'Unlock' : 'Lock'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={[styles.input, type === 'zakat' && percentageLocked && styles.inputDisabled]}
          keyboardType="numeric"
          placeholder="0"
          value={percentage}
          onChangeText={handlePercentageChange}
          editable={!(type === 'zakat' && percentageLocked)}
        />

        <Text style={styles.label}>Amount To Be Donated</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={dueAmount}
          onChangeText={setDueAmount}
        />

        <Text style={styles.label}>Date</Text>
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

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput style={styles.input} placeholder="Notes" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Entries</Text>
      {dues.length === 0 ? (
        <Text style={styles.empty}>No entries yet.</Text>
      ) : (
        dues.map((d) => (
          <View key={d.id} style={styles.dueRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dueType}>{d.type === 'zakat' ? 'Zakat' : 'Sadqa'}</Text>
              <Text style={styles.dueDate}>{d.date}</Text>
              {d.note ? <Text style={styles.dueNote}>{d.note}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.dueAmount}>Rs {d.amount.toFixed(0)}</Text>
              <TouchableOpacity onPress={() => handleDelete(d.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Modal visible={showIncomePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Income Entry</Text>
            <FlatList
              data={incomeList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => selectIncomeEntry(item)}>
                  <Text style={styles.modalRowText}>
                    {item.source || 'Income'} — Rs {item.amount.toFixed(0)}
                  </Text>
                  <Text style={styles.modalRowDate}>{item.date}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No income logged yet.</Text>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowIncomePicker(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
  summaryCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  summaryLabel: { color: '#fff', fontSize: 11 },
  summaryAmount: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  form: { padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
  linkText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  inputDisabled: { backgroundColor: '#f3f4f6', color: '#888' },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeButton: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  typeButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: '#333' },
  typeButtonTextActive: { color: '#fff' },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20, marginBottom: 20 },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dueType: { fontSize: 15, fontWeight: '600' },
  dueDate: { fontSize: 12, color: '#666', marginTop: 2 },
  dueNote: { fontSize: 12, color: '#888', marginTop: 2 },
  dueAmount: { fontSize: 15, fontWeight: '700' },
  deleteText: { fontSize: 12, color: '#d33', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalRowText: { fontSize: 15, fontWeight: '600' },
  modalRowDate: { fontSize: 12, color: '#666', marginTop: 2 },
  modalClose: { marginTop: 12, alignItems: 'center', padding: 10 },
  modalCloseText: { color: '#2563eb', fontWeight: '600' },
});