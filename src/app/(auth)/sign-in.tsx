import { AuthForm } from '@/components/auth-form';
import { useLocalSearchParams } from 'expo-router';
export default function SignInScreen() {
  const { accountDeleted } = useLocalSearchParams<{ accountDeleted?: string }>();
  return <AuthForm mode="sign-in" successMessage={accountDeleted === '1' ? 'account.deleted' : undefined} />;
}
