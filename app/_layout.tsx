import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDatabase } from '@/db/schema';
import {
  requestNotificationPermissions,
  registerNotificationCategories,
  scheduleDailyReminder,
  scheduleSnoozeReminder,
} from '@/utils/notifications';
import { checkAndPromptRecurringExpenses } from '@/utils/recurringCheck';
import { checkSadqaReminder } from '@/utils/sadqaReminderCheck';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .then(() => registerNotificationCategories())
      .then(() => scheduleDailyReminder())
      .then(() => checkAndPromptRecurringExpenses())
      .then(() => checkSadqaReminder())
      .catch((err) => console.error('Database init failed:', err));
    requestNotificationPermissions();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      if (actionId === 'snooze') {
        scheduleSnoozeReminder(60).catch((err) => console.error('Snooze failed:', err));
        return;
      }
      // Default tap or "Log Now" both take the user to Add Expense
      router.push('/(tabs)/add-expense');
    });

    return () => subscription.remove();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="income" options={{ title: 'Income' }} />
        <Stack.Screen name="donation-due" options={{ title: 'Log Donation' }} />
        <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
        <Stack.Screen name="recurring-expenses" options={{ title: 'Recurring Expenses' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}