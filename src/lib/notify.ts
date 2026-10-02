// Local notifications only: they fire on time with the app closed, and nothing leaves the phone.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { State } from '@/store/store';
import { resolvePrayerSettings, timesFor } from './day';
import { daysUntilBirthday } from './logic';
import { PRAYERS, PRAYER_NAMES } from './praytimes';
import { addDays, addDaysKey, formatClock, hmToMinutes, todayKey, ymdKey, ymdOf, zonedInstant } from './time';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const FOCUS_ID = 'focus-end';

const PRAYER_LINES = [
  'Time to pray. Your work will still be there in ten minutes.',
  'Step away from the screen. Wudu, salah, reset.',
  'A few minutes with Allah, then back to it with a clear head.',
];

export function configureNotifications() {
  if (!native) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function notificationsAllowed(ask: boolean) {
  if (!native) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!ask || !current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('prayer', {
    name: 'Prayer times',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('focus', {
    name: 'Focus timer',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** Rebuilds every scheduled reminder from current data. Safe to call often. */
export async function rescheduleAll(state: Pick<State, 'settings' | 'people'>, now = Date.now()) {
  if (!native || !(await notificationsAllowed(false))) return;
  await ensureChannels();

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing.filter((n) => n.identifier !== FOCUS_ID).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const s = state.settings;
  const { tz, h12 } = resolvePrayerSettings(s);
  const jobs: Notifications.NotificationRequestInput[] = [];

  // Three days of prayer times. iOS keeps at most 64 pending notifications, so we stay well under.
  if (s.prayerAlerts && s.loc) {
    const today = ymdOf(now, tz);
    for (let i = 0; i < 3; i++) {
      const ymd = addDays(today, i);
      const times = timesFor(ymd, s);
      if (!times) continue;
      PRAYERS.forEach((id, n) => {
        const at = times[id];
        if (at == null || at < now + 30000) return;
        jobs.push({
          identifier: `prayer-${ymdKey(ymd)}-${id}`,
          content: {
            title: `${PRAYER_NAMES[id]} · ${formatClock(at, tz, h12)}`,
            body: id === 'fajr' ? 'Prayer is better than sleep.' : PRAYER_LINES[(i + n) % PRAYER_LINES.length],
            sound: 'default',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'prayer' },
        });
      });
    }
  }

  const daily = (hm: string, title: string, body: string, id: string) => {
    const min = hmToMinutes(hm);
    jobs.push({
      identifier: id,
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(min / 60),
        minute: min % 60,
        channelId: 'reminders',
      },
    });
  };
  if (s.morningReminder) daily(s.morningReminder, 'Plan your day', 'Pick your top three, check your habits, see who to call.', 'morning');
  if (s.eveningReminder) daily(s.eveningReminder, 'Close your day', 'Sixty seconds: one win and one thing you are grateful for.', 'evening');

  // Birthdays in the next 60 days, at 9am on the day.
  const today = todayKey(tz, now);
  for (const p of state.people) {
    const inDays = daysUntilBirthday(p.birthday, today);
    if (inDays == null || inDays > 60) continue;
    const at = zonedInstant(addDaysKey(today, inDays), '09:00', tz);
    if (at < now) continue;
    jobs.push({
      identifier: `birthday-${p.id}`,
      content: { title: `${p.name}’s birthday`, body: 'Call, send a message, or plan something small.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    });
  }

  await Promise.all(jobs.map((j) => Notifications.scheduleNotificationAsync(j).catch(() => null)));
}

export async function scheduleFocusEnd(at: number, title: string, body: string) {
  if (!native || !(await notificationsAllowed(false))) return;
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: { title, body, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'focus' },
  }).catch(() => null);
}

export async function cancelFocusEnd() {
  if (!native) return;
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}
