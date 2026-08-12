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
  Modal,
  Keyboard,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { getAllCategories, addCategory } from '@/db/categories';
import { addExpense, getAllExpenses, deleteExpense } from '@/db/expenses';
import { Category, Expense } from '@/types';
import ExpenseListItem from '@/components/ExpenseListItem';
import { getBudgetForCategory } from '@/db/budgets';
import { sendBudgetExceededNotification, scheduleDailyReminder } from '@/utils/notifications';
import { getExpensesByCategory } from '@/db/expenses';
import { getMonthRange } from '@/utils/dateRanges';


function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function AddExpenseScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [note, setNote] = useState('');

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadData = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    if (cats.length > 0 && categoryId === null) {
      setCategoryId(cats[0].id);
    }
    const exps = await getAllExpenses();
    setExpenses(exps);
  }, [categoryId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

const handleSave = async () => {
  // First: hide keyboard immediately
  Keyboard.dismiss();

  try {
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (!categoryId) {
      Alert.alert('Category required', 'Please select a category.');
      return;
    }

    const budget = await getBudgetForCategory(categoryId);
    let spentBefore = 0;

    if (budget) {
      const { start, end } = getMonthRange();
      const beforeData = await getExpensesByCategory(start, end);
      spentBefore =
        beforeData.find((c) => c.category_id === categoryId)?.total ?? 0;
    }

    await addExpense({
      amount: numericAmount,
      category_id: categoryId,
      date,
      note: note.trim() || undefined,
      payment_method: paymentMethod,
    });

    if (budget) {
      const spentAfter = spentBefore + numericAmount;

      if (
        spentBefore <= budget.monthly_limit &&
        spentAfter > budget.monthly_limit
      ) {
        const categoryName = getCategoryName(categoryId);

        await sendBudgetExceededNotification(
          categoryName,
          spentAfter,
          budget.monthly_limit
        );
      }
    }

    // Clear form
    setAmount('');
    setNote('');
    setDate(todayString());

    await loadData();
    scheduleDailyReminder().catch((err) => console.error('Failed to reschedule reminder:', err));

    // Success popup
    Alert.alert('Success', 'Expense saved successfully!');
  } catch (error) {
    console.error('Failed to save expense:', error);

    // Failure popup
    Alert.alert(
      'Save failed',
      'Something went wrong while saving the expense.'
    );
  }
};

  const handleDelete = async (id: number) => {

  Alert.alert('Delete expense?', 'This cannot be undone.', [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteExpense(id);
          await loadData();

          Alert.alert('Success', 'Expense deleted successfully!');
        } catch (error) {
          console.error('Failed to delete expense:', error);

          Alert.alert(
            'Delete failed',
            'Something went wrong while deleting the expense.'
          );
        }
      },
    },
  ]);
};

  const getCategoryName = (id: number) =>
    categories.find((c) => c.id === id)?.name ?? 'Unknown';

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the new category.');
      return;
    }
    const exists = categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      Alert.alert('Already exists', 'A category with this name already exists.');
      return;
    }
    const newId = await addCategory(name, 'pricetag-outline');
    setNewCategoryName('');
    setShowAddCategory(false);
    const cats = await getAllCategories();
    setCategories(cats);
    setCategoryId(newId);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <TouchableOpacity onPress={() => router.push('/recurring-expenses')}>
          <Text style={styles.recurringLink}>Manage Recurring Expenses</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity onPress={() => setShowAddCategory(true)}>
            <Text style={styles.linkText}>+ Add New Category</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={categoryId} onValueChange={(val) => setCategoryId(val)}>
            {categories.map((cat) => (
              <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
            ))}
          </Picker>
        </View>

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

        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={paymentMethod} onValueChange={setPaymentMethod}>
            <Picker.Item label="Cash" value="Cash" />
            <Picker.Item label="Card" value="Card" />
            <Picker.Item label="Bank Transfer" value="Bank" />
          </Picker>
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. groceries"
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Expense</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Expenses</Text>
      {expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses logged yet.</Text>
      ) : (
        expenses.map((exp) => (
          <ExpenseListItem
            key={exp.id}
            expense={exp}
            categoryName={getCategoryName(exp.category_id)}
            onDelete={handleDelete}
          />
        ))
      )}

      <Modal visible={showAddCategory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Subscriptions"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddCategory}>
              <Text style={styles.saveButtonText}>Add Category</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowAddCategory(false);
                setNewCategoryName('');
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  form: { padding: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  linkText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalClose: { marginTop: 12, alignItems: 'center', padding: 10 },
  modalCloseText: { color: '#2563eb', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
  recurringLink: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginBottom: 8 },
});