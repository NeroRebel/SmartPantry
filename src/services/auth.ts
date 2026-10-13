import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { parseAuthCallback } from '@/utils/auth';

WebBrowser.maybeCompleteAuthSession();

export const authRedirectUri = makeRedirectUri({ scheme: 'smartpantry', path: 'auth/callback', native: 'smartpantry://auth/callback' });

function failure(code: string): never { throw Object.assign(new Error('Authentication failed'), { code }); }

export function createAuthService(client: SupabaseClient | null, redirectTo: string, web = Platform.OS === 'web', browser = WebBrowser.openAuthSessionAsync) {
  const requireClient = () => client ?? failure('configuration_missing');
  // The browser result and the callback route can arrive together. Exchange each code once.
  const callbacks = new Map<string, Promise<Session>>();
  function completeCallback(url: string): Promise<Session> {
    const previous = callbacks.get(url);
    if (previous) return previous;
    const promise = (async () => {
      const callback = parseAuthCallback(url, redirectTo);
      if (!callback || callback.type === 'error') failure('oauth_callback_invalid');
      const auth = requireClient().auth;
      const { data, error } = callback.type === 'code'
        ? await auth.exchangeCodeForSession(callback.code)
        : await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
      if (error) throw error;
      if (!data.session) failure('oauth_callback_error');
      return data.session;
    })();
    if (callbacks.size >= 10) callbacks.delete(callbacks.keys().next().value!);
    callbacks.set(url, promise);
    return promise;
  }
  return {
    async restoreSession() {
      const { data, error } = await requireClient().auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signIn(email: string, password: string) {
      const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return data.session;
    },
    async signUp(name: string, email: string, password: string) {
      const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo } });
      if (error) throw error;
      return { session: data.session, confirmationRequired: !data.session };
    },
    completeCallback,
    async signInWithGoogle() {
      const { data, error } = await requireClient().auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo, skipBrowserRedirect: !web, queryParams: { prompt: 'select_account' },
      } });
      if (error) throw error;
      if (!data.url) failure('oauth_callback_error');
      if (web) return { status: 'redirected' as const, session: null };
      const result = await browser(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' as const, session: null };
      if (result.type !== 'success') failure('oauth_callback_error');
      const session = await completeCallback(result.url);
      return { status: 'success' as const, session };
    },
    async signOut() {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
      callbacks.clear();
    },
  };
}

export const authService = createAuthService(supabase, authRedirectUri);
