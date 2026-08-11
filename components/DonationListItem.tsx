import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Donation } from '@/types';

interface Props {
  donation: Donation;
  onDelete: (id: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  zakat: 'Zakat',
  sadqa: 'Sadqa',
  general: 'General',
};

const TYPE_COLORS: Record<string, string> = {
  zakat: '#7c3aed',
  sadqa: '#0891b2',
  general: '#ea580c',
};

export default function DonationListItem({ donation, onDelete }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.typeRow}>
          <View style={[styles.badge, { backgroundColor: TYPE_COLORS[donation.type] }]}>
            <Text style={styles.badgeText}>{TYPE_LABELS[donation.type]}</Text>
          </View>
        </View>
        <Text style={styles.recipient}>{donation.recipient || 'Unspecified'}</Text>
        <Text style={styles.date}>{donation.date}</Text>
        {donation.note ? <Text style={styles.note}>{donation.note}</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>Rs {donation.amount.toFixed(0)}</Text>
        <TouchableOpacity onPress={() => onDelete(donation.id)}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  left: { flex: 1 },
  typeRow: { flexDirection: 'row', marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  recipient: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12, color: '#666', marginTop: 2 },
  note: { fontSize: 12, color: '#888', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  delete: { fontSize: 12, color: '#d33', marginTop: 6 },
});