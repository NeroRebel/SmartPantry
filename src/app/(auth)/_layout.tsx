import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
export const unstable_settings = { initialRouteName: 'sign-in' };
export default function AuthLayout() {
  const { recovering, passwordRecoveryComplete } = useAuth();
  const path = usePathname();
  if ((recovering || passwordRecoveryComplete) && path !== '/reset-password') return <Redirect href="/(auth)/reset-password" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
