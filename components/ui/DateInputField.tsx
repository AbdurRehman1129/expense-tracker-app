import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppText } from './AppText';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { parseDateString, toDateString } from '@/utils/date';

type Props = { value: string; onChange: (date: string) => void };

/** Shows a 'YYYY-MM-DD' date and opens the native date picker (local dates, no UTC shift). */
export function DateInputField({ value, onChange }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button">
        <AppText>{value}</AppText>
      </TouchableOpacity>
      {open && (
        <DateTimePicker
          value={parseDateString(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            setOpen(false);
            if (selected) onChange(toDateString(selected));
          }}
        />
      )}
    </>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    field: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: c.inputBg,
    },
  });
