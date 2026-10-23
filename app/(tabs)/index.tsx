import { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PieChart } from 'react-native-chart-kit';

import { getTotalExpenses, getExpensesByCategory } from '@/db/expenses';
import { getTotalIncome } from '@/db/income';
import { getDonationTotals } from '@/db/donations';
import { getMonthRange } from '@/utils/dateRanges';
import { getAllBudgetsWithCategory, BudgetWithCategory } from '@/db/budgets';
import { AppText } from '@/components/ui/AppText';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';

type RangeMode = 'month' | 'all';
type CategoryTotal = { category_id: number; category_name: string; total: number };

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#d33', '#888'];

export default function DashboardScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [mode, setMode] = useState<RangeMode>('month');
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [donationTotals, setDonationTotals] = useState({ zakat: 0, sadqa: 0 });
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);

  const loadData = useCallback(async (currentMode: RangeMode) => {
    let start: string | undefined;
    let end: string | undefined;

    if (currentMode === 'month') {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
    }

    const [expense, income, zakat, sadqa, byCategory, budgetList] = await Promise.all([
      getTotalExpenses(start, end),
      getTotalIncome(start, end),
      getDonationTotals('zakat', start, end),
      getDonationTotals('sadqa', start, end),
      getExpensesByCategory(start, end),
      getAllBudgetsWithCategory(),
    ]);

    setTotalExpense(expense);
    setTotalIncome(income);
    setDonationTotals({ zakat, sadqa});
    setCategoryData(byCategory);
    setBudgets(budgetList);
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
    legendFontColor: colors.text,
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
          <AppText style={[styles.toggleText, mode === 'month' && styles.toggleTextActive]}>
            This Month
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'all' && styles.toggleButtonActive]}
          onPress={() => setMode('all')}
        >
          <AppText style={[styles.toggleText, mode === 'all' && styles.toggleTextActive]}>
            All Time
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.mainCards}>
        <View style={[styles.mainCard, { backgroundColor: '#16a34a' }]}>
          <AppText style={styles.mainCardLabel}>Income</AppText>
          <AppText style={styles.mainCardAmount}>Rs {totalIncome.toFixed(0)}</AppText>
        </View>
        <View style={[styles.mainCard, { backgroundColor: '#dc2626' }]}>
          <AppText style={styles.mainCardLabel}>Expense</AppText>
          <AppText style={styles.mainCardAmount}>Rs {totalExpense.toFixed(0)}</AppText>
        </View>
      </View>

      <View style={[styles.balanceCard, { backgroundColor: balance >= 0 ? '#2563eb' : '#dc2626' }]}>
        <AppText style={styles.balanceLabel}>Balance</AppText>
        <AppText style={styles.balanceAmount}>Rs {balance.toFixed(0)}</AppText>
      </View>

      <TouchableOpacity style={styles.incomeButton} onPress={() => router.push('/income')}>
        <AppText style={styles.incomeButtonText}>+ Log Income</AppText>
      </TouchableOpacity>

      <AppText style={styles.sectionTitle}>Donation Breakdown</AppText>
      <View style={styles.donationRow}>
        <View style={[styles.donationCard, { backgroundColor: '#7c3aed' }]}>
          <AppText style={styles.donationLabel}>Zakat</AppText>
          <AppText style={styles.donationAmount}>Rs {donationTotals.zakat.toFixed(0)}</AppText>
        </View>
        <View style={[styles.donationCard, { backgroundColor: '#0891b2' }]}>
          <AppText style={styles.donationLabel}>Sadqa</AppText>
          <AppText style={styles.donationAmount}>Rs {donationTotals.sadqa.toFixed(0)}</AppText>
        </View>
      </View>

      <AppText style={styles.sectionTitle}>Spending by Category</AppText>
      {chartData.length === 0 ? (
        <AppText style={styles.empty}>No expenses in this period.</AppText>
      ) : (
        <PieChart
          data={chartData}
          width={screenWidth - 32}
          height={200}
          chartConfig={{
            color: () => colors.text,
          }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="8"
          absolute
        />
      )}

      <View style={styles.budgetHeaderRow}>
        <AppText style={styles.sectionTitle}>Budget Progress</AppText>
        <TouchableOpacity onPress={() => router.push('/budgets')}>
          <AppText style={styles.manageBudgetsLink}>Manage Budgets</AppText>
        </TouchableOpacity>
      </View>

      {budgets.length === 0 ? (
        <AppText style={styles.empty}>No budgets set yet.</AppText>
      ) : (
        budgets.map((b) => {
          const cat = categoryData.find((c) => c.category_id === b.category_id);
          const spent = cat?.total ?? 0;
          const percent = Math.min((spent / b.monthly_limit) * 100, 100);
          const isOver = spent > b.monthly_limit;

          return (
            <View key={b.category_id} style={styles.budgetItem}>
              <View style={styles.budgetItemHeader}>
                <AppText style={styles.budgetCategoryName}>{b.category_name}</AppText>
                <AppText style={[styles.budgetAmountText, isOver && styles.budgetOverText]}>
                  Rs {spent.toFixed(0)} / Rs {b.monthly_limit.toFixed(0)}
                </AppText>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${percent}%`, backgroundColor: isOver ? '#dc2626' : '#16a34a' },
                  ]}
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    toggleRow: {
      flexDirection: 'row',
      margin: 16,
      backgroundColor: c.surfaceAlt,
      borderRadius: 8,
      padding: 4,
    },
    toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    toggleButtonActive: { backgroundColor: '#2563eb' },
    toggleText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
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
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 10, marginBottom: 20 },
    budgetHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginRight: 16,
    },
    manageBudgetsLink: { fontSize: 13, color: c.primary, fontWeight: '600' },
    budgetItem: { marginHorizontal: 16, marginBottom: 14 },
    budgetItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    budgetCategoryName: { fontSize: 14, fontWeight: '600' },
    budgetAmountText: { fontSize: 13, color: c.textMuted },
    budgetOverText: { color: c.danger, fontWeight: '700' },
    progressBarBg: {
      height: 8,
      backgroundColor: c.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: { height: '100%', borderRadius: 4 },
  });