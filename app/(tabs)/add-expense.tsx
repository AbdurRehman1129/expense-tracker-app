import { useState, useCallback } from 'react';
import { useDateField } from '@/hooks/use-today';
import { toDateString, parseDateString } from '@/utils/date';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Modal, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { getAllCategories, addCategory } from '@/db/categories';
import { addExpense, getExpensesPage, deleteExpense, getExpensesByCategory } from '@/db/expenses';
import { Category, Expense } from '@/types';
import ExpenseListItem from '@/components/ExpenseListItem';
import { getBudgetForCategory } from '@/db/budgets';
import { sendBudgetExceededNotification, scheduleDailyReminder } from '@/utils/notifications';
import { getMonthRange } from '@/utils/dateRanges';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { SelectField } from '@/components/ui/SelectField';
import { PAYMENT_OPTIONS } from '@/constants/options';
import { openExpenseEditor, openHistory } from '@/utils/navigation';

export default function AddExpenseScreen() {
  const styles = useThemedStyles(makeStyles);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const { date, setDate, reset: resetDate } = useDateField();
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
    const exps = await getExpensesPage({ limit: 20 });
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
    resetDate();

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
    <FormScrollView style={styles.container}>
      <View style={styles.form}>
        <TouchableOpacity onPress={() => router.push('/recurring-expenses')}>
          <AppText style={styles.recurringLink}>Manage Recurring Expenses</AppText>
        </TouchableOpacity>
        <AppText style={styles.label}>Amount</AppText>
        <TextField
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
        />

        <View style={styles.rowBetween}>
          <AppText style={styles.label}>Category</AppText>
          <TouchableOpacity onPress={() => setShowAddCategory(true)}>
            <AppText style={styles.linkText}>+ Add New Category</AppText>
          </TouchableOpacity>
        </View>
        <SelectField
          value={categoryId}
          options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
          onChange={setCategoryId}
          placeholder="Select category"
          title="Category"
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

        <AppText style={styles.label}>Payment Method</AppText>
        <SelectField
          value={paymentMethod}
          options={PAYMENT_OPTIONS}
          onChange={setPaymentMethod}
          title="Payment Method"
        />

        <AppText style={styles.label}>Note (optional)</AppText>
        <TextField
          style={styles.input}
          placeholder="e.g. groceries"
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <AppText style={styles.saveButtonText}>Save Expense</AppText>
        </TouchableOpacity>
      </View>

      <AppText style={styles.sectionTitle}>Recent Expenses</AppText>
      {expenses.length === 0 ? (
        <AppText style={styles.empty}>No expenses logged yet.</AppText>
      ) : (
        expenses.map((exp) => (
          <ExpenseListItem
            key={exp.id}
            expense={exp}
            categoryName={getCategoryName(exp.category_id)}
            onEdit={openExpenseEditor}
            onDelete={handleDelete}
          />
        ))
      )}
      <TouchableOpacity onPress={() => openHistory('expenses')}>
        <AppText style={styles.viewAllLink}>View all expenses →</AppText>
      </TouchableOpacity>

      <Modal
        visible={showAddCategory}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          setShowAddCategory(false);
          setNewCategoryName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle}>New Category</AppText>
            <TextField
              style={styles.input}
              placeholder="e.g. Subscriptions"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddCategory}>
              <AppText style={styles.saveButtonText}>Add Category</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowAddCategory(false);
                setNewCategoryName('');
              }}
            >
              <AppText style={styles.modalCloseText}>Cancel</AppText>
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
    form: { padding: 16 },
    label: { fontSize: 13, color: c.textMuted, marginTop: 12, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    linkText: { fontSize: 12, color: c.primary, fontWeight: '600' },
    // Anchored near the top so the keyboard can never cover the field
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-start', paddingTop: 96, paddingHorizontal: 16 },
    modalContent: { backgroundColor: c.card, borderRadius: 16, padding: 16 },
    modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    modalClose: { marginTop: 12, alignItems: 'center', padding: 10 },
    modalCloseText: { color: c.primary, fontWeight: '600' },
    saveButton: {
      backgroundColor: '#2563eb',
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 8 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 20 },
    recurringLink: { fontSize: 13, color: c.primary, fontWeight: '600', marginBottom: 8 },
    viewAllLink: { textAlign: 'center', color: c.primary, fontWeight: '600', padding: 16 },
  });