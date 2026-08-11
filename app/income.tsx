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
import { useFocusEffect } from 'expo-router';

import { addIncome, getAllIncome, deleteIncome } from '@/db/income';
import { Income } from '@/types';
import IncomeListItem from '@/components/IncomeListItem';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function IncomeScreen() {
  const [incomeList, setIncomeList] = useState<Income[]>([]);

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const list = await getAllIncome();
    setIncomeList(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
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
    setDate(todayString());
    loadData();
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Delete income entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIncome(id);
          loadData();
        },
      },
    ]);
  };

  const totalIncome = incomeList.reduce((sum, i) => sum + i.amount, 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total Income Logged</Text>
        <Text style={styles.summaryAmount}>Rs {totalIncome.toFixed(0)}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Source (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Client project, Salary"
          value={source}
          onChangeText={setSource}
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
              if (selectedDate) {
                setDate(selectedDate.toISOString().split('T')[0]);
              }
            }}
          />
        )}

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Invoice #23"
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Income</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Income</Text>
      {incomeList.length === 0 ? (
        <Text style={styles.empty}>No income logged yet.</Text>
      ) : (
        incomeList.map((inc) => (
          <IncomeListItem key={inc.id} income={inc} onDelete={handleDelete} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  summary: {
    backgroundColor: '#16a34a',
    padding: 20,
    alignItems: 'center',
  },
  summaryLabel: { color: '#e6f9ee', fontSize: 13 },
  summaryAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  form: { padding: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
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
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
});