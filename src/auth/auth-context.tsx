import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth';
import { authErrorKey } from '@/utils/auth';

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState({ value: 0 });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event !== 'INITIAL_SESSION') eventReceived = true;
      setSession(next);
    });
    const timeout = setTimeout(() => {
      if (active) { setRestoreError('auth.restoreError'); setLoading(false); }
    }, 15000);
    void authService.restoreSession().then((stored) => {
      if (active && !eventReceived) setSession(stored);
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
    setRestoreError(null);
    return result.confirmationRequired;
  }, []);
  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    if (result.session) { setSession(result.session); setRestoreError(null); }
    return result.status;
  }, []);
  const completeCallback = useCallback(async (url: string) => {
    const next = await authService.completeCallback(url);
    setSession(next); setRestoreError(null);
  }, []);
  const signOut = useCallback(async () => {
    await authService.signOut(); setSession(null); setRestoreError(null);
  }, []);
  const retryRestore = useCallback(() => {
    if (!supabase) return;
    setLoading(true); setRestoreError(null);
    setRestoreAttempt((value) => ({ value: value.value + 1 }));
  }, []);
  return useMemo(() => ({ session, user: session?.user ?? null, loading, restoreError,
    configured: !!supabase, signIn, signUp, signInWithGoogle, signOut, completeCallback, retryRestore, authErrorKey }),
  [session, loading, restoreError, signIn, signUp, signInWithGoogle, signOut, completeCallback, retryRestore]);
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
