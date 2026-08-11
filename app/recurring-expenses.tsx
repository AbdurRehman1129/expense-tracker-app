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
  Switch,
  Keyboard,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';

import { getAllCategories } from '@/db/categories';
import {
  getAllRecurringExpenses,
  addRecurringExpense,
  deleteRecurringExpense,
  togglePause,
} from '@/db/recurringExpenses';
import { Category, RecurringExpense, RecurringFrequency } from '@/types';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function RecurringExpensesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RecurringExpense[]>([]);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [nextDueDate, setNextDueDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    if (cats.length > 0 && categoryId === null) setCategoryId(cats[0].id);

    const list = await getAllRecurringExpenses();
    setItems(list);
  }, [categoryId]);

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
        'Enter a valid amount greater than 0.'
      );
      return;
    }

    if (!categoryId) {
      Alert.alert(
        'Category required',
        'Please select a category.'
      );
      return;
    }

    await addRecurringExpense({
      amount: numericAmount,
      category_id: categoryId,
      frequency,
      next_due_date: nextDueDate,
      note: note.trim() || undefined,
    });

    setAmount('');
    setNote('');
    setNextDueDate(todayString());

    await loadData();

    Alert.alert(
      'Success',
      'Recurring expense saved successfully!'
    );
  } catch (error) {
    console.error('Failed to save recurring expense:', error);

    Alert.alert(
      'Save failed',
      'Something went wrong while saving the recurring expense.'
    );
  }
};

  const handleDelete = async (id: number) => {
  Alert.alert(
    'Delete recurring expense?',
    'This cannot be undone.',
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
            await deleteRecurringExpense(id);
            await loadData();

            Alert.alert(
              'Success',
              'Recurring expense deleted successfully!'
            );
          } catch (error) {
            console.error('Failed to delete recurring expense:', error);

            Alert.alert(
              'Delete failed',
              'Something went wrong while deleting the recurring expense.'
            );
          }
        },
      },
    ]
  );
};

  const handleTogglePause = async (item: RecurringExpense) => {
    await togglePause(item.id, item.is_active === 0);
    loadData();
  };

  const getCategoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? 'Unknown';

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={categoryId} onValueChange={setCategoryId}>
            {categories.map((cat) => (
              <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
            <Picker.Item label="Weekly" value="weekly" />
            <Picker.Item label="Monthly" value="monthly" />
          </Picker>
        </View>

        <Text style={styles.label}>Next Due Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text>{nextDueDate}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(nextDueDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setNextDueDate(selectedDate.toISOString().split('T')[0]);
            }}
          />
        )}

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. Netflix subscription" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Recurring Expense</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Recurring Expenses</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>None set up yet.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{getCategoryName(item.category_id)}</Text>
              <Text style={styles.itemSub}>
                Rs {item.amount.toFixed(0)} · {item.frequency} · Next: {item.next_due_date}
              </Text>
              {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
            </View>
            <View style={styles.itemActions}>
              <Switch value={item.is_active === 1} onValueChange={() => handleTogglePause(item)} />
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  form: { padding: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8, marginBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 10, marginBottom: 20 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 12, color: '#666', marginTop: 2 },
  itemNote: { fontSize: 12, color: '#888', marginTop: 2 },
  itemActions: { alignItems: 'center', gap: 8 },
  deleteText: { fontSize: 12, color: '#d33' },
});