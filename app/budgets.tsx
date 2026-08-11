import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getAllCategories } from '@/db/categories';
import { getAllBudgets, setBudget, deleteBudget } from '@/db/budgets';
import { Category, Budget } from '@/types';

export default function BudgetsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [inputs, setInputs] = useState<Record<number, string>>({});

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
    const value = parseFloat(inputs[categoryId]);
    if (!value || value <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid monthly limit greater than 0.');
      return;
    }
    await setBudget(categoryId, value);
    loadData();
  };

  const handleRemove = async (categoryId: number) => {
    await deleteBudget(categoryId);
    setInputs((prev) => ({ ...prev, [categoryId]: '' }));
    loadData();
  };

  const getBudgetFor = (categoryId: number) =>
    budgets.find((b) => b.category_id === categoryId);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.intro}>Set a monthly spending limit per category. You'll get a notification if you go over.</Text>

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
                onChangeText={(val) => setInputs((prev) => ({ ...prev, [cat.id]: val }))}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(cat.id)}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              {existing && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(cat.id)}>
                  <Text style={styles.removeBtnText}>Remove</Text>
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
  },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  removeBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  removeBtnText: { color: '#d33', fontWeight: '600', fontSize: 13 },
});