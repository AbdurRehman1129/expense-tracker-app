import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Income } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';

interface Props {
  income: Income;
  onDelete: (id: number) => void;
  /** Tapping the row or "Edit" calls this. */
  onEdit?: (income: Income) => void;
}

export default function IncomeListItem({ income, onDelete, onEdit }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onEdit?.(income)}
      activeOpacity={onEdit ? 0.6 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${income.source || 'Income'} ${income.date}, tap to edit`}
    >
      <View style={styles.left}>
        <AppText style={styles.source}>{income.source || 'Income'}</AppText>
        <AppText style={styles.date}>{income.date}</AppText>
        {income.note ? <AppText style={styles.note}>{income.note}</AppText> : null}
      </View>
      <View style={styles.right}>
        <AppText style={styles.amount}>{formatMoney(income.amount)}</AppText>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(income)} hitSlop={8}>
              <AppText style={styles.edit}>Edit</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(income.id)} hitSlop={8}>
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
    source: { fontSize: 15, fontWeight: '600' },
    date: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    note: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 15, fontWeight: '700', color: c.success },
    actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
    edit: { fontSize: 12, color: c.primary },
    delete: { fontSize: 12, color: c.danger },
  });
