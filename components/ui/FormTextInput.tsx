import { StyleSheet, TextInputProps } from 'react-native';
import { TextField } from './TextField';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';

/** TextField with the standard bordered look used across forms. */
export function FormTextInput({ style, ...rest }: TextInputProps) {
  const styles = useThemedStyles(makeStyles);
  return <TextField style={[styles.input, style]} {...rest} />;
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
    },
  });
