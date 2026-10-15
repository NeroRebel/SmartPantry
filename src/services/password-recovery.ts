import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'smartpantry.auth.recovery-user';

// Only a routing marker. Supabase must still restore a real session for this user.
export async function readRecoveryUser(): Promise<string | null> {
  try { return await AsyncStorage.getItem(key); } catch { return null; }
}

export async function saveRecoveryUser(userId: string | null): Promise<void> {
  if (userId) await AsyncStorage.setItem(key, userId);
  else await AsyncStorage.removeItem(key);
}
