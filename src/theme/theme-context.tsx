import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getAppSettings, saveAppearanceSettings } from '@/db/app-settings';
import { i18n } from '@/i18n';
import type { AppSettings } from '@/types/app-settings';
import { createTheme, resolveThemeMode, type AppColors } from './theme';

const defaults: AppSettings = {
  language: 'en', themeMode: 'dark', highContrast: false, accentColor: 'orange',
  notificationsEnabled: true, defaultReminderDays: 1,
};

type AppearancePatch = Partial<Pick<AppSettings, 'language' | 'themeMode' | 'highContrast' | 'accentColor'>>;

const AppearanceContext = createContext<{
  settings: AppSettings;
  colors: AppColors;
  mode: 'light' | 'dark';
  updateAppearance: (patch: AppearancePatch) => Promise<void>;
} | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [settings, setSettings] = useState(defaults);
  const current = useRef(defaults);
  useEffect(() => {
    let active = true;
    const language = getLocales()[0]?.languageCode ?? 'en';
    void getAppSettings(language).then((stored) => {
      if (!active) return;
      current.current = stored;
      setSettings(stored);
      void i18n.changeLanguage(stored.language);
    }).catch(() => { if (__DEV__) console.warn('[SmartPantry] Could not load appearance'); });
    return () => { active = false; };
  }, []);

  const updateAppearance = useCallback(async (patch: AppearancePatch) => {
    const previous = current.current;
    const next = { ...previous, ...patch };
    current.current = next;
    setSettings(next);
    if (patch.language) await i18n.changeLanguage(patch.language);
    try { await saveAppearanceSettings(next); }
    catch (error) {
      current.current = previous;
      setSettings(previous);
      void i18n.changeLanguage(previous.language);
      throw error;
    }
  }, []);

  const mode = resolveThemeMode(settings.themeMode, system === 'light' ? 'light' : 'dark');
  const colors = useMemo(() => createTheme(mode, settings.highContrast, settings.accentColor).colors,
    [mode, settings.highContrast, settings.accentColor]);
  const value = useMemo(() => ({ settings, colors, mode, updateAppearance }), [settings, colors, mode, updateAppearance]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('AppearanceProvider is missing.');
  return context;
}

export function useThemedStyles<T>(factory: (colors: AppColors) => T): { colors: AppColors; styles: T } {
  const { colors } = useAppTheme();
  const styles = useMemo(() => factory(colors), [colors, factory]);
  return { colors, styles };
}
