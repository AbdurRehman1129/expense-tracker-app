import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';

import { getSetting, setSetting } from '@/db/settings';
import { scheduleDailyReminder } from '@/utils/notifications';

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

export default function SettingsScreen() {
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
        <Text>Loading settings…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Daily Expense Reminder</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>{reminderEnabled ? 'Enabled' : 'Disabled'}</Text>
          <Switch value={reminderEnabled} onValueChange={handleToggleReminder} />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Reminder Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
            disabled={!reminderEnabled}
          >
            <Text style={[styles.timeButtonText, !reminderEnabled && styles.disabledText]}>{reminderTime}</Text>
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

        <Text style={styles.hint}>
          You&apos;ll get a daily reminder at this time — unless you&apos;ve already logged an
          expense that day. Tapping the notification opens Add Expense; you can also snooze it by an hour.
        </Text>

        {reminderEnabled && (
          <TouchableOpacity style={styles.testButton} onPress={handleTestReminder}>
            <Text style={styles.testButtonText}>Reschedule Now</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Monthly Sadqa Reminder</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>{sadqaReminderEnabled ? 'Enabled' : 'Disabled'}</Text>
          <Switch value={sadqaReminderEnabled} onValueChange={handleToggleSadqaReminder} />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Remind From Day</Text>
          <View style={styles.dayPickerWrapper}>
            <Picker
              enabled={sadqaReminderEnabled}
              selectedValue={sadqaReminderDay}
              onValueChange={(val) => handleSadqaDayChange(Number(val))}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <Picker.Item key={day} label={String(day)} value={day} />
              ))}
            </Picker>
          </View>
        </View>

        <Text style={styles.hint}>
          If you haven&apos;t logged any Sadqa for the previous month by this day of the current
          month, you&apos;ll get a one-time reminder (checked whenever you open the app).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  card: {
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  timeButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  disabledText: { color: '#aaa' },
  dayPickerWrapper: {
    width: 110,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  testButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  testButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
