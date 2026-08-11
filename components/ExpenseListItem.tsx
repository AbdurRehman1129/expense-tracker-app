import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Expense } from '@/types';

interface Props {
  expense: Expense;
  categoryName: string;
  onDelete: (id: number) => void;
}

export default function ExpenseListItem({ expense, categoryName, onDelete }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.category}>{categoryName}</Text>
        <Text style={styles.date}>{expense.date}</Text>
        {expense.note ? <Text style={styles.note}>{expense.note}</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>Rs {expense.amount.toFixed(0)}</Text>
        <TouchableOpacity onPress={() => onDelete(expense.id)}>
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
  category: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12, color: '#666', marginTop: 2 },
  note: { fontSize: 12, color: '#888', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  delete: { fontSize: 12, color: '#d33', marginTop: 6 },
});