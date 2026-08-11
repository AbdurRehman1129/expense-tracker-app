import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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