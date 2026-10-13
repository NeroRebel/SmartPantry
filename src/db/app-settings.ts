import { initializeDatabase } from './database';
import type { AccentColor, AppSettings, Language, ThemeMode } from '@/types/app-settings';

interface SettingsRow {
  notificationsEnabled: number;
  defaultReminderDays: number;
  language: string | null;
  themeMode: string;
  highContrast: number;
  accentColor: string;
}

const languages: readonly Language[] = ['en', 'sk', 'ru', 'uk', 'hu'];
const modes: readonly ThemeMode[] = ['system', 'light', 'dark'];
const accents: readonly AccentColor[] = ['orange', 'purple', 'green', 'red', 'yellow'];

export function normalizeAppSettings(row: SettingsRow, deviceLanguage = 'en'): AppSettings {
  const language = row.language ?? deviceLanguage;
  return {
    notificationsEnabled: row.notificationsEnabled === 1,
    defaultReminderDays: [0, 1, 2, 3].includes(row.defaultReminderDays) ? row.defaultReminderDays as 0 | 1 | 2 | 3 : 1,
    language: languages.includes(language as Language) ? language as Language : 'en',
    themeMode: modes.includes(row.themeMode as ThemeMode) ? row.themeMode as ThemeMode : 'dark',
    highContrast: row.highContrast === 1,
    accentColor: accents.includes(row.accentColor as AccentColor) ? row.accentColor as AccentColor : 'orange',
  };
}

export async function getAppSettings(deviceLanguage = 'en'): Promise<AppSettings> {
  const db = await initializeDatabase();
  const row = await db.getFirstAsync<SettingsRow>(`SELECT notifications_enabled AS notificationsEnabled,
    default_reminder_days AS defaultReminderDays, language, theme_mode AS themeMode,
    high_contrast AS highContrast, accent_color AS accentColor FROM notification_settings WHERE id = 1`);
  if (!row) throw new Error('App settings are unavailable.');
  return normalizeAppSettings(row, deviceLanguage);
}

export async function saveAppearanceSettings(settings: Pick<AppSettings, 'language' | 'themeMode' | 'highContrast' | 'accentColor'>): Promise<void> {
  if (!languages.includes(settings.language) || !modes.includes(settings.themeMode) || !accents.includes(settings.accentColor)) {
    throw new Error('Invalid appearance settings.');
  }
  const db = await initializeDatabase();
  await db.runAsync(`UPDATE notification_settings SET language = ?, theme_mode = ?, high_contrast = ?, accent_color = ? WHERE id = 1`,
    settings.language, settings.themeMode, settings.highContrast ? 1 : 0, settings.accentColor);
}
