import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { restoreProductReminders } from '@/services/notifications';
import { AppearanceProvider, useAppTheme } from '@/theme/theme-context';

function RootNavigator() {
  const { colors, mode } = useAppTheme();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: colors.background,
    card: colors.surface, primary: colors.accent, text: colors.text, border: colors.border, notification: colors.expired } };
  useEffect(() => { void restoreProductReminders().catch((error) => {
    if (__DEV__) console.warn('[SmartPantry] Could not restore reminders:', error);
  }); }, []);
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <AppearanceProvider><RootNavigator /></AppearanceProvider>;
}
