import type { User } from '@supabase/supabase-js';

export function validateCredentials(email: string, password: string, signup?: { name: string; confirmPassword: string }): string | null {
  if (signup && !signup.name.trim()) return 'auth.nameRequired';
  if (!email.trim() || !password) return 'auth.required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'auth.invalidEmail';
  if (signup) return validateNewPassword(password, signup.confirmPassword);
  return null;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (!password || !confirmation) return 'auth.required';
  if (password.length < 8) return 'auth.passwordLength';
  return password !== confirmation ? 'auth.passwordMismatch' : null;
}

export function hasEmailIdentity(user: User | null): boolean {
  if (!user) return false;
  if (user.identities?.length) return user.identities.some((identity) => identity.provider === 'email');
  const providers: unknown = user.app_metadata?.providers;
  return Array.isArray(providers) ? providers.includes('email') : user.app_metadata?.provider === 'email';
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
    recovery_link_invalid: 'password.invalidLink', otp_expired: 'password.invalidLink',
    flow_state_expired: 'password.invalidLink', flow_state_not_found: 'password.invalidLink', bad_code_verifier: 'password.invalidLink',
    session_not_found: 'password.sessionExpired', session_expired: 'password.sessionExpired', refresh_token_not_found: 'password.sessionExpired',
    reauthentication_needed: 'password.reauthRequired', reauthentication_not_valid: 'password.reauthInvalid',
    reauth_nonce_missing: 'password.reauthRequired',
    same_password: 'password.samePassword', password_too_short: 'auth.passwordLength',
    'auth.required': 'auth.required', 'auth.passwordLength': 'auth.passwordLength', 'auth.passwordMismatch': 'auth.passwordMismatch',
  };
  if (value.code && keys[value.code]) return keys[value.code];
  if (value.name === 'AuthSessionMissingError') return 'password.sessionExpired';
  if (value.name === 'AuthPKCECodeVerifierMissingError') return 'password.invalidLink';
  if (value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' || value.name === 'AbortError' || value.status === 0) return 'auth.networkError';
  return 'auth.genericError';
}

export function getUserProfile(user: User) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const metadata = user.user_metadata ?? {};
  const email = user.email ?? '';
  const avatar = [text(metadata.avatar_url), text(metadata.picture)].find((value) => /^https:\/\//i.test(value)) ?? null;
  return {
    name: text(metadata.full_name) || text(metadata.name) || email.split('@')[0], email,
    avatarUrl: avatar,
    provider: user.app_metadata?.provider === 'google' ? 'google' : user.app_metadata?.provider === 'email' ? 'email' : 'other',
  };
}

export type AuthCallback = { type: 'code'; code: string; flowId?: string } | { type: 'tokens'; accessToken: string; refreshToken: string } | { type: 'error' } | { type: 'empty' };

export function getAvatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words[words.length - 1])[0] : '')).toLocaleUpperCase() : '';
}

export function validateDisplayName(name: string): string | null {
  if (!name.trim()) return 'auth.nameRequired';
  return Array.from(name.trim()).length > 80 ? 'profile.nameTooLong' : null;
}

export function formatAccountDate(value: string | undefined, language: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function parseAuthCallback(value: string, redirectTo: string): AuthCallback | null {
  const url = new URL(value);
  const expected = new URL(redirectTo);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname.replace(/\/$/, '') !== expected.pathname.replace(/\/$/, '')) return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const param = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  if (param('error') || param('error_code')) return { type: 'error' };
  const code = param('code');
  if (code) {
    const flowId = param('sb_flow_id');
    return { type: 'code', code, ...(flowId ? { flowId } : {}) };
  }
  const accessToken = param('access_token');
  const refreshToken = param('refresh_token');
  if (accessToken && refreshToken) return { type: 'tokens', accessToken, refreshToken };
  if (accessToken || refreshToken) return { type: 'error' };
  return { type: 'empty' };
}

export function inspectAuthCallback(value: string, redirectTo: string, pendingEmailConfirmation = false) {
  try {
    const callback = parseAuthCallback(value, redirectTo);
    const url = new URL(value);
    const hash = new URLSearchParams(url.hash.slice(1));
    const type = url.searchParams.get('type') ?? hash.get('type');
    const explicitEmail = type === 'signup' || type === 'email';
    return {
      callback,
      // Never log user-provided URL components: use only the configured route and redacted suffixes.
      safeUrl: callback ? `${redirectTo}${url.search ? '?[redacted]' : ''}${url.hash ? '#[redacted]' : ''}` : '[unrecognized callback]',
      emailConfirmationDetected: !!callback && type !== 'recovery' && (explicitEmail || pendingEmailConfirmation),
      recoveryDetected: !!callback && type === 'recovery',
      linkExpired: !!callback && (url.searchParams.get('error_code') ?? hash.get('error_code')) === 'otp_expired',
      detectionSource: explicitEmail ? 'callback-type' : pendingEmailConfirmation ? 'pending-registration' : 'unknown',
    };
  } catch {
    return { callback: null, safeUrl: '[invalid callback]', emailConfirmationDetected: false, recoveryDetected: false, linkExpired: false, detectionSource: 'unknown' };
  }
}
