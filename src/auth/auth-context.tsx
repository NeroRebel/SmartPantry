import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth';
import { authErrorKey } from '@/utils/auth';
import { readPendingVerification, savePendingVerification, type PendingVerification } from '@/services/pending-verification';
import { isValidVerificationEmail, RESEND_COOLDOWN_SECONDS } from '@/utils/email-verification';
import { avatarService } from '@/services/avatars';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import { readRecoveryUser, saveRecoveryUser } from '@/services/password-recovery';

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState({ value: 0 });
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [passwordRecoveryComplete, setPasswordRecoveryComplete] = useState(false);
  const user = session?.user ?? null;
  const avatarUrl = useUserAvatar(user);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event !== 'INITIAL_SESSION') eventReceived = true;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY' && next) {
        setPasswordRecoveryComplete(false);
        setRecoveryUserId(next.user.id);
        void saveRecoveryUser(next.user.id).catch(() => {});
      } else if (!next) {
        setPasswordRecoveryComplete(false);
        setRecoveryUserId(null);
        void saveRecoveryUser(null).catch(() => {});
      }
      if (next) {
        setPendingVerification(null);
        void savePendingVerification(null);
      }
    });
    const timeout = setTimeout(() => {
      if (active) { setRestoreError('auth.restoreError'); setLoading(false); }
    }, 15000);
    void Promise.all([authService.restoreSession(), readPendingVerification(), readRecoveryUser()]).then(([stored, pending, recoveryId]) => {
      if (active && !eventReceived) {
        setSession(stored);
        setPendingVerification(stored ? null : pending);
        setRecoveryUserId(stored?.user.id === recoveryId ? recoveryId : null);
        if (stored) void savePendingVerification(null);
      }
    }).catch(() => { if (active) setRestoreError('auth.restoreError'); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    const updateRefresh = () => {
      if (Platform.OS === 'web') return;
      if (AppState.currentState === 'active') supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    };
    updateRefresh();
    const state = AppState.addEventListener('change', updateRefresh);
    return () => { active = false; clearTimeout(timeout); subscription.unsubscribe(); state.remove(); if (Platform.OS !== 'web') supabase!.auth.stopAutoRefresh(); };
  }, [restoreAttempt]);
  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    setSession(next); setRestoreError(null);
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const result = await authService.signUp(name, email, password);
    if (result.session) setSession(result.session);
    if (result.confirmationRequired) {
      const pending = { email: email.trim(), resendAvailableAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000 };
      setPendingVerification(pending);
      await savePendingVerification(pending);
    }
    setRestoreError(null);
    return result.confirmationRequired;
  }, []);
  const prepareEmailConfirmation = useCallback(async (email: string) => {
    if (!isValidVerificationEmail(email)) throw Object.assign(new Error('Invalid email'), { code: 'email_address_invalid' });
    const sameEmail = pendingVerification?.email.toLowerCase() === email.trim().toLowerCase();
    const pending = { email: email.trim(), resendAvailableAt: sameEmail ? pendingVerification!.resendAvailableAt : 0 };
    setPendingVerification(pending);
    await savePendingVerification(pending);
  }, [pendingVerification]);
  const resendConfirmationEmail = useCallback(async (email: string) => {
    if (pendingVerification?.email.toLowerCase() === email.trim().toLowerCase() && pendingVerification.resendAvailableAt > Date.now()) return false;
    await authService.resendConfirmationEmail(email);
    const pending = { email: email.trim(), resendAvailableAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000 };
    setPendingVerification(pending);
    await savePendingVerification(pending);
    return true;
  }, [pendingVerification]);
  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    if (result.session) { setSession(result.session); setRestoreError(null); }
    return result.status;
  }, []);
  const completeCallback = useCallback(async (url: string) => {
    setProcessingCallback(true);
    try {
      const next = await authService.completeCallback(url, !!pendingVerification);
      const recovery = !!next && authService.isRecoveryCallback(url);
      if (recovery) {
        setPasswordRecoveryComplete(false);
        setRecoveryUserId(next!.user.id);
        await saveRecoveryUser(next!.user.id).catch(() => {});
      }
      if (next) { setSession(next); setRestoreError(null); }
      return recovery ? 'recovery' as const : next ? 'authenticated' as const : 'confirmed' as const;
    } finally { setProcessingCallback(false); }
  }, [pendingVerification]);
  const signOut = useCallback(async () => {
    await authService.signOut(); setSession(null); setRecoveryUserId(null); setPasswordRecoveryComplete(false); setRestoreError(null);
    await saveRecoveryUser(null).catch(() => {});
  }, []);
  const sendPasswordReset = useCallback((email: string) => authService.sendPasswordReset(email), []);
  const reauthenticate = useCallback(() => authService.reauthenticate(), []);
  const updatePassword = useCallback(async (password: string, confirmation: string, nonce?: string) => {
    const updated = await authService.updatePassword(password, confirmation, nonce);
    // Clear the restart marker before admitting the recovery session to protected screens.
    await saveRecoveryUser(null).catch(() => {});
    setPasswordRecoveryComplete(!!user && recoveryUserId === user.id);
    setRecoveryUserId(null);
    setSession((current) => current?.user.id === updated.id ? { ...current, user: updated } : current);
  }, [user, recoveryUserId]);
  const recovering = !!user && recoveryUserId === user.id;
  const finishPasswordRecovery = useCallback(() => setPasswordRecoveryComplete(false), []);
  const updateDisplayName = useCallback(async (name: string) => {
    const updated = await authService.updateDisplayName(name);
    setSession((current) => current?.user.id === updated.id ? { ...current, user: updated } : current);
  }, []);
  const uploadAvatar = useCallback(async (buffer: ArrayBuffer) => {
    if (!user) throw Object.assign(new Error('Session changed'), { code: 'avatar.sessionChanged' });
    const updated = await avatarService.upload(user, buffer);
    setSession((current) => current?.user.id === updated.id ? { ...current, user: updated } : current);
  }, [user]);
  const removeAvatar = useCallback(async () => {
    if (!user) throw Object.assign(new Error('Session changed'), { code: 'avatar.sessionChanged' });
    const updated = await avatarService.remove(user);
    setSession((current) => current?.user.id === updated.id ? { ...current, user: updated } : current);
  }, [user]);
  const retryRestore = useCallback(() => {
    if (!supabase) return;
    setLoading(true); setRestoreError(null);
    setRestoreAttempt((value) => ({ value: value.value + 1 }));
  }, []);
  return useMemo(() => ({ session, user, recovering, passwordRecoveryComplete, finishPasswordRecovery, processingCallback, sendPasswordReset, updatePassword, reauthenticate, avatarUrl, uploadAvatar, removeAvatar, loading, restoreError, pendingVerification, prepareEmailConfirmation, resendConfirmationEmail,
    configured: !!supabase, signIn, signUp, signInWithGoogle, signOut, updateDisplayName, completeCallback, retryRestore, authErrorKey }),
  [session, user, recovering, passwordRecoveryComplete, finishPasswordRecovery, processingCallback, sendPasswordReset, updatePassword, reauthenticate, avatarUrl, uploadAvatar, removeAvatar, loading, restoreError, pendingVerification, prepareEmailConfirmation, resendConfirmationEmail, signIn, signUp, signInWithGoogle, signOut, updateDisplayName, completeCallback, retryRestore]);
}

const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing');
  return context;
}
