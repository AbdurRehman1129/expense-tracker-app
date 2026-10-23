import { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getAllCategories,
  addCategory,
  deleteCategory,
  renameCategory,
} from '@/db/categories';
import { getAllBudgets, setBudget, deleteBudget } from '@/db/budgets';
import { Category, Budget } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { TextField } from '@/components/ui/TextField';
import { FormScrollView } from '@/components/ui/FormScrollView';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';

export default function BudgetsScreen() {
  const styles = useThemedStyles(makeStyles);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

const handleRename = async () => {
  if (renamingId === null) return;
  Keyboard.dismiss();
  try {
    await renameCategory(renamingId, renameValue);
    setRenamingId(null);
    await loadData();
  } catch (error) {
    Alert.alert(
      'Rename failed',
      error instanceof Error ? error.message : 'Something went wrong while renaming.'
    );
  }
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
    <FormScrollView style={styles.container}>
      <AppText style={styles.intro}>Set a monthly spending limit per category. You&apos;ll get a notification if you go over.</AppText>

      {showAddCategory ? (
        <View style={styles.addCategoryBox}>
          <AppText style={styles.label}>New Category Name</AppText>
          <View style={styles.inputRow}>
            <TextField
              style={styles.input}
              placeholder="e.g. Subscriptions"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
              <AppText style={styles.saveBtnText}>Add</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => {
                setShowAddCategory(false);
                setNewCategoryName('');
              }}
            >
              <AppText style={styles.removeBtnText}>Cancel</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addCategoryLink} onPress={() => setShowAddCategory(true)}>
          <AppText style={styles.addCategoryLinkText}>+ Add Custom Category</AppText>
        </TouchableOpacity>
      )}

      {categories.map((cat) => {
        const existing = getBudgetFor(cat.id);
        return (
          <View key={cat.id} style={styles.row}>
  {renamingId === cat.id ? (
    <View style={styles.inputRow}>
      <TextField
        style={styles.input}
        value={renameValue}
        onChangeText={setRenameValue}
        autoFocus
      />
      <TouchableOpacity style={styles.saveBtn} onPress={handleRename}>
        <AppText style={styles.saveBtnText}>Save</AppText>
      </TouchableOpacity>
      <TouchableOpacity style={styles.removeBtn} onPress={() => setRenamingId(null)}>
        <AppText style={styles.removeBtnText}>Cancel</AppText>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.nameRow}>
      <AppText style={styles.categoryName}>{cat.name}</AppText>
      {!cat.is_default && (
        <TouchableOpacity
          onPress={() => {
            setRenamingId(cat.id);
            setRenameValue(cat.name);
          }}
          hitSlop={8}
        >
          <AppText style={styles.renameText}>Rename</AppText>
        </TouchableOpacity>
      )}
    </View>
  )}

  <View style={styles.inputRow}>
    <TextField
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
      <AppText style={styles.saveBtnText}>Save</AppText>
    </TouchableOpacity>

    {existing && (
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(cat.id)}
      >
        <AppText style={styles.removeBtnText}>Remove</AppText>
      </TouchableOpacity>
    )}

    {!cat.is_default && (
      <TouchableOpacity
        style={styles.deleteCategoryBtn}
        onPress={() => handleDeleteCategory(cat.id, cat.name)}
      >
        <AppText style={styles.deleteCategoryText}>Delete</AppText>
      </TouchableOpacity>
    )}
  </View>
</View>
        );
      })}
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    intro: { fontSize: 13, color: c.textMuted, marginBottom: 16 },
    addCategoryLink: { marginBottom: 16 },
    addCategoryLinkText: { fontSize: 14, color: c.primary, fontWeight: '700' },
    addCategoryBox: {
      marginBottom: 20,
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      padding: 12,
    },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 6 },
    row: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 },
    categoryName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      backgroundColor: c.background,
    },
    saveBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
    saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    removeBtn: { backgroundColor: c.dangerBg, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
    removeBtnText: { color: c.danger, fontWeight: '600', fontSize: 13 },
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
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    renameText: { fontSize: 12, color: c.primary },
  });