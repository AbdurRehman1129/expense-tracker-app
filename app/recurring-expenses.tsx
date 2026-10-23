import { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Switch, Keyboard } from 'react-native';
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
import { advanceByFrequency, parseDateString, todayString } from '@/utils/date';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { SelectField } from '@/components/ui/SelectField';
import { formatMoney } from '@/utils/money';
import { FREQUENCY_OPTIONS } from '@/constants/options';
import { openRecurringEditor } from '@/utils/navigation';

function calculateNextDueDate(startDate: string, frequency: RecurringFrequency) {
  // Month-end safe: Jan 31 + 1 month = Feb 28/29 (not Mar 3).
  return advanceByFrequency(startDate, frequency);
}

export default function RecurringExpensesScreen() {
  const styles = useThemedStyles(makeStyles);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RecurringExpense[]>([]);

const [amount, setAmount] = useState('');
const [categoryId, setCategoryId] = useState<number | null>(null);

const [frequency, setFrequency] =
  useState<RecurringFrequency>('monthly');

const [startDate, setStartDate] =
  useState(todayString());

const [nextDueDate, setNextDueDate] =
  useState(
    calculateNextDueDate(
      todayString(),
      'monthly'
    )
  );

const [showDatePicker, setShowDatePicker] =
  useState(false);

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
const handleFrequencyChange = (
  value: RecurringFrequency
) => {
  setFrequency(value);

  setNextDueDate(
    calculateNextDueDate(
      startDate,
      value
    )
  );
};
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
      anchor_day: parseDateString(startDate).getDate(),
      note: note.trim() || undefined,
    });

    setAmount('');
setNote('');

const newStartDate = todayString();

setStartDate(newStartDate);

setNextDueDate(
  calculateNextDueDate(
    newStartDate,
    frequency
  )
);

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
    <FormScrollView style={styles.container}>
      <View style={styles.form}>
        <AppText style={styles.label}>Amount</AppText>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <AppText style={styles.label}>Category</AppText>
        <SelectField
          value={categoryId}
          options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
          onChange={setCategoryId}
          placeholder="Select category"
          title="Category"
        />

        <AppText style={styles.label}>Frequency</AppText>
        <SelectField
          value={frequency}
          options={FREQUENCY_OPTIONS}
          onChange={handleFrequencyChange}
          title="Frequency"
        />

        <AppText style={styles.label}>Start Date</AppText>

<TouchableOpacity
  style={styles.input}
  onPress={() => setShowDatePicker(true)}
>
  <AppText>{startDate}</AppText>
</TouchableOpacity>
<AppText style={styles.label}>Next Due Date</AppText>

<View style={styles.input}>
  <AppText>{nextDueDate}</AppText>
</View>
        {showDatePicker && (
  <DateTimePicker
    value={parseDateString(startDate)}
    mode="date"
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(event, selectedDate) => {
      setShowDatePicker(false);

      if (selectedDate) {
        const newStartDate =
          `${selectedDate.getFullYear()}-${String(
            selectedDate.getMonth() + 1
          ).padStart(2, '0')}-${String(
            selectedDate.getDate()
          ).padStart(2, '0')}`;

        setStartDate(newStartDate);

        setNextDueDate(
          calculateNextDueDate(
            newStartDate,
            frequency
          )
        );
      }
    }}
  />
)}

        <AppText style={styles.label}>Note (optional)</AppText>
        <TextField style={styles.input} placeholder="e.g. Netflix subscription" value={note} onChangeText={setNote} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <AppText style={styles.saveButtonText}>Save Recurring Expense</AppText>
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionTitle}>Your Recurring Expenses</AppText>
      {items.length === 0 ? (
        <AppText style={styles.empty}>None set up yet.</AppText>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.itemTitle}>{getCategoryName(item.category_id)}</AppText>
              <AppText style={styles.itemSub}>
                {formatMoney(item.amount)} · {item.frequency} · Next: {item.next_due_date}
              </AppText>
              {item.note ? <AppText style={styles.itemNote}>{item.note}</AppText> : null}
            </View>
            <View style={styles.itemActions}>
              <Switch value={item.is_active === 1} onValueChange={() => handleTogglePause(item)} />
              <TouchableOpacity onPress={() => openRecurringEditor(item.id)} hitSlop={8}>
                <AppText style={styles.editText}>Edit</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={8}>
                <AppText style={styles.deleteText}>Delete</AppText>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    form: { padding: 16 },
    label: { fontSize: 13, color: c.textMuted, marginTop: 12, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, fontSize: 15 },
    saveButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8, marginBottom: 8 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 10, marginBottom: 20 },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    itemTitle: { fontSize: 15, fontWeight: '600' },
    itemSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    itemNote: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    itemActions: { alignItems: 'center', gap: 8 },
    deleteText: { fontSize: 12, color: c.danger },
    editText: { fontSize: 12, color: c.primary },
  });