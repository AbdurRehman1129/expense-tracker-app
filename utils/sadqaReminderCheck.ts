import { Alert } from 'react-native';
import { getSetting, setSetting } from '@/db/settings';
import { getDonationTotals } from '@/db/donations';
import { getPreviousMonthRange } from '@/utils/dateRanges';
import { sendSadqaReminderNotification } from '@/utils/notifications';

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * On app open, if the Sadqa reminder is enabled, today's day-of-month has reached the
 * configured reminder day, no Sadqa was logged last calendar month, and we haven't
 * already shown this month's reminder — prompt the user.
 */
export async function checkSadqaReminder() {
  const enabled = (await getSetting('sadqa_reminder_enabled')) === 'true';
  if (!enabled) return;

  const reminderDay = parseInt((await getSetting('sadqa_reminder_day')) ?? '1', 10);
  const today = new Date();
  if (today.getDate() < reminderDay) return;

  const thisMonth = currentYearMonth();
  const lastShown = await getSetting('sadqa_reminder_last_shown_month');
  if (lastShown === thisMonth) return;

  const { start, end } = getPreviousMonthRange();
  const sadqaLastMonth = await getDonationTotals('sadqa', start, end);
  if (sadqaLastMonth > 0) {
    // Already gave last month — nothing to nudge about, but still mark as "seen" this month.
    await setSetting('sadqa_reminder_last_shown_month', thisMonth);
    return;
  }

  await sendSadqaReminderNotification();
  await setSetting('sadqa_reminder_last_shown_month', thisMonth);

  Alert.alert(
    'Sadqa Reminder',
    "You haven't logged any Sadqa last month. Would you like to give some now?",
    [{ text: 'Not Now', style: 'cancel' }, { text: 'OK' }]
  );
}
