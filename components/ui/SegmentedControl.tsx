import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from './AppText';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <AppText style={[styles.label, active && styles.labelActive]}>{opt.label}</AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      backgroundColor: c.surfaceAlt,
      borderRadius: 8,
      padding: 4,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    segmentActive: { backgroundColor: '#2563eb' },
    label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    labelActive: { color: '#fff' },
  });
