import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { hasEmailIdentity, inspectAuthCallback, validateDisplayName, validateNewPassword } from '@/utils/auth';
import { isValidVerificationEmail } from '@/utils/email-verification';

WebBrowser.maybeCompleteAuthSession();

export const emailConfirmationRedirectUri = 'smartpantry://auth/callback';
export const authRedirectUri = makeRedirectUri({ scheme: 'smartpantry', path: 'auth/callback', native: emailConfirmationRedirectUri });

function failure(code: string): never { throw Object.assign(new Error('Authentication failed'), { code }); }

function logPasswordError(operation: string, error: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const value = error && typeof error === 'object' ? error as { code?: unknown; name?: unknown; status?: unknown } : {};
  // SDK classifications are useful for diagnosis; never print the request, message or session.
  const label = (input: unknown) => typeof input === 'string' && /^[a-zA-Z_]{1,80}$/.test(input) ? input : undefined;
  console.warn('[SmartPantry] Password request failed', {
    operation, code: label(value.code), name: label(value.name), status: typeof value.status === 'number' ? value.status : undefined,
  });
}

export function createAuthService(client: SupabaseClient | null, redirectTo: string, web = Platform.OS === 'web', browser = WebBrowser.openAuthSessionAsync) {
  const requireClient = () => client ?? failure('configuration_missing');
  let googleRequests = 0;
  // The browser result and the callback route can arrive together. Exchange each code once.
  const callbacks = new Map<string, Promise<Session | null>>();
  const recoveryCallbacks = new Set<string>();
  function completeCallback(url: string, pendingEmailConfirmation = false): Promise<Session | null> {
    const previous = callbacks.get(url);
    if (previous) return previous;
    const promise = (async () => {
      const info = inspectAuthCallback(url, redirectTo, pendingEmailConfirmation && googleRequests === 0);
      async function refreshEmailChangeSession(): Promise<Session | null> {
        if (!info.emailChangeDetected) return null;
        const auth = requireClient().auth;
        const { data: current, error: sessionError } = await auth.getSession();
        if (sessionError) throw sessionError;
        if (!current.session) return null;
        // A sessionless confirmation can still update a previously signed-in account.
        const { data, error } = await auth.refreshSession();
        if (error) throw error;
        return data.session;
      }
      const callback = info.callback;
      if (info.linkExpired) failure('otp_expired');
      if (!callback || callback.type === 'error') failure(info.recoveryDetected ? 'recovery_link_invalid' : 'oauth_callback_invalid');
      if (callback.type === 'empty') {
        if (info.recoveryDetected) failure('recovery_link_invalid');
        if (info.emailChangeDetected) return await refreshEmailChangeSession();
        if (info.emailConfirmationDetected) return null;
        failure('oauth_callback_invalid');
      }
      const auth = requireClient().auth;
      const { data, error } = callback.type === 'code'
        ? await auth.exchangeCodeForSession(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined)
        : await auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
      if (error) {
        // A confirmed email can return a code that this installation cannot exchange.
        const code = error.code;
        if (!info.recoveryDetected && (info.emailConfirmationDetected || info.emailChangeDetected) && callback.type === 'code' &&
          (error.name === 'AuthPKCECodeVerifierMissingError' || ['flow_state_not_found', 'flow_state_expired', 'bad_code_verifier'].includes(code ?? ''))) return await refreshEmailChangeSession();
        throw error;
      }
      if (!data.session) {
        if (info.recoveryDetected) failure('recovery_link_invalid');
        if (info.emailChangeDetected) return await refreshEmailChangeSession();
        if (info.emailConfirmationDetected) return null;
        failure('oauth_callback_error');
      }
      if (info.recoveryDetected || ('redirectType' in data && data.redirectType === 'recovery')) recoveryCallbacks.add(url);
      return data.session;
    })();
    if (callbacks.size >= 10) {
      const oldest = callbacks.keys().next().value!;
      callbacks.delete(oldest); recoveryCallbacks.delete(oldest);
    }
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
      const options = {
        emailRedirectTo: 'smartpantry://auth/callback',
        data: { full_name: name.trim() },
      };
      // Browser registration keeps its explicit browser callback, never the Site URL fallback.
      if (web) options.emailRedirectTo = redirectTo;
      const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password, options });
      if (error) throw error;
      return { session: data.session, confirmationRequired: !data.session };
    },
    completeCallback,
    isRecoveryCallback(url: string) {
      return recoveryCallbacks.has(url) || inspectAuthCallback(url, redirectTo).recoveryDetected;
    },
    async sendPasswordReset(email: string) {
      if (!isValidVerificationEmail(email)) failure('email_address_invalid');
      const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: web ? redirectTo : 'smartpantry://auth/callback',
      });
      if (error) { logPasswordError('send-reset-link', error); throw error; }
    },
    async updatePassword(password: string, confirmation: string, nonce?: string) {
      const validation = validateNewPassword(password, confirmation);
      if (validation) failure(validation);
      const auth = requireClient().auth;
      const { data: current, error: sessionError } = await auth.getSession();
      if (sessionError) throw sessionError;
      if (!current.session) failure('session_not_found');
      const { data, error } = await auth.updateUser({ password, ...(nonce ? { nonce: nonce.trim() } : {}) });
      if (error) { logPasswordError('update-password', error); throw error; }
      if (!data.user) failure('session_not_found');
      callbacks.clear(); recoveryCallbacks.clear();
      return data.user;
    },
    async reauthenticate() {
      const { error } = await requireClient().auth.reauthenticate();
      if (error) { logPasswordError('reauthenticate', error); throw error; }
    },
    async resendConfirmationEmail(email: string) {
      if (!isValidVerificationEmail(email)) failure('email_address_invalid');
      const options = { emailRedirectTo: 'smartpantry://auth/callback' };
      if (web) options.emailRedirectTo = redirectTo;
      const { error } = await requireClient().auth.resend({ type: 'signup', email: email.trim(), options });
      if (error) throw error;
    },
    async updateDisplayName(name: string) {
      const validation = validateDisplayName(name);
      if (validation) failure(validation);
      const { data, error } = await requireClient().auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      if (!data.user) failure('profile_update_failed');
      return data.user;
    },
    async updateEmail(email: string) {
      if (!isValidVerificationEmail(email)) failure('email_address_invalid');
      const auth = requireClient().auth;
      const { data: current, error: sessionError } = await auth.getSession();
      if (sessionError) throw sessionError;
      if (!current.session) failure('session_expired');
      if (!hasEmailIdentity(current.session.user)) failure('account.googleManaged');
      const { data, error } = await auth.updateUser({ email: email.trim() }, {
        emailRedirectTo: web ? redirectTo : emailConfirmationRedirectUri,
      });
      if (error) throw error;
      if (!data.user) failure('session_expired');
      return data.user;
    },
    async clearDeletedSession(userId: string) {
      const { data } = await requireClient().auth.getSession();
      if (data.session && data.session.user.id !== userId) return false;
      const { error } = await requireClient().auth.signOut({ scope: 'local' });
      const remaining = await requireClient().auth.getSession();
      if (remaining.error) throw remaining.error;
      if (remaining.data.session) throw error ?? Object.assign(new Error('Session cleanup incomplete'), { code: 'session_expired' });
      callbacks.clear(); recoveryCallbacks.clear();
      return true;
    },
    async signInWithGoogle() {
      googleRequests++;
      try {
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
        if (!session) failure('oauth_callback_error');
        return { status: 'success' as const, session };
      } finally { googleRequests--; }
    },
    async signOut() {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
      callbacks.clear();
      recoveryCallbacks.clear();
    },
  };
}

export const authService = createAuthService(supabase, authRedirectUri);
