import { useState, useCallback } from 'react';
import { useDateField } from '@/hooks/use-today';
import { toDateString, parseDateString } from '@/utils/date';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';

import { addIncome, getIncomePage, getTotalIncome, deleteIncome } from '@/db/income';
import { Income } from '@/types';
import IncomeListItem from '@/components/IncomeListItem';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';
import { openHistory, openIncomeEditor } from '@/utils/navigation';

export default function IncomeScreen() {
  const styles = useThemedStyles(makeStyles);
  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const { date, setDate, reset: resetDate } = useDateField();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const [list, total] = await Promise.all([getIncomePage({ limit: 20 }), getTotalIncome()]);
    setIncomeList(list);
    setTotalIncome(total);
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
      Alert.alert(
        'Invalid amount',
        'Please enter a valid amount greater than 0.'
      );
      return;
    }

    await addIncome({
      amount: numericAmount,
      source: source.trim() || undefined,
      date,
      note: note.trim() || undefined,
    });

    setAmount('');
    setSource('');
    setNote('');
    resetDate();

    await loadData();

    Alert.alert('Success', 'Income saved successfully!');
  } catch (error) {
    console.error('Failed to save income:', error);

    Alert.alert(
      'Save failed',
      'Something went wrong while saving the income.'
    );
  }
};

  const handleDelete = async (id: number) => {
  Alert.alert('Delete income entry?', 'This cannot be undone.', [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteIncome(id);
          await loadData();

          Alert.alert('Success', 'Income deleted successfully!');
        } catch (error) {
          console.error('Failed to delete income:', error);

          Alert.alert(
            'Delete failed',
            'Something went wrong while deleting the income.'
          );
        }
      },
    },
  ]);
};


  return (
    <FormScrollView style={styles.container}>
      <View style={styles.summary}>
        <AppText style={styles.summaryLabel}>Total Income Logged</AppText>
        <AppText style={styles.summaryAmount}>{formatMoney(totalIncome)}</AppText>
      </View>

      <View style={styles.form}>
        <AppText style={styles.label}>Amount</AppText>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <AppText style={styles.label}>Source (optional)</AppText>
        <TextField
          style={styles.input}
          placeholder="e.g. Client project, Salary"
          value={source}
          onChangeText={setSource}
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
              if (selectedDate) {
                setDate(toDateString(selectedDate));
              }
            }}
          />
        )}

        <AppText style={styles.label}>Note (optional)</AppText>
        <TextField
          style={styles.input}
          placeholder="e.g. Invoice #23"
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <AppText style={styles.saveButtonText}>Save Income</AppText>
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionTitle}>Recent Income</AppText>
      {incomeList.length === 0 ? (
        <AppText style={styles.empty}>No income logged yet.</AppText>
      ) : (
        incomeList.map((inc) => (
          <IncomeListItem
            key={inc.id}
            income={inc}
            onEdit={(i) => openIncomeEditor(i.id)}
            onDelete={handleDelete}
          />
        ))
      )}
      <TouchableOpacity onPress={() => openHistory('income')}>
        <AppText style={styles.viewAllLink}>View all income →</AppText>
      </TouchableOpacity>
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    summary: {
      backgroundColor: '#16a34a',
      padding: 20,
      alignItems: 'center',
    },
    summaryLabel: { color: '#e6f9ee', fontSize: 13 },
    summaryAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
    form: { padding: 16 },
    label: { fontSize: 13, color: c.textMuted, marginTop: 12, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
    },
    saveButton: {
      backgroundColor: '#16a34a',
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 20 },
    viewAllLink: { textAlign: 'center', color: c.primary, fontWeight: '600', padding: 16 },
  });