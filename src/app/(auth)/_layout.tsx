import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-context';
import { getSystemBarStyle } from '@/utils/system-ui';
import { useSystemUI } from '@/theme/system-ui-context';
export const unstable_settings = { initialRouteName: 'sign-in' };
export default function AuthLayout() {
  const { recovering, passwordRecoveryComplete } = useAuth();
  const { colors, mode } = useAppTheme();
  const { hidden } = useSystemUI();
  const path = usePathname();
  if ((recovering || passwordRecoveryComplete) && path !== '/reset-password') return <Redirect href="/(auth)/reset-password" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background },
    statusBarStyle: getSystemBarStyle(mode), statusBarHidden: hidden }} />;
}
