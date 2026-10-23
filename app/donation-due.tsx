import { useState, useCallback, useEffect } from 'react';
import { useDateField } from '@/hooks/use-today';
import { toDateString, parseDateString } from '@/utils/date';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Modal, FlatList, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';

import { getAllIncome } from '@/db/income';
import { addDonationDue, getAllDonationDues, deleteDonationDue, getRemaining, isMigrationDue } from '@/db/donationDues';
import { isDbError } from '@/db/errors';
import { openDueEditor } from '@/utils/navigation';
import { getSetting, setSetting } from '@/db/settings';
import { Income, DonationDue, DonationType } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';

const TYPES: { key: DonationType; label: string }[] = [
  { key: 'zakat', label: 'Zakat' },
  { key: 'sadqa', label: 'Sadqa' },
];

export default function DonationDueScreen() {
  const styles = useThemedStyles(makeStyles);
  const [dues, setDues] = useState<DonationDue[]>([]);
  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [totals, setTotals] = useState({ zakat: 0, sadqa: 0 });

  const [type, setType] = useState<DonationType>('sadqa');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [percentageLocked, setPercentageLocked] = useState(false);
  const { date, setDate, reset: resetDate } = useDateField();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [showIncomePicker, setShowIncomePicker] = useState(false);
  const [linkedIncomeId, setLinkedIncomeId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const list = await getAllDonationDues();
    setDues(list);

    const income = await getAllIncome();
    setIncomeList(income);

    const zakatTotal = await getRemaining('zakat');
    const sadqaTotal = await getRemaining('sadqa');
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
    resetDate();
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
          if (isDbError(error, 'DUE_IN_USE')) {
            Alert.alert(
              "Can't delete this pledge",
              `${formatMoney(error.details.shortBy)} of it has already been donated. ` +
                'Delete or reduce the matching donations first.'
            );
            return;
          }
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
    <FormScrollView style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#7c3aed' }]}>
          <AppText style={styles.summaryLabel}>Zakat To Be Donated</AppText>
          <AppText style={styles.summaryAmount}>{formatMoney(totals.zakat)}</AppText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#0891b2' }]}>
          <AppText style={styles.summaryLabel}>Sadqa To Be Donated</AppText>
          <AppText style={styles.summaryAmount}>{formatMoney(totals.sadqa)}</AppText>
        </View>
      </View>

      <View style={styles.form}>
        <AppText style={styles.label}>Type</AppText>
        <View style={styles.typeSelector}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeButton, type === t.key && styles.typeButtonActive]}
              onPress={() => applyType(t.key)}
            >
              <AppText style={[styles.typeButtonText, type === t.key && styles.typeButtonTextActive]}>
                {t.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rowBetween}>
          <AppText style={styles.label}>Income Amount</AppText>
          <TouchableOpacity onPress={() => setShowIncomePicker(true)}>
            <AppText style={styles.linkText}>Pick from logged income</AppText>
          </TouchableOpacity>
        </View>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={incomeAmount}
          onChangeText={handleIncomeChange}
        />

        <View style={styles.rowBetween}>
          <AppText style={styles.label}>Percentage {type === 'zakat' ? '(standard 2.5%)' : ''}</AppText>
          {type === 'zakat' && (
            <TouchableOpacity onPress={() => setPercentageLocked(!percentageLocked)}>
              <AppText style={styles.linkText}>{percentageLocked ? 'Unlock' : 'Lock'}</AppText>
            </TouchableOpacity>
          )}
        </View>
        <TextField
          style={[styles.input, type === 'zakat' && percentageLocked && styles.inputDisabled]}
          keyboardType="numeric"
          placeholder="0"
          value={percentage}
          onChangeText={handlePercentageChange}
          editable={!(type === 'zakat' && percentageLocked)}
        />

        <AppText style={styles.label}>Amount To Be Donated</AppText>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={dueAmount}
          onChangeText={setDueAmount}
        />

        <AppText style={styles.label}>Date</AppText>
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

        <AppText style={styles.label}>Note (optional)</AppText>
        <TextField style={styles.input} placeholder="Notes" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <AppText style={styles.saveButtonText}>Save</AppText>
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionTitle}>Recent Entries</AppText>
      {dues.length === 0 ? (
        <AppText style={styles.empty}>No entries yet.</AppText>
      ) : (
        dues.map((d) => {
          const automatic = isMigrationDue(d);
          return (
            <TouchableOpacity
              key={d.id}
              style={styles.dueRow}
              onPress={() => openDueEditor(d.id)}
              activeOpacity={0.6}
            >
              <View style={{ flex: 1 }}>
                <AppText style={styles.dueType}>{d.type === 'zakat' ? 'Zakat' : 'Sadqa'}</AppText>
                <AppText style={styles.dueDate}>{d.date}</AppText>
                {automatic ? (
                  <AppText style={styles.dueNote}>Automatic entry: pledges you have already donated</AppText>
                ) : d.note ? (
                  <AppText style={styles.dueNote}>{d.note}</AppText>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText style={styles.dueAmount}>{formatMoney(d.amount)}</AppText>
                {!automatic && (
                  <View style={styles.dueActions}>
                    <TouchableOpacity onPress={() => openDueEditor(d.id)} hitSlop={8}>
                      <AppText style={styles.editText}>Edit</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(d.id)} hitSlop={8}>
                      <AppText style={styles.deleteText}>Delete</AppText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <Modal visible={showIncomePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle}>Select Income Entry</AppText>
            <FlatList
              data={incomeList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => selectIncomeEntry(item)}>
                  <AppText style={styles.modalRowText}>
                    {item.source || 'Income'} — {formatMoney(item.amount)}
                  </AppText>
                  <AppText style={styles.modalRowDate}>{item.date}</AppText>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<AppText style={styles.empty}>No income logged yet.</AppText>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowIncomePicker(false)}>
              <AppText style={styles.modalCloseText}>Close</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
    summaryCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
    summaryLabel: { color: '#fff', fontSize: 11 },
    summaryAmount: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
    form: { padding: 16 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 4 },
    linkText: { fontSize: 12, color: c.primary, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, fontSize: 15 },
    inputDisabled: { backgroundColor: c.surfaceAlt, color: c.textMuted },
    typeSelector: { flexDirection: 'row', gap: 8 },
    typeButton: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    typeButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    typeButtonText: { fontSize: 14, fontWeight: '600', color: c.text },
    typeButtonTextActive: { color: '#fff' },
    saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 20, marginBottom: 20 },
    dueRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    dueType: { fontSize: 15, fontWeight: '600' },
    dueDate: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    dueNote: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    dueAmount: { fontSize: 15, fontWeight: '700' },
    deleteText: { fontSize: 12, color: c.danger, marginTop: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: c.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
    modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    modalRowText: { fontSize: 15, fontWeight: '600' },
    modalRowDate: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    modalClose: { marginTop: 12, alignItems: 'center', padding: 10 },
    modalCloseText: { color: c.primary, fontWeight: '600' },
    dueActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
    editText: { fontSize: 12, color: c.primary },
  });