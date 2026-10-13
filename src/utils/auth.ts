import type { User } from '@supabase/supabase-js';

export function validateCredentials(email: string, password: string, signup?: { name: string; confirmPassword: string }): string | null {
  if (signup && !signup.name.trim()) return 'auth.nameRequired';
  if (!email.trim() || !password) return 'auth.required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'auth.invalidEmail';
  if (signup && password.length < 8) return 'auth.passwordLength';
  if (signup && password !== signup.confirmPassword) return 'auth.passwordMismatch';
  return null;
}

export function authErrorKey(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { code?: string; name?: string; status?: number } : {};
  const keys: Record<string, string> = {
    invalid_credentials: 'auth.invalidCredentials', email_not_confirmed: 'auth.emailUnconfirmed',
    user_already_exists: 'auth.accountExists', email_exists: 'auth.accountExists',
    weak_password: 'auth.passwordLength', email_address_invalid: 'auth.invalidEmail',
    over_email_send_rate_limit: 'auth.rateLimited', over_request_rate_limit: 'auth.rateLimited',
    request_timeout: 'auth.networkError', configuration_missing: 'auth.unavailable',
    oauth_callback_invalid: 'auth.oauthError', oauth_callback_error: 'auth.oauthError',
  };
  if (value.code && keys[value.code]) return keys[value.code];
  if (value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' || value.name === 'AbortError' || value.status === 0) return 'auth.networkError';
  return 'auth.genericError';
}

export function getUserProfile(user: User) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const metadata = user.user_metadata ?? {};
  const email = user.email ?? '';
  const avatar = text(metadata.avatar_url) || text(metadata.picture);
  return {
    name: text(metadata.full_name) || text(metadata.name) || email.split('@')[0], email,
    avatarUrl: /^https:\/\//i.test(avatar) ? avatar : null,
    provider: user.app_metadata?.provider === 'google' ? 'google' : user.app_metadata?.provider === 'email' ? 'email' : 'other',
  };
}

export type AuthCallback = { type: 'code'; code: string } | { type: 'tokens'; accessToken: string; refreshToken: string } | { type: 'error' };

export function parseAuthCallback(value: string, redirectTo: string): AuthCallback | null {
  const url = new URL(value);
  const expected = new URL(redirectTo);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname.replace(/\/$/, '') !== expected.pathname.replace(/\/$/, '')) return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const param = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  if (param('error') || param('error_code')) return { type: 'error' };
  const code = param('code');
  if (code) return { type: 'code', code };
  const accessToken = param('access_token');
  const refreshToken = param('refresh_token');
  if (accessToken && refreshToken) return { type: 'tokens', accessToken, refreshToken };
  return null;
}
