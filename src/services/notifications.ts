import { Platform } from 'react-native';

import { getNotificationSettings, saveNotificationSettings } from '@/db/notification-settings';
import { getProductById, getProducts, setProductNotificationId } from '@/db/products';
import type { Product } from '@/types/product';
import type { NotificationSettings } from '@/types/notification-settings';
import { getReminderBody, getReminderDate } from '@/utils/expiration-reminder';

const channelId = 'expiration-reminders';
let configured = false;

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
  const date = getReminderDate(product.expirationDate, daysBefore);
  if (!date || !await requestNotificationPermissions()) return null;
  try {
    const Notifications = await notificationModule();
    if (!Notifications) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${product.name} expires soon`,
        body: getReminderBody(product.name, daysBefore),
        data: { productId: product.id, kind: 'smartpantry-expiration' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
    });
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

export async function rescheduleExpirationNotification(product: Product, settings: NotificationSettings): Promise<void> {
  if (product.notificationId) {
    await cancelExpirationNotification(product.notificationId);
    await setProductNotificationId(product.id, null);
  }
  if (!settings.notificationsEnabled) return;
  const notificationId = await scheduleExpirationNotification(product, settings.defaultReminderDays);
  if (!notificationId) return;
  try {
    await setProductNotificationId(product.id, notificationId);
  } catch (error) {
    await cancelExpirationNotification(notificationId);
    throw error;
  }
}

export async function syncProductReminder(productId: number): Promise<void> {
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
  for (const product of await getProducts()) {
    if (!product.notificationId) await rescheduleExpirationNotification(product, settings);
  }
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
