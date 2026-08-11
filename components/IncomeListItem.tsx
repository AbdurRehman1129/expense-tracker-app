import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Income } from '@/types';

interface Props {
  income: Income;
  onDelete: (id: number) => void;
}

export default function IncomeListItem({ income, onDelete }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.source}>{income.source || 'Income'}</Text>
        <Text style={styles.date}>{income.date}</Text>
        {income.note ? <Text style={styles.note}>{income.note}</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>Rs {income.amount.toFixed(0)}</Text>
        <TouchableOpacity onPress={() => onDelete(income.id)}>
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
  source: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12, color: '#666', marginTop: 2 },
  note: { fontSize: 12, color: '#888', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  delete: { fontSize: 12, color: '#d33', marginTop: 6 },
});