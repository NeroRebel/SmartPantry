import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';

import { restoreProductReminders } from '@/services/notifications';
import { AppearanceProvider, useAppTheme } from '@/theme/theme-context';

function RootNavigator() {
  const { colors, mode } = useAppTheme();
  const { session, loading } = useAuth();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: colors.background,
    card: colors.surface, primary: colors.accent, text: colors.text, border: colors.border, notification: colors.expired } };
  useEffect(() => { void restoreProductReminders().catch((error) => {
    if (__DEV__) console.warn('[SmartPantry] Could not restore reminders:', error);
  }); }, []);
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {loading ? <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.accent} /></View> :
        <Stack initialRouteName={session ? '(tabs)' : '(auth)'} screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!session}><Stack.Screen name="(auth)" /></Stack.Protected>
          <Stack.Protected guard={!!session}>
            {['(tabs)', 'product/add', 'product/scanned', 'product/search', 'product/[id]', 'product/[id]/edit',
              'recipe/[id]', 'shopping-list', 'statistics', 'settings/data', 'settings/language', 'settings/appearance', 'about', 'profile'].map((name) => <Stack.Screen key={name} name={name} />)}
          </Stack.Protected>
          <Stack.Screen name="auth/callback" />
        </Stack>}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <AppearanceProvider><AuthProvider><RootNavigator /></AuthProvider></AppearanceProvider>;
}
