import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Donation } from '@/types';
import { AppText } from '@/components/ui/AppText';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { formatMoney } from '@/utils/money';

interface Props {
  donation: Donation;
  onDelete: (id: number) => void;
  /** Tapping the row or "Edit" calls this. */
  onEdit?: (donation: Donation) => void;
}

const TYPE_LABELS: Record<string, string> = {
  zakat: 'Zakat',
  sadqa: 'Sadqa',
};

const TYPE_COLORS: Record<string, string> = {
  zakat: '#7c3aed',
  sadqa: '#0891b2',
};

export default function DonationListItem({ donation, onDelete, onEdit }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onEdit?.(donation)}
      activeOpacity={onEdit ? 0.6 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABELS[donation.type]} donation ${donation.date}, tap to edit`}
    >
      <View style={styles.left}>
        <View style={styles.typeRow}>
          <View style={[styles.badge, { backgroundColor: TYPE_COLORS[donation.type] }]}>
            <AppText style={styles.badgeText}>{TYPE_LABELS[donation.type]}</AppText>
          </View>
        </View>
        <AppText style={styles.recipient}>{donation.recipient || 'Unspecified'}</AppText>
        <AppText style={styles.date}>{donation.date}</AppText>
        {donation.note ? <AppText style={styles.note}>{donation.note}</AppText> : null}
      </View>
      <View style={styles.right}>
        <AppText style={styles.amount}>{formatMoney(donation.amount)}</AppText>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(donation)} hitSlop={8}>
              <AppText style={styles.edit}>Edit</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(donation.id)} hitSlop={8}>
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
    typeRow: { flexDirection: 'row', marginBottom: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    recipient: { fontSize: 15, fontWeight: '600' },
    date: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    note: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    right: { alignItems: 'flex-end' },
    amount: { fontSize: 15, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
    edit: { fontSize: 12, color: c.primary },
    delete: { fontSize: 12, color: c.danger },
  });
