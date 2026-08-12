import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PieChart, LineChart } from 'react-native-chart-kit';

import { getTotalExpenses, getExpensesByCategory, getMonthlyExpenseTrend, getExpenseRowsForExport } from '@/db/expenses';
import { getTotalIncome, getIncomeRowsForExport } from '@/db/income';
import { getDonationTotals, getDonationRowsForExport } from '@/db/donations';
import { getMonthRange, getYearRange } from '@/utils/dateRanges';
import { exportCsv, exportPdf } from '@/utils/export';

type RangeMode = 'month' | 'year' | 'all';
type TypeFilter = 'all' | 'expense' | 'income' | 'donation';
type CategoryTotal = { category_id: number; category_name: string; total: number };

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#d33', '#888'];
const screenWidth = Dimensions.get('window').width;

function rangeLabel(mode: RangeMode) {
  if (mode === 'month') return 'This Month';
  if (mode === 'year') return 'This Year';
  return 'All Time';
}

export default function ReportsScreen() {
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [zakat, setZakat] = useState(0);
  const [sadqa, setSadqa] = useState(0);
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [trend, setTrend] = useState<{ month: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const getRange = useCallback((): { start?: string; end?: string } => {
    if (rangeMode === 'month') return getMonthRange();
    if (rangeMode === 'year') return getYearRange();
    return {};
  }, [rangeMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange();

    const [expense, income, z, s, byCategory, monthlyTrend] = await Promise.all([
      getTotalExpenses(start, end),
      getTotalIncome(start, end),
      getDonationTotals('zakat', start, end),
      getDonationTotals('sadqa', start, end),
      getExpensesByCategory(start, end),
      getMonthlyExpenseTrend(6),
    ]);

    setTotalExpense(expense);
    setTotalIncome(income);
    setZakat(z);
    setSadqa(s);
    setCategoryData(byCategory);
    setTrend(monthlyTrend);
    setLoading(false);
  }, [getRange]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const chartData = categoryData.map((cat, index) => ({
    name: cat.category_name,
    amount: cat.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const trendLabels = trend.map((t) => t.month.slice(5)); // "MM"
  const trendValues = trend.map((t) => t.total);
  const hasTrendData = trendValues.some((v) => v > 0);

  async function buildExportData() {
    const { start, end } = getRange();

    if (typeFilter === 'expense') {
      const rows = await getExpenseRowsForExport(start, end);
      return {
        headers: ['Date', 'Category', 'Amount', 'Payment Method', 'Note', 'Source'],
        rows: rows.map((r) => [r.date, r.category_name, r.amount, r.payment_method ?? '', r.note ?? '', r.source]),
        tableTitle: 'Expenses',
      };
    }
    if (typeFilter === 'income') {
      const rows = await getIncomeRowsForExport(start, end);
      return {
        headers: ['Date', 'Source', 'Amount', 'Note'],
        rows: rows.map((r) => [r.date, r.source ?? '', r.amount, r.note ?? '']),
        tableTitle: 'Income',
      };
    }
    if (typeFilter === 'donation') {
      const rows = await getDonationRowsForExport(start, end);
      return {
        headers: ['Date', 'Type', 'Recipient', 'Amount', 'Note'],
        rows: rows.map((r) => [r.date, r.type, r.recipient ?? '', r.amount, r.note ?? '']),
        tableTitle: 'Donations',
      };
    }

    // 'all' — unify into one table: Date, Record Type, Category/Source/Type, Amount, Note
    const [expenseRows, incomeRows, donationRows] = await Promise.all([
      getExpenseRowsForExport(start, end),
      getIncomeRowsForExport(start, end),
      getDonationRowsForExport(start, end),
    ]);

    type UnifiedRow = [string, string, string, number, string];
    const unified: UnifiedRow[] = [
      ...expenseRows
        .filter((r) => r.source !== 'donation') // donations already appear in the donations list below
        .map((r): UnifiedRow => [r.date, 'Expense', r.category_name, r.amount, r.note ?? '']),
      ...incomeRows.map((r): UnifiedRow => [r.date, 'Income', r.source ?? '', r.amount, r.note ?? '']),
      ...donationRows.map((r): UnifiedRow => [
        r.date,
        'Donation',
        r.type + (r.recipient ? ` - ${r.recipient}` : ''),
        r.amount,
        r.note ?? '',
      ]),
    ];
    unified.sort((a, b) => (a[0] < b[0] ? 1 : -1));

    return {
      headers: ['Date', 'Record Type', 'Category / Source / Type', 'Amount', 'Note'],
      rows: unified,
      tableTitle: 'All Records',
    };
  }

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const { headers, rows } = await buildExportData();
      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'There are no records in this range.');
        return;
      }
      const filename = `report-${typeFilter}-${rangeMode}-${Date.now()}.csv`;
      await exportCsv(filename, headers, rows);
    } catch (err) {
      console.error('CSV export failed:', err);
      Alert.alert('Export failed', 'Something went wrong while exporting the CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      const { headers, rows, tableTitle } = await buildExportData();
      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'There are no records in this range.');
        return;
      }

      const summaryHtml = `
        <div class="summary">
          <div class="summary-box"><div class="summary-label">Income</div><div class="summary-amount">Rs ${totalIncome.toFixed(0)}</div></div>
          <div class="summary-box"><div class="summary-label">Expense</div><div class="summary-amount">Rs ${totalExpense.toFixed(0)}</div></div>
          <div class="summary-box"><div class="summary-label">Zakat</div><div class="summary-amount">Rs ${zakat.toFixed(0)}</div></div>
          <div class="summary-box"><div class="summary-label">Sadqa</div><div class="summary-amount">Rs ${sadqa.toFixed(0)}</div></div>
        </div>
      `;

      const tableRows = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${String(cell)}</td>`).join('')}</tr>`)
        .join('');
      const tableHtml = `
        <div class="section-title">${tableTitle}</div>
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      `;

      const filename = `report-${typeFilter}-${rangeMode}-${Date.now()}.pdf`;
      await exportPdf(filename, 'Expense Tracker Report', rangeLabel(rangeMode), summaryHtml + tableHtml);
    } catch (err) {
      console.error('PDF export failed:', err);
      Alert.alert('Export failed', 'Something went wrong while exporting the PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.toggleRow}>
        {(['month', 'year', 'all'] as RangeMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.toggleButton, rangeMode === m && styles.toggleButtonActive]}
            onPress={() => setRangeMode(m)}
          >
            <Text style={[styles.toggleText, rangeMode === m && styles.toggleTextActive]}>{rangeLabel(m)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toggleRow}>
        {([
          { key: 'all', label: 'All' },
          { key: 'expense', label: 'Expense' },
          { key: 'income', label: 'Income' },
          { key: 'donation', label: 'Donation' },
        ] as { key: TypeFilter; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.toggleButtonSmall, typeFilter === t.key && styles.toggleButtonActive]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.toggleText, typeFilter === t.key && styles.toggleTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" />
      ) : (
        <>
          <View style={styles.summaryRow}>
            {(typeFilter === 'all' || typeFilter === 'income') && (
              <View style={[styles.summaryCard, { backgroundColor: '#16a34a' }]}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={styles.summaryAmount}>Rs {totalIncome.toFixed(0)}</Text>
              </View>
            )}
            {(typeFilter === 'all' || typeFilter === 'expense') && (
              <View style={[styles.summaryCard, { backgroundColor: '#dc2626' }]}>
                <Text style={styles.summaryLabel}>Expense</Text>
                <Text style={styles.summaryAmount}>Rs {totalExpense.toFixed(0)}</Text>
              </View>
            )}
          </View>
          {(typeFilter === 'all' || typeFilter === 'donation') && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: '#7c3aed' }]}>
                <Text style={styles.summaryLabel}>Zakat</Text>
                <Text style={styles.summaryAmount}>Rs {zakat.toFixed(0)}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#0891b2' }]}>
                <Text style={styles.summaryLabel}>Sadqa</Text>
                <Text style={styles.summaryAmount}>Rs {sadqa.toFixed(0)}</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Spending by Category</Text>
          {chartData.length === 0 ? (
            <Text style={styles.empty}>No expenses in this period.</Text>
          ) : (
            <PieChart
              data={chartData}
              width={screenWidth - 32}
              height={200}
              chartConfig={{ color: () => '#333' }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute
            />
          )}

          <Text style={styles.sectionTitle}>Monthly Trend (Last 6 Months)</Text>
          {!hasTrendData ? (
            <Text style={styles.empty}>No expense history yet.</Text>
          ) : (
            <LineChart
              data={{ labels: trendLabels, datasets: [{ data: trendValues }] }}
              width={screenWidth - 32}
              height={200}
              yAxisLabel="Rs "
              chartConfig={{
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: () => '#666',
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#2563eb' },
              }}
              bezier
              style={{ borderRadius: 8 }}
            />
          )}

          <Text style={styles.sectionTitle}>Export ({rangeLabel(rangeMode)} · {typeFilter === 'all' ? 'All' : typeFilter[0].toUpperCase() + typeFilter.slice(1)})</Text>
          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportButton} onPress={handleExportCsv} disabled={exporting}>
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportButtonText}>Export CSV</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportButton, { backgroundColor: '#dc2626' }]} onPress={handleExportPdf} disabled={exporting}>
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportButtonText}>Export PDF</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  toggleButtonSmall: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#2563eb' },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  summaryLabel: { color: '#fff', fontSize: 12 },
  summaryAmount: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 16, marginTop: 24, marginBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 10, marginBottom: 20 },
  exportRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 30 },
  exportButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  exportButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
