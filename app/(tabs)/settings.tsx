import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { getSetting, setSetting } from '@/db/settings';
import { scheduleDailyReminder } from '@/utils/notifications';
import { AppText } from '@/components/ui/AppText';
import { ThemePreference, useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';
import { SelectField, SelectOption } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

function timeStringToDate(timeStr: string): Date {
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(hh || 21, mm || 0, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const DAY_OPTIONS: SelectOption<number>[] = Array.from({ length: 28 }, (_, i) => ({
  label: String(i + 1),
  value: i + 1,
}));

const APPEARANCE_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { preference, setPreference } = useTheme();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [sadqaReminderEnabled, setSadqaReminderEnabled] = useState(false);
  const [sadqaReminderDay, setSadqaReminderDay] = useState(1);

  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const [rEnabled, rTime, sEnabled, sDay] = await Promise.all([
      getSetting('reminder_enabled'),
      getSetting('reminder_time'),
      getSetting('sadqa_reminder_enabled'),
      getSetting('sadqa_reminder_day'),
    ]);
    setReminderEnabled(rEnabled === 'true');
    setReminderTime(rTime ?? '21:00');
    setSadqaReminderEnabled(sEnabled === 'true');
    setSadqaReminderDay(parseInt(sDay ?? '1', 10));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleToggleReminder = async (value: boolean) => {
    setReminderEnabled(value);
    await setSetting('reminder_enabled', value ? 'true' : 'false');
    await scheduleDailyReminder();
  };

  const handleTimeChange = async (event: unknown, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (!selectedDate) return;
    const timeStr = dateToTimeString(selectedDate);
    setReminderTime(timeStr);
    await setSetting('reminder_time', timeStr);
    if (reminderEnabled) {
      await scheduleDailyReminder();
    }
  };

  const handleToggleSadqaReminder = async (value: boolean) => {
    setSadqaReminderEnabled(value);
    await setSetting('sadqa_reminder_enabled', value ? 'true' : 'false');
  };

  const handleSadqaDayChange = async (day: number) => {
    setSadqaReminderDay(day);
    await setSetting('sadqa_reminder_day', String(day));
  };

  const handleTestReminder = async () => {
    await scheduleDailyReminder();
    Alert.alert('Scheduled', 'Your daily reminder has been (re)scheduled based on current settings.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <AppText>Loading settings…</AppText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <AppText style={styles.sectionTitle}>Appearance</AppText>
      <View style={styles.card}>
        <SegmentedControl value={preference} options={APPEARANCE_OPTIONS} onChange={setPreference} />
        <AppText style={styles.hint}>
          System follows your phone&apos;s dark mode setting. Light and Dark stay fixed.
        </AppText>
      </View>

      <AppText style={styles.sectionTitle}>Daily Expense Reminder</AppText>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <AppText style={styles.rowLabel}>{reminderEnabled ? 'Enabled' : 'Disabled'}</AppText>
          <Switch value={reminderEnabled} onValueChange={handleToggleReminder} />
        </View>

        <View style={styles.rowBetween}>
          <AppText style={styles.rowLabel}>Reminder Time</AppText>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
            disabled={!reminderEnabled}
          >
            <AppText style={[styles.timeButtonText, !reminderEnabled && styles.disabledText]}>{reminderTime}</AppText>
          </TouchableOpacity>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={timeStringToDate(reminderTime)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}

        <AppText style={styles.hint}>
          You&apos;ll get a daily reminder at this time — unless you&apos;ve already logged an
          expense that day. Tapping the notification opens Add Expense; you can also snooze it by an hour.
        </AppText>

        {reminderEnabled && (
          <TouchableOpacity style={styles.testButton} onPress={handleTestReminder}>
            <AppText style={styles.testButtonText}>Reschedule Now</AppText>
          </TouchableOpacity>
        )}
      </View>

      <AppText style={styles.sectionTitle}>Monthly Sadqa Reminder</AppText>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <AppText style={styles.rowLabel}>{sadqaReminderEnabled ? 'Enabled' : 'Disabled'}</AppText>
          <Switch value={sadqaReminderEnabled} onValueChange={handleToggleSadqaReminder} />
        </View>

        <View style={styles.rowBetween}>
          <AppText style={styles.rowLabel}>Remind From Day</AppText>
          <SelectField
            style={styles.daySelect}
            disabled={!sadqaReminderEnabled}
            value={sadqaReminderDay}
            options={DAY_OPTIONS}
            onChange={handleSadqaDayChange}
            title="Remind from day"
          />
        </View>

        <AppText style={styles.hint}>
          If you haven&apos;t logged any Sadqa for the previous month by this day of the current
          month, you&apos;ll get a one-time reminder (checked whenever you open the app).
        </AppText>
      </View>
      <AppText style={styles.sectionTitle}>Cloud Backup</AppText>
      <View style={styles.card}>
        <AppText style={styles.hint}>Back up your data to Google Drive so you can restore it if you switch phones.</AppText>
        <TouchableOpacity style={styles.testButton} onPress={() => router.push('/backup')}>
          <AppText style={styles.testButtonText}>Manage Backup</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 24,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    rowLabel: { fontSize: 14, fontWeight: '600' },
    timeButton: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    timeButtonText: { fontSize: 14, fontWeight: '600', color: c.primary },
    disabledText: { color: c.textMuted },
    daySelect: { width: 110 },
    hint: { fontSize: 12, color: c.textMuted, marginTop: 4, lineHeight: 17 },
    testButton: {
      marginTop: 14,
      backgroundColor: '#2563eb',
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    testButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
