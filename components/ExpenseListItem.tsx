import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Expense } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';

interface Props {
  expense: Expense;
  categoryName: string;
  onDelete: (id: number) => void;
  /** Tapping the row or "Edit" calls this. */
  onEdit?: (expense: Expense) => void;
}

export default function ExpenseListItem({ expense, categoryName, onDelete, onEdit }: Props) {
  const styles = useThemedStyles(makeStyles);
  const fromDonation = expense.source === 'donation';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onEdit?.(expense)}
      activeOpacity={onEdit ? 0.6 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${categoryName} ${expense.date}, tap to edit`}
    >
      <View style={styles.left}>
        <AppText style={styles.category}>{categoryName}</AppText>
        <AppText style={styles.date}>{expense.date}</AppText>
        {expense.note ? <AppText style={styles.note}>{expense.note}</AppText> : null}
        {fromDonation ? <AppText style={styles.tag}>Linked to a donation</AppText> : null}
      </View>
      <View style={styles.right}>
        <AppText style={styles.amount}>{formatMoney(expense.amount)}</AppText>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(expense)} hitSlop={8}>
              <AppText style={styles.edit}>Edit</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(expense.id)} hitSlop={8}>
            <AppText style={styles.delete}>Delete</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    left: { flex: 1 },
    category: { fontSize: 15, fontWeight: '600' },
    date: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    note: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    tag: { fontSize: 11, color: c.primary, marginTop: 3 },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 15, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
    edit: { fontSize: 12, color: c.primary },
    delete: { fontSize: 12, color: c.danger },
  });
