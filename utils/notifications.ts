import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting } from '@/db/settings';
import { hasExpenseLoggedToday } from '@/db/expenses';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'daily-expense-reminder';
const DAILY_REMINDER_CATEGORY = 'daily-reminder-actions';

export async function requestNotificationPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Registers the "Log Now" / "Snooze" action buttons shown on the daily reminder. Call once at startup. */
export async function registerNotificationCategories() {
  await Notifications.setNotificationCategoryAsync(DAILY_REMINDER_CATEGORY, [
    { identifier: 'log-now', buttonTitle: 'Log Now' },
    { identifier: 'snooze', buttonTitle: 'Snooze 1h' },
  ]);
}

export async function sendBudgetExceededNotification(categoryName: string, spent: number, limit: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Budget Exceeded',
      body: `You've spent Rs ${spent.toFixed(0)} on ${categoryName} this month — over your Rs ${limit.toFixed(0)} budget.`,
    },
    trigger: null,
  });
}
export async function sendRecurringDueNotification(categoryName: string, amount: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recurring Payment Due',
      body: `Your recurring payment for ${categoryName} (Rs ${amount.toFixed(0)}) is due. Open the app to add it.`,
    },
    trigger: null,
  });
}

export async function sendSadqaReminderNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sadqa Reminder',
      body: "You haven't logged any Sadqa last month. Consider giving something this month.",
    },
    trigger: null,
  });
}

/**
 * (Re)schedules the daily "log your expenses" reminder based on current settings.
 * - If disabled, cancels any pending reminder.
 * - If an expense was already logged today, skips today and schedules for tomorrow.
 * - Otherwise schedules for today at the configured time (or tomorrow if that time has passed).
 * Call this on app launch, whenever settings change, and right after any expense is added.
 */
export async function scheduleDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

  const enabled = (await getSetting('reminder_enabled')) === 'true';
  if (!enabled) return;

  const timeStr = (await getSetting('reminder_time')) ?? '21:00';
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));

  const loggedToday = await hasExpenseLoggedToday();

  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);

  if (loggedToday || target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Log Today\u2019s Expenses',
      body: "Don't forget to add today's spending to your tracker.",
      categoryIdentifier: DAILY_REMINDER_CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
}

/** Schedules a one-time snoozed reminder `minutes` from now. */
export async function scheduleSnoozeReminder(minutes: number) {
  const target = new Date(Date.now() + minutes * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: `${DAILY_REMINDER_ID}-snooze`,
    content: {
      title: 'Log Today\u2019s Expenses',
      body: "Snoozed reminder — don't forget to add today's spending.",
      categoryIdentifier: DAILY_REMINDER_CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
}