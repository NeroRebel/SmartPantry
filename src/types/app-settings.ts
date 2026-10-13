import type { NotificationSettings } from './notification-settings';

export type Language = 'en' | 'sk' | 'ru' | 'uk' | 'hu';
export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'orange' | 'purple' | 'green' | 'red' | 'yellow';

export interface AppSettings extends NotificationSettings {
  language: Language;
  themeMode: ThemeMode;
  highContrast: boolean;
  accentColor: AccentColor;
}
