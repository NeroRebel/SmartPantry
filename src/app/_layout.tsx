import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { SyncProvider, useSync } from '@/sync/sync-context';
import { useTranslation } from 'react-i18next';
import { AppearanceProvider, useAppTheme } from '@/theme/theme-context';

function RootNavigator() {
  const { colors, mode } = useAppTheme();
  const { session, loading, recovering, passwordRecoveryComplete, processingCallback } = useAuth();
  const { localReady, localError, retryLocal } = useSync();
  const { t } = useTranslation();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: colors.background,
    card: colors.surface, primary: colors.accent, text: colors.text, border: colors.border, notification: colors.expired } };
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {loading || (!!session && !localReady) ? <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>{localError ? <><Text style={{ color: colors.danger, textAlign: 'center' }}>{t('sync.localError')}</Text><Pressable accessibilityRole="button" onPress={retryLocal}><Text style={{ color: colors.accent, padding: 12 }}>{t('common.retry')}</Text></Pressable></> : <ActivityIndicator size="large" color={colors.accent} />}</View> :
        <Stack initialRouteName={session ? '(tabs)' : '(auth)'} screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!session || recovering || passwordRecoveryComplete}><Stack.Screen name="(auth)" /></Stack.Protected>
          <Stack.Protected guard={!!session && !recovering && !passwordRecoveryComplete && !processingCallback}>
            {['(tabs)', 'product/add', 'product/scanned', 'product/search', 'product/[id]', 'product/[id]/edit',
              'recipe/[id]', 'shopping-list', 'statistics', 'settings/data', 'settings/language', 'settings/appearance', 'settings/change-password', 'settings/change-email', 'settings/delete-account', 'about', 'profile'].map((name) => <Stack.Screen key={name} name={name} options={name === 'settings/delete-account' ? { gestureEnabled: false } : undefined} />)}
          </Stack.Protected>
          <Stack.Screen name="auth/callback" />
        </Stack>}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <AppearanceProvider><AuthProvider><SyncProvider><RootNavigator /></SyncProvider></AuthProvider></AppearanceProvider>;
}
