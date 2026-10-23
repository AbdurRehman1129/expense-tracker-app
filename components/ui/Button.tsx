import { ActivityIndicator, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : undefined} />
      ) : (
        <AppText style={[styles.text, styles[`${variant}Text` as const]]}>{title}</AppText>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    base: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: '#2563eb' },
    danger: { backgroundColor: c.dangerBg },
    ghost: { borderWidth: 1, borderColor: c.border },
    disabled: { opacity: 0.6 },
    text: { fontSize: 16, fontWeight: '600' },
    primaryText: { color: '#fff' },
    dangerText: { color: c.danger },
    ghostText: { color: c.text },
  });
