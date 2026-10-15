import { Platform } from 'react-native';

import { getNotificationSettings, saveNotificationSettings } from '@/db/notification-settings';
import { getProductById, getProductReminderCandidates, getProducts, setProductNotificationId } from '@/db/products';
import type { Product } from '@/types/product';
import type { NotificationSettings } from '@/types/notification-settings';
import { getReminderBody, getReminderDate } from '@/utils/expiration-reminder';
import { getLocalUserId } from '@/db/local-state';
import { withOwnedData } from '@/db/owned-data';
import { isAccountBlocked } from './account-lock';
import { initializeDatabase } from '@/db/database';

const channelId = 'expiration-reminders';
let configured = false;
let reminderTasks: Promise<unknown> = Promise.resolve();

async function notificationModule() {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: 'Expiration reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    configured = true;
  }
  return Notifications;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  try {
    const Notifications = await notificationModule();
    if (!Notifications) return 'unavailable';
    const status = await Notifications.getPermissionsAsync();
    return status.granted ? 'granted' : status.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await notificationModule();
    if (!Notifications) return false;
    const current = await Notifications.getPermissionsAsync();
    return current.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function scheduleExpirationNotification(product: Product, daysBefore: number): Promise<string | null> {
  const owner = getLocalUserId();
  const date = getReminderDate(product.expirationDate, daysBefore);
  if (!date || !await requestNotificationPermissions()) return null;
  if (owner !== getLocalUserId() || isAccountBlocked(owner)) return null;
  try {
    const Notifications = await notificationModule();
    if (!Notifications) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${product.name} expires soon`,
        body: getReminderBody(product.name, daysBefore),
        data: { productId: product.id, userId: owner, kind: 'smartpantry-expiration' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
    });
    if (isAccountBlocked(owner) || owner !== getLocalUserId()) { await Notifications.cancelScheduledNotificationAsync(id); return null; }
    return id;
  } catch (error) {
    if (__DEV__) console.warn('[SmartPantry] Could not schedule reminder:', error);
    return null;
  }
}

export async function cancelExpirationNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  const Notifications = await notificationModule();
  if (Notifications) await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelDeletedAccountReminders(userId: string): Promise<void> {
  if (!userId) throw new Error('Missing account');
  const run = reminderTasks.then(async () => {
    const db = await initializeDatabase();
    const rows = await db.getAllAsync<{ notification_id: string }>('SELECT notification_id FROM products WHERE user_id = ? AND notification_id IS NOT NULL', userId);
    const ids = new Set(rows.map((row) => row.notification_id));
    const notifications = await notificationModule();
    if (notifications) {
      for (const item of await notifications.getAllScheduledNotificationsAsync()) {
        if (item.content.data?.kind === 'smartpantry-expiration' && item.content.data?.userId === userId) ids.add(item.identifier);
      }
      for (const id of ids) await notifications.cancelScheduledNotificationAsync(id);
    }
  });
  reminderTasks = run.catch(() => {});
  await run;
}

export async function rescheduleExpirationNotification(product: Product, settings: NotificationSettings): Promise<void> {
  const owner = getLocalUserId();
  const run = reminderTasks.then(async () => {
    if (owner !== getLocalUserId() || isAccountBlocked(owner)) return;
    const current = await getProductById(product.id);
    if (!current || owner !== getLocalUserId()) return;
    if (current.notificationId) {
      await cancelExpirationNotification(current.notificationId);
      await setProductNotificationId(current.id, null, owner);
    }
    if (!settings.notificationsEnabled || owner !== getLocalUserId()) return;
    const notificationId = await scheduleExpirationNotification(current, settings.defaultReminderDays);
    if (!notificationId) { if (owner === getLocalUserId()) await setProductNotificationId(current.id, null, owner); return; }
    try {
      if (owner !== getLocalUserId()) { await cancelExpirationNotification(notificationId); return; }
      await setProductNotificationId(current.id, notificationId, owner);
    } catch (error) { await cancelExpirationNotification(notificationId); throw error; }
  });
  reminderTasks = run.catch(() => {});
  await run;
}

export async function reconcileAccountReminders(): Promise<void> {
  const owner = getLocalUserId();
  const run = reminderTasks.then(async () => {
    if (owner !== getLocalUserId()) return;
    const obsolete = await withOwnedData((db) => db.getAllAsync<{ id: string; user_id: string; notification_id: string }>(
      "SELECT id, user_id, notification_id FROM products WHERE notification_id IS NOT NULL AND (? = '' OR user_id <> ? OR deleted_at IS NOT NULL)", owner, owner));
    for (const product of obsolete) {
      if (owner !== getLocalUserId()) return;
      await cancelExpirationNotification(product.notification_id);
      await withOwnedData((db) => db.runAsync('UPDATE products SET notification_id = NULL WHERE id = ? AND user_id = ? AND notification_id = ?', product.id, product.user_id, product.notification_id));
    }
  });
  reminderTasks = run.catch(() => {});
  await run;
}

export async function syncProductReminder(productId: string): Promise<void> {
  const [product, settings] = await Promise.all([getProductById(productId), getNotificationSettings()]);
  if (product) await rescheduleExpirationNotification(product, settings);
}

export async function rescheduleAllProductReminders(settings: NotificationSettings): Promise<void> {
  for (const product of await getProducts()) await rescheduleExpirationNotification(product, settings);
}

export async function restoreProductReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  const settings = await getNotificationSettings();
  if (!settings.notificationsEnabled || !await requestNotificationPermissions()) return;
  for (const product of await getProductReminderCandidates()) await rescheduleExpirationNotification(product, settings);
}

export async function setNotificationsEnabled(enabled: boolean): Promise<NotificationSettings> {
  if (enabled && !await requestNotificationPermissions()) throw new Error('Notification permission was not granted. Enable it in your device settings.');
  const settings = { ...await getNotificationSettings(), notificationsEnabled: enabled };
  await saveNotificationSettings(settings);
  await rescheduleAllProductReminders(settings);
  return settings;
}

export async function setDefaultReminderDays(days: NotificationSettings['defaultReminderDays']): Promise<NotificationSettings> {
  const settings = { ...await getNotificationSettings(), defaultReminderDays: days };
  await saveNotificationSettings(settings);
  await rescheduleAllProductReminders(settings);
  return settings;
}
