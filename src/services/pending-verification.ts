import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidVerificationEmail, RESEND_COOLDOWN_SECONDS } from '@/utils/email-verification';

export interface PendingVerification { email: string; resendAvailableAt: number }
const key = 'smartpantry.auth.pending-verification';

export async function readPendingVerification(): Promise<PendingVerification | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const stored = value as Partial<PendingVerification>;
    if (typeof stored.email !== 'string' || !isValidVerificationEmail(stored.email)) return null;
    const deadline = typeof stored.resendAvailableAt === 'number' && Number.isFinite(stored.resendAvailableAt) ? stored.resendAvailableAt : 0;
    return { email: stored.email.trim(), resendAvailableAt: Math.min(deadline, Date.now() + RESEND_COOLDOWN_SECONDS * 1000) };
  } catch { return null; }
}

// Keep only these two fields; never persist passwords, OTPs or auth responses here.
export async function savePendingVerification(value: PendingVerification | null): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(key, JSON.stringify({ email: value.email, resendAvailableAt: value.resendAvailableAt }));
    else await AsyncStorage.removeItem(key);
  } catch { /* In-memory verification remains usable if local storage is unavailable. */ }
}
