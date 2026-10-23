import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import ExpenseListItem from '@/components/ExpenseListItem';
import IncomeListItem from '@/components/IncomeListItem';
import DonationListItem from '@/components/DonationListItem';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { getAllCategories } from '@/db/categories';
import { deleteExpense, getExpensesPage } from '@/db/expenses';
import { deleteIncome, getIncomePage } from '@/db/income';
import { deleteDonation, getDonationsPage } from '@/db/donations';
import { Category, Donation, Expense, Income } from '@/types';
import { getMonthRange, getYearRange } from '@/utils/date';
import { confirmDelete } from '@/utils/dialogs';
import {
  HistoryTab,
  openDonationEditor,
  openExpenseEditor,
  openIncomeEditor,
} from '@/utils/navigation';
import { scheduleDailyReminder } from '@/utils/notifications';

type Period = 'all' | 'month' | 'last' | 'year';
type Row = Expense | Income | Donation;

const PAGE_SIZE = 30;

const TAB_OPTIONS: { label: string; value: HistoryTab }[] = [
  { label: 'Expenses', value: 'expenses' },
  { label: 'Income', value: 'income' },
  { label: 'Donations', value: 'donations' },
];

const PERIODS: { label: string; value: Period }[] = [
  { label: 'All time', value: 'all' },
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last' },
  { label: 'This year', value: 'year' },
];

function rangeFor(period: Period): { start?: string; end?: string } {
  if (period === 'month') return getMonthRange(0);
  if (period === 'last') return getMonthRange(-1);
  if (period === 'year') return getYearRange();
  return {};
}

export default function HistoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<HistoryTab>(
    params.tab === 'income' || params.tab === 'donations' ? params.tab : 'expenses'
  );
  const [period, setPeriod] = useState<Period>('all');
  const [categoryId, setCategoryId] = useState(0); // 0 = all categories
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const requestId = useRef(0); // ignores answers that arrive after the filters changed

  // Wait a moment after typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    getAllCategories().then(setCategories).catch(() => undefined);
  }, []);

  const fetchPage = useCallback(
    async (offset: number): Promise<Row[]> => {
      const { start, end } = rangeFor(period);
      const base = { limit: PAGE_SIZE, offset, start, end, search };
      if (tab === 'expenses') {
        return getExpensesPage({ ...base, categoryId: categoryId || undefined });
      }
      if (tab === 'income') return getIncomePage(base);
      return getDonationsPage(base);
    },
    [tab, period, categoryId, search]
  );

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await fetchPage(0);
      if (id !== requestId.current) return;
      setRows(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  // Reload when filters change AND when coming back from an edit screen.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(rows.length);
      if (id !== requestId.current) return;
      setRows((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? 'Unknown';

  const handleDelete = (kind: HistoryTab, id: number) => {
    const run = async () => {
      try {
        if (kind === 'expenses') {
          await deleteExpense(id);
          scheduleDailyReminder().catch((err) => console.error('Failed to reschedule reminder:', err));
        } else if (kind === 'income') {
          await deleteIncome(id);
        } else {
          await deleteDonation(id);
        }
        await reload();
      } catch (err) {
        console.error('Failed to delete:', err);
        Alert.alert('Could not delete', 'Something went wrong. Please try again.');
      }
    };
    confirmDelete(
      'Delete this entry?',
      kind === 'donations'
        ? 'This also removes its expense entry, and the amount goes back to "To Be Donated".'
        : 'This cannot be undone.',
      run
    );
  };

  const header = (
    <View style={styles.header}>
      <SegmentedControl
        value={tab}
        options={TAB_OPTIONS}
        onChange={(next) => {
          setTab(next);
          setCategoryId(0);
        }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.chip, period === p.value && styles.chipActive]}
            onPress={() => setPeriod(p.value)}
          >
            <AppText style={[styles.chipText, period === p.value && styles.chipTextActive]}>{p.label}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextField
        style={styles.search}
        placeholder={
          tab === 'expenses' ? 'Search note or payment method' : tab === 'income' ? 'Search source or note' : 'Search recipient or note'
        }
        value={searchInput}
        onChangeText={setSearchInput}
        autoCorrect={false}
        returnKeyType="search"
      />

      {tab === 'expenses' && (
        <SelectField
          style={styles.categoryFilter}
          value={categoryId}
          options={[{ label: 'All categories', value: 0 }, ...categories.map((c) => ({ label: c.name, value: c.id }))]}
          onChange={setCategoryId}
          title="Category"
        />
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={rows}
      keyExtractor={(item) => `${tab}-${item.id}`}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      renderItem={({ item }) => {
        if (tab === 'expenses') {
          const e = item as Expense;
          return (
            <ExpenseListItem
              expense={e}
              categoryName={categoryName(e.category_id)}
              onEdit={openExpenseEditor}
              onDelete={(id) => handleDelete('expenses', id)}
            />
          );
        }
        if (tab === 'income') {
          const i = item as Income;
          return (
            <IncomeListItem income={i} onEdit={(x) => openIncomeEditor(x.id)} onDelete={(id) => handleDelete('income', id)} />
          );
        }
        const d = item as Donation;
        return (
          <DonationListItem donation={d} onEdit={(x) => openDonationEditor(x.id)} onDelete={(id) => handleDelete('donations', id)} />
        );
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <AppText style={styles.empty}>Nothing found.</AppText>
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.spinner} /> : <View style={styles.footer} />}
      refreshing={false}
      onRefresh={reload}
    />
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { padding: 16, gap: 12 },
    chips: { flexGrow: 0 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 8,
    },
    chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    chipText: { fontSize: 13, color: c.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    search: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
    },
    categoryFilter: {},
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 24 },
    spinner: { marginVertical: 24 },
    footer: { height: 32 },
  });
