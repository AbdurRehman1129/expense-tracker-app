import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert,Keyboard } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getAllCategories,
  addCategory,
  deleteCategory,
} from '@/db/categories';
import { getAllBudgets, setBudget, deleteBudget } from '@/db/budgets';
import { Category, Budget } from '@/types';

export default function BudgetsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadData = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const buds = await getAllBudgets();
    setBudgets(buds);

    const initialInputs: Record<number, string> = {};
    buds.forEach((b) => {
      initialInputs[b.category_id] = b.monthly_limit.toString();
    });
    setInputs(initialInputs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async (categoryId: number) => {
  Keyboard.dismiss();

  try {
    const value = parseFloat(inputs[categoryId]);

    if (!value || value <= 0) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid monthly limit greater than 0.'
      );
      return;
    }

    await setBudget(categoryId, value);
    await loadData();

    Alert.alert('Success', 'Budget saved successfully!');
  } catch (error) {
    console.error('Failed to save budget:', error);

    Alert.alert(
      'Save failed',
      'Something went wrong while saving the budget.'
    );
  }
};

  const handleRemove = async (categoryId: number) => {
  try {
    await deleteBudget(categoryId);

    setInputs((prev) => ({
      ...prev,
      [categoryId]: '',
    }));

    await loadData();

    Alert.alert('Success', 'Budget removed successfully!');
  } catch (error) {
    console.error('Failed to remove budget:', error);

    Alert.alert(
      'Remove failed',
      'Something went wrong while removing the budget.'
    );
  }
};

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
    await addCategory(name, 'pricetag-outline');
    setNewCategoryName('');
    setShowAddCategory(false);
    loadData();
  };

const handleDeleteCategory = async (categoryId: number, categoryName: string) => {
  Alert.alert(
    'Delete category?',
    `Are you sure you want to delete "${categoryName}"?`,
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
            await deleteCategory(categoryId);
            await loadData();

            Alert.alert(
              'Success',
              `"${categoryName}" was deleted successfully.`
            );
          } catch (error) {
            console.error('Failed to delete category:', error);

            const message =
              error instanceof Error
                ? error.message
                : 'Something went wrong while deleting the category.';

            Alert.alert(
              'Delete failed',
              message
            );
          }
        },
      },
    ]
  );
};

const getBudgetFor = (categoryId: number) =>
  budgets.find((b) => b.category_id === categoryId);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Set a monthly spending limit per category. You&apos;ll get a notification if you go over.</Text>

      {showAddCategory ? (
        <View style={styles.addCategoryBox}>
          <Text style={styles.label}>New Category Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Subscriptions"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
              <Text style={styles.saveBtnText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => {
                setShowAddCategory(false);
                setNewCategoryName('');
              }}
            >
              <Text style={styles.removeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addCategoryLink} onPress={() => setShowAddCategory(true)}>
          <Text style={styles.addCategoryLinkText}>+ Add Custom Category</Text>
        </TouchableOpacity>
      )}

      {categories.map((cat) => {
        const existing = getBudgetFor(cat.id);
        return (
          <View key={cat.id} style={styles.row}>
  <Text style={styles.categoryName}>{cat.name}</Text>

  <View style={styles.inputRow}>
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      placeholder="No limit"
      value={inputs[cat.id] ?? ''}
      onChangeText={(val) =>
        setInputs((prev) => ({ ...prev, [cat.id]: val }))
      }
    />

    <TouchableOpacity
      style={styles.saveBtn}
      onPress={() => handleSave(cat.id)}
    >
      <Text style={styles.saveBtnText}>Save</Text>
    </TouchableOpacity>

    {existing && (
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(cat.id)}
      >
        <Text style={styles.removeBtnText}>Remove</Text>
      </TouchableOpacity>
    )}

    {!cat.is_default && (
      <TouchableOpacity
        style={styles.deleteCategoryBtn}
        onPress={() => handleDeleteCategory(cat.id, cat.name)}
      >
        <Text style={styles.deleteCategoryText}>Delete</Text>
      </TouchableOpacity>
    )}
  </View>
</View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  intro: { fontSize: 13, color: '#666', marginBottom: 16 },
  addCategoryLink: { marginBottom: 16 },
  addCategoryLinkText: { fontSize: 14, color: '#2563eb', fontWeight: '700' },
  addCategoryBox: {
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
  },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  row: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 12 },
  categoryName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  removeBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  removeBtnText: { color: '#d33', fontWeight: '600', fontSize: 13 },
  deleteCategoryBtn: {
  backgroundColor: '#dc2626',
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 12,
},

deleteCategoryText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 13,
},
});