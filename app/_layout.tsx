import 'react-native-get-random-values';
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { GoogleBackupProvider } from '@/contexts/GoogleBackupContext';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDatabase } from '@/db/schema';
import { getSetting } from '@/db/settings';
import {
  AppThemeProvider,
  ThemePreference,
  isThemePreference,
  useTheme,
} from '@/contexts/ThemeContext';
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
  const systemScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

  useEffect(() => {
    initDatabase()
      .then(async () => {
        // Read the saved theme in the same step, so the first real frame is already correct.
        const saved = await getSetting('theme_preference');
        if (isThemePreference(saved)) setThemePreference(saved);
        setDbReady(true);
      })
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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: systemScheme === 'dark' ? '#0B0F14' : '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppThemeProvider initialPreference={themePreference}>
      <KeyboardProvider>
        <GoogleBackupProvider>
          <ThemedNavigation />
        </GoogleBackupProvider>
      </KeyboardProvider>
    </AppThemeProvider>
  );
}

function ThemedNavigation() {
  const { colors, scheme } = useTheme();

  const navigationTheme: Theme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="income" options={{ title: 'Income' }} />
        <Stack.Screen name="donation-due" options={{ title: 'Log Donation' }} />
        <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
        <Stack.Screen name="recurring-expenses" options={{ title: 'Recurring Expenses' }} />
        <Stack.Screen name="backup" options={{ title: 'Backup & Restore' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="edit/expense/[id]" options={{ title: 'Edit Expense' }} />
        <Stack.Screen name="edit/income/[id]" options={{ title: 'Edit Income' }} />
        <Stack.Screen name="edit/donation/[id]" options={{ title: 'Edit Donation' }} />
        <Stack.Screen name="edit/due/[id]" options={{ title: 'Edit Pledge' }} />
        <Stack.Screen name="edit/recurring/[id]" options={{ title: 'Edit Recurring Expense' }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
