import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PieChart } from 'react-native-chart-kit';

import { getTotalExpenses, getExpensesByCategory } from '@/db/expenses';
import { getTotalIncome } from '@/db/income';
import { getDonationTotals } from '@/db/donations';
import { getMonthRange } from '@/utils/dateRanges';

type RangeMode = 'month' | 'all';
type CategoryTotal = { category_id: number; category_name: string; total: number };

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#d33', '#888'];

export default function DashboardScreen() {
  const [mode, setMode] = useState<RangeMode>('month');
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [donationTotals, setDonationTotals] = useState({ zakat: 0, sadqa: 0 });
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);

  const loadData = useCallback(async (currentMode: RangeMode) => {
    let start: string | undefined;
    let end: string | undefined;

    if (currentMode === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
    }

    const [expense, income, zakat, sadqa, byCategory] = await Promise.all([
      getTotalExpenses(start, end),
      getTotalIncome(start, end),
      getDonationTotals('zakat', start, end),
      getDonationTotals('sadqa', start, end),
      getExpensesByCategory(start, end),
    ]);

    setTotalExpense(expense);
    setTotalIncome(income);
    setDonationTotals({ zakat, sadqa});
    setCategoryData(byCategory);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(mode);
    }, [mode, loadData])
  );

  const balance = totalIncome - totalExpense;

  const chartData = categoryData.map((cat, index) => ({
    name: cat.category_name,
    amount: cat.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'month' && styles.toggleButtonActive]}
          onPress={() => setMode('month')}
        >
          <Text style={[styles.toggleText, mode === 'month' && styles.toggleTextActive]}>
            This Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'all' && styles.toggleButtonActive]}
          onPress={() => setMode('all')}
        >
          <Text style={[styles.toggleText, mode === 'all' && styles.toggleTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainCards}>
        <View style={[styles.mainCard, { backgroundColor: '#16a34a' }]}>
          <Text style={styles.mainCardLabel}>Income</Text>
          <Text style={styles.mainCardAmount}>Rs {totalIncome.toFixed(0)}</Text>
        </View>
        <View style={[styles.mainCard, { backgroundColor: '#dc2626' }]}>
          <Text style={styles.mainCardLabel}>Expense</Text>
          <Text style={styles.mainCardAmount}>Rs {totalExpense.toFixed(0)}</Text>
        </View>
      </View>

      <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#2563eb' : '#dc2626' }]}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceAmount}>Rs {balance.toFixed(0)}</Text>
      </View>

      <TouchableOpacity style={styles.incomeButton} onPress={() => router.push('/income')}>
        <Text style={styles.incomeButtonText}>+ Log Income</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Donation Breakdown</Text>
      <View style={styles.donationRow}>
        <View style={[styles.donationCard, { backgroundColor: '#7c3aed' }]}>
          <Text style={styles.donationLabel}>Zakat</Text>
          <Text style={styles.donationAmount}>Rs {donationTotals.zakat.toFixed(0)}</Text>
        </View>
        <View style={[styles.donationCard, { backgroundColor: '#0891b2' }]}>
          <Text style={styles.donationLabel}>Sadqa</Text>
          <Text style={styles.donationAmount}>Rs {donationTotals.sadqa.toFixed(0)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Spending by Category</Text>
      {chartData.length === 0 ? (
        <Text style={styles.empty}>No expenses in this period.</Text>
      ) : (
        <PieChart
          data={chartData}
          width={screenWidth - 32}
          height={200}
          chartConfig={{
            color: () => '#333',
          }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="8"
          absolute
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#2563eb' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  mainCards: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  mainCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  mainCardLabel: { color: '#fff', fontSize: 12 },
  mainCardAmount: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  balanceCard: { margin: 16, borderRadius: 10, padding: 16, alignItems: 'center' },
  balanceLabel: { color: '#fff', fontSize: 13 },
  balanceAmount: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  incomeButton: {
    marginHorizontal: 16,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  incomeButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 24, marginBottom: 8 },
  donationRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  donationCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  donationLabel: { color: '#fff', fontSize: 11 },
  donationAmount: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 10, marginBottom: 20 },
});