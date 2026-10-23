import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';

type Props = { label: string; hint?: string; children: ReactNode };

/** A label above a form control, with an optional hint underneath. */
export function FormField({ label, hint, children }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{label}</AppText>
      {children}
      {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: { marginTop: 12 },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 4 },
    hint: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  });
