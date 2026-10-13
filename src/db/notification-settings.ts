import { initializeDatabase } from './database';
import type { NotificationSettings } from '@/types/notification-settings';

interface SettingsRow {
  notificationsEnabled: number;
  defaultReminderDays: 0 | 1 | 2 | 3;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<SettingsRow>(`SELECT notifications_enabled AS notificationsEnabled,
    default_reminder_days AS defaultReminderDays FROM notification_settings WHERE id = 1`);
  return { notificationsEnabled: row?.notificationsEnabled === 1, defaultReminderDays: row?.defaultReminderDays ?? 1 };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  if (![0, 1, 2, 3].includes(settings.defaultReminderDays)) throw new Error('Invalid reminder timing.');
  const db = await initializeDatabase();
  await db.runAsync(`UPDATE notification_settings SET notifications_enabled = ?, default_reminder_days = ? WHERE id = 1`,
    settings.notificationsEnabled ? 1 : 0, settings.defaultReminderDays);
}
