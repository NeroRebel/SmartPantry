const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');

function modules(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const requireLocal = (name) => {
      if (name in overrides) return overrides[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) throw new Error(`Unexpected dependency: ${name}`);
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireLocal, module, module.exports);
    return module.exports;
  }
  return (file) => load(path.join(root, file));
}

const helpers = modules()('utils/auth.ts');
const redirect = 'smartpantry://auth/callback';
const serviceFactory = modules({
  'expo-auth-session': { makeRedirectUri: () => redirect },
  'expo-web-browser': { maybeCompleteAuthSession: () => {}, openAuthSessionAsync: async () => ({ type: 'cancel' }) },
  'react-native': { Platform: { OS: 'ios' } }, '@/lib/supabase': { supabase: null },
})('services/auth.ts').createAuthService;
const session = { user: { id: 'user-id' } };

test('change email uses supported updateUser redirect and real SDK user, never changes Google-only accounts', async () => {
  const user = { id: 'user-id', email: 'old@example.com', identities: [{ provider: 'email' }] };
  const calls = [];
  const service = serviceFactory({ auth: {
    getSession: async () => ({ data: { session: { user } }, error: null }),
    updateUser: async (input, options) => { calls.push([input, options]); return { data: { user: { ...user, new_email: input.email } }, error: null }; },
  } }, redirect);
  assert.equal((await service.updateEmail(' new@example.com ')).email, 'old@example.com');
  assert.deepEqual(calls, [[{ email: 'new@example.com' }, { emailRedirectTo: redirect }]]);
  await assert.rejects(service.updateEmail('bad'), { code: 'email_address_invalid' });
  user.identities = [{ provider: 'google' }];
  await assert.rejects(service.updateEmail('new@example.com'), { code: 'account.googleManaged' });
  assert.equal(calls.length, 1);
});

test('email change callback shares the existing callback without treating partial confirmation as completed signup', async () => {
  const service = serviceFactory({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }, redirect);
  const info = helpers.inspectAuthCallback(`${redirect}?type=email_change`, redirect);
  assert.equal(info.emailChangeDetected, true); assert.equal(info.emailConfirmationDetected, false);
  assert.equal(await service.completeCallback(`${redirect}?type=email_change`), null);
});

test('sessionless email-change confirmation refreshes the existing real session, not a fabricated email', async () => {
  let refreshed = 0;
  const updated = { user: { id: 'user-id', email: 'new@example.com' } };
  const service = serviceFactory({ auth: {
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => { refreshed++; return { data: { session: updated }, error: null }; },
  } }, redirect);
  assert.equal(await service.completeCallback(`${redirect}?type=email_change`), updated);
  assert.equal(refreshed, 1);
});

test('credential validation handles missing fields, email, length and confirmation without trimming passwords', () => {
  assert.equal(helpers.validateCredentials('', ''), 'auth.required');
  assert.equal(helpers.validateCredentials('bad', 'password'), 'auth.invalidEmail');
  assert.equal(helpers.validateCredentials('a@example.com', 'password', { name: '', confirmPassword: 'password' }), 'auth.nameRequired');
  assert.equal(helpers.validateCredentials('a@example.com', 'short', { name: 'Name', confirmPassword: 'short' }), 'auth.passwordLength');
  assert.equal(helpers.validateCredentials('a@example.com', 'password', { name: 'Name', confirmPassword: 'different' }), 'auth.passwordMismatch');
  assert.equal(helpers.validateCredentials(' a@example.com ', ' password ', { name: 'Name', confirmPassword: ' password ' }), null);
});

test('errors map to friendly translation keys without exposing raw messages', () => {
  for (const [error, key] of [
    [{ code: 'invalid_credentials' }, 'auth.invalidCredentials'], [{ code: 'email_not_confirmed' }, 'auth.emailUnconfirmed'],
    [{ code: 'user_already_exists' }, 'auth.accountExists'], [{ name: 'AuthRetryableFetchError' }, 'auth.networkError'],
    [{ name: 'TypeError' }, 'auth.networkError'], [{ message: 'secret server text' }, 'auth.genericError'],
  ]) assert.equal(helpers.authErrorKey(error), key);
});

test('callback accepts only the configured route and reads PKCE or email-confirmation tokens', () => {
  assert.deepEqual(helpers.parseAuthCallback(`${redirect}?code=code-value`, redirect), { type: 'code', code: 'code-value' });
  assert.deepEqual(helpers.parseAuthCallback(`${redirect}#access_token=access&refresh_token=refresh`, redirect), { type: 'tokens', accessToken: 'access', refreshToken: 'refresh' });
  assert.equal(helpers.parseAuthCallback('https://other.example/auth/callback?code=x', redirect), null);
  assert.equal(helpers.parseAuthCallback('smartpantry://product/add?code=x', redirect), null);
  assert.deepEqual(helpers.parseAuthCallback(`${redirect}?error=access_denied`, redirect), { type: 'error' });
});

test('email auth forwards credentials and metadata and reports confirmation honestly', async () => {
  const client = { auth: {
    signInWithPassword: async (input) => { assert.deepEqual(input, { email: 'a@example.com', password: ' password ' }); return { data: { session }, error: null }; },
    signUp: async (input) => {
      assert.deepEqual(input, { email: 'a@example.com', password: 'password', options: { data: { full_name: 'Name' }, emailRedirectTo: redirect } });
      return { data: { session: null }, error: null };
    },
    getSession: async () => ({ data: { session }, error: null }),
  } };
  const auth = serviceFactory(client, redirect);
  assert.equal(await auth.signIn(' a@example.com ', ' password '), session);
  assert.deepEqual(await auth.signUp(' Name ', ' a@example.com ', 'password'), { session: null, confirmationRequired: true });
  assert.equal(await auth.restoreSession(), session);
  client.auth.signUp = async () => ({ data: { session }, error: null });
  assert.deepEqual(await auth.signUp('Name', 'a@example.com', 'password'), { session, confirmationRequired: false });
});

test('password reset explicitly uses native redirect, preserves web callback and validates email', async () => {
  const calls = [];
  const client = { auth: { resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; } } };
  await serviceFactory(client, redirect).sendPasswordReset(' a@example.com ');
  assert.deepEqual(calls[0], ['a@example.com', { redirectTo: 'smartpantry://auth/callback' }]);
  const webRedirect = 'https://app.example/auth/callback';
  await serviceFactory(client, webRedirect, true).sendPasswordReset('a@example.com');
  assert.deepEqual(calls[1], ['a@example.com', { redirectTo: webRedirect }]);
  await assert.rejects(serviceFactory(client, redirect).sendPasswordReset('invalid'), { code: 'email_address_invalid' });
  assert.equal(calls.length, 2);
  client.auth.resetPasswordForEmail = async () => ({ error: { code: 'over_email_send_rate_limit' } });
  await assert.rejects(serviceFactory(client, redirect).sendPasswordReset('a@example.com'), { code: 'over_email_send_rate_limit' });
});

test('recovery callbacks share PKCE exchange, distinguish signup, and never accept no-session recovery', async () => {
  let exchanges = 0;
  const auth = serviceFactory({ auth: { exchangeCodeForSession: async () => {
    exchanges++; return { data: { session, redirectType: 'recovery' }, error: null };
  } } }, redirect);
  const url = `${redirect}?code=private&sb_flow_id=flow`;
  const result = await Promise.all([auth.completeCallback(url), auth.completeCallback(url)]);
  assert.equal(result[0], session); assert.equal(result[1], session); assert.equal(exchanges, 1);
  assert.equal(auth.isRecoveryCallback(url), true);
  assert.equal(auth.isRecoveryCallback(`${redirect}?type=signup`), false);
  const invalid = serviceFactory({ auth: {} }, redirect);
  await assert.rejects(invalid.completeCallback(`${redirect}?type=recovery`, true), { code: 'recovery_link_invalid' });
  await assert.rejects(invalid.completeCallback(`${redirect}?type=recovery&error=access_denied`, true), { code: 'recovery_link_invalid' });
  await assert.rejects(invalid.completeCallback(`${redirect}#error=access_denied&error_code=otp_expired`), { code: 'otp_expired' });
  const noSession = serviceFactory({ auth: { exchangeCodeForSession: async () => ({ data: { session: null }, error: null }) } }, redirect);
  await assert.rejects(noSession.completeCallback(`${redirect}?type=recovery&code=private`, true), { code: 'recovery_link_invalid' });
  const missingVerifier = serviceFactory({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: { name: 'AuthPKCECodeVerifierMissingError' } }) } }, redirect);
  await assert.rejects(missingVerifier.completeCallback(`${redirect}?type=recovery&code=private`, true), { name: 'AuthPKCECodeVerifierMissingError' });
});

test('legacy recovery tokens establish a real session through the existing SDK handler', async () => {
  const auth = serviceFactory({ auth: { setSession: async (input) => {
    assert.deepEqual(input, { access_token: 'private-access', refresh_token: 'private-refresh' });
    return { data: { session }, error: null };
  } } }, redirect);
  const url = `${redirect}#type=recovery&access_token=private-access&refresh_token=private-refresh`;
  assert.equal(await auth.completeCallback(url, true), session);
  assert.equal(auth.isRecoveryCallback(url), true);
  const info = helpers.inspectAuthCallback(url, redirect, true);
  assert.equal(info.emailConfirmationDetected, false);
  assert.equal(info.recoveryDetected, true);
  assert.equal(info.safeUrl.includes('private'), false);
});

test('password updates enforce signup rules, require a session and use supported reauthentication', async () => {
  const calls = []; let activeSession = session;
  const client = { auth: {
    getSession: async () => ({ data: { session: activeSession }, error: null }),
    updateUser: async (input) => { calls.push(input); return { data: { user: session.user }, error: null }; },
    reauthenticate: async () => { calls.push('reauthenticate'); return { error: null }; },
  } };
  const auth = serviceFactory(client, redirect);
  assert.equal(helpers.validateNewPassword('12345678', '12345678'), null);
  await assert.rejects(auth.updatePassword('short', 'short'), { code: 'auth.passwordLength' });
  await assert.rejects(auth.updatePassword('12345678', 'different'), { code: 'auth.passwordMismatch' });
  await assert.rejects(auth.updatePassword('', ''), { code: 'auth.required' });
  assert.equal(calls.length, 0);
  await auth.updatePassword(' password ', ' password ');
  await auth.reauthenticate();
  await auth.updatePassword(' password ', ' password ', ' 123456 ');
  assert.deepEqual(calls, [{ password: ' password ' }, 'reauthenticate', { password: ' password ', nonce: '123456' }]);
  activeSession = null;
  await assert.rejects(auth.updatePassword('12345678', '12345678'), { code: 'session_not_found' });
  client.auth.reauthenticate = async () => ({ error: { code: 'request_timeout' } });
  await assert.rejects(auth.reauthenticate(), { code: 'request_timeout' });
});

test('password errors map safely and email identity detection handles linked accounts', () => {
  for (const [error, key] of [
    [{ code: 'reauthentication_needed' }, 'password.reauthRequired'],
    [{ code: 'reauth_nonce_missing' }, 'password.reauthRequired'],
    [{ code: 'reauthentication_not_valid' }, 'password.reauthInvalid'],
    [{ code: 'same_password' }, 'password.samePassword'],
    [{ code: 'weak_password' }, 'auth.passwordLength'],
    [{ code: 'session_expired' }, 'password.sessionExpired'],
    [{ code: 'otp_expired' }, 'password.invalidLink'],
    [{ name: 'AuthPKCECodeVerifierMissingError' }, 'password.invalidLink'],
    [{ name: 'AuthSessionMissingError' }, 'password.sessionExpired'],
  ]) assert.equal(helpers.authErrorKey(error), key);
  assert.equal(helpers.hasEmailIdentity(null), false);
  assert.equal(helpers.hasEmailIdentity({ identities: [{ provider: 'google' }], app_metadata: { providers: ['google'] } }), false);
  assert.equal(helpers.hasEmailIdentity({ identities: [{ provider: 'google' }, { provider: 'email' }] }), true);
  assert.equal(helpers.hasEmailIdentity({ app_metadata: { provider: 'email' } }), true);
  assert.equal(helpers.hasEmailIdentity({ app_metadata: { providers: ['google', 'email'] } }), true);
  assert.equal(helpers.hasEmailIdentity({ email: 'a@example.com', app_metadata: { provider: 'google' } }), false);
});

test('recovery persistence stores only an account routing marker and can be cleared', async () => {
  const stored = new Map();
  const recovery = modules({ '@react-native-async-storage/async-storage': {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => stored.set(key, value), removeItem: async (key) => stored.delete(key),
  } })('services/password-recovery.ts');
  assert.equal(await recovery.readRecoveryUser(), null);
  await recovery.saveRecoveryUser('user-id');
  assert.equal(await recovery.readRecoveryUser(), 'user-id');
  assert.deepEqual([...stored.values()], ['user-id']);
  await recovery.saveRecoveryUser(null);
  assert.equal(await recovery.readRecoveryUser(), null);
});

test('password strings are available in all five languages', () => {
  const translations = modules()('i18n/password.ts').passwordTranslations;
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), Object.keys(translations.en).sort());
});

test('password diagnostics whitelist SDK classifications, never request or error-message secrets', async () => {
  const previousDev = global.__DEV__; const previousWarn = console.warn;
  const logs = []; global.__DEV__ = true; console.warn = (...args) => logs.push(args);
  try {
    const auth = serviceFactory({ auth: { resetPasswordForEmail: async () => ({ error: {
      code: 'over_email_send_rate_limit', name: 'AuthApiError', status: 429, message: 'SECRET', access_token: 'SECRET',
    } }) } }, redirect);
    await assert.rejects(auth.sendPasswordReset('private@example.com'));
    assert.deepEqual(logs, [['[SmartPantry] Password request failed', { operation: 'send-reset-link', code: 'over_email_send_rate_limit', name: 'AuthApiError', status: 429 }]]);
    assert.equal(JSON.stringify(logs).includes('SECRET'), false);
    assert.equal(JSON.stringify(logs).includes('private@example.com'), false);
    logs.length = 0; global.__DEV__ = false;
    await assert.rejects(auth.sendPasswordReset('private@example.com'));
    assert.equal(logs.length, 0);
  } finally { console.warn = previousWarn; if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev; }
});

function authStateHarness(storedSession = null, storedRecovery = null) {
  const slots = []; let index = 0; let dirty = true; let listener; let value; let effects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((item, i) => item !== b[i]);
  const writes = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => value,
    useState: (initial) => { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; dirty = true; }]; },
    useEffect: (effect, deps) => { const slot = index++; if (changed(slots[slot], deps)) { slots[slot] = deps; effects.push(effect); } },
    useMemo: (compute, deps) => { const slot = index++; if (!slots[slot] || changed(slots[slot].deps, deps)) slots[slot] = { deps, value: compute() }; return slots[slot].value; },
    useCallback: (callback, deps) => react.useMemo(() => callback, deps),
  };
  const service = {
    restoreSession: async () => storedSession,
    completeCallback: async () => { listener('SIGNED_IN', session); return session; },
    isRecoveryCallback: () => true,
    updatePassword: async () => session.user,
    signOut: async () => listener('SIGNED_OUT', null),
    clearDeletedSession: async () => { listener('SIGNED_OUT', null); return true; },
  };
  const { AuthProvider } = modules({
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/lib/supabase': { supabase: { auth: { onAuthStateChange: (callback) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; } } } },
    '@/services/auth': { authService: service }, '@/services/avatars': { avatarService: {} },
    '@/hooks/use-user-avatar': { useUserAvatar: () => null },
    '@/services/pending-verification': { readPendingVerification: async () => null, savePendingVerification: async () => {} },
    '@/services/password-recovery': { readRecoveryUser: async () => storedRecovery, saveRecoveryUser: async (id) => writes.push(id) },
  })('auth/auth-context.tsx');
  return {
    get value() { return value; }, writes,
    event: (event, next) => listener(event, next),
    async flush() {
      for (let i = 0; i < 12; i++) {
        if (dirty) {
          dirty = false; index = 0; value = AuthProvider({ children: null }).props.value;
          const pending = effects; effects = []; for (const effect of pending) effect();
        }
        await Promise.resolve();
      }
    },
  };
}

test('AuthProvider routes legacy recovery without PASSWORD_RECOVERY event and clears it after update', async () => {
  const harness = authStateHarness(); await harness.flush();
  assert.equal(harness.value.session, null);
  const result = await harness.value.completeCallback(`${redirect}#type=recovery`); await harness.flush();
  assert.equal(result, 'recovery'); assert.equal(harness.value.recovering, true); assert.equal(harness.value.processingCallback, false);
  assert.equal(harness.value.session, session);
  await harness.value.updatePassword('12345678', '12345678'); await harness.flush();
  assert.equal(harness.value.recovering, false); assert.equal(harness.value.passwordRecoveryComplete, true);
  assert.equal(harness.writes.at(-1), null);
  harness.value.finishPasswordRecovery(); await harness.flush();
  assert.equal(harness.value.passwordRecoveryComplete, false); assert.deepEqual(harness.value.session, session);
});

test('successful account deletion clears AuthProvider session and recovery state', async () => {
  const app = authStateHarness(session, session.user.id); await app.flush();
  assert.equal(app.value.recovering, true);
  await app.value.clearDeletedSession(session.user.id); await app.flush();
  assert.equal(app.value.session, null); assert.equal(app.value.user, null);
  assert.equal(app.value.recovering, false); assert.equal(app.value.pendingVerification, null);
  assert.equal(app.writes.at(-1), null);
});

test('deleted-session cleanup never signs out a different current user and tolerates already-cleared sessions', async () => {
  let current = session; const calls = [];
  const service = serviceFactory({ auth: {
    getSession: async () => ({ data: { session: current }, error: null }),
    signOut: async (options) => { calls.push(options); current = null; return { error: new TypeError('Network failed after local SDK cleanup') }; },
  } }, redirect);
  assert.equal(await service.clearDeletedSession('another-user'), false); assert.equal(calls.length, 0);
  assert.equal(await service.clearDeletedSession(session.user.id), true);
  assert.deepEqual(calls, [{ scope: 'local' }]);
});

test('AuthProvider handles PASSWORD_RECOVERY and restores only a marker belonging to the real session', async () => {
  const restored = authStateHarness(session, session.user.id); await restored.flush();
  assert.equal(restored.value.recovering, true);
  const another = authStateHarness(session, 'another-user'); await another.flush();
  assert.equal(another.value.recovering, false);
  another.event('PASSWORD_RECOVERY', session); await another.flush();
  assert.equal(another.value.recovering, true);
  assert.equal(another.writes.at(-1), session.user.id);
  await another.value.signOut(); await another.flush();
  assert.equal(another.value.session, null); assert.equal(another.value.recovering, false);
  assert.equal(another.writes.at(-1), null);
});

test('OAuth browser and callback delivery exchange a code once; cancellation creates no session', async () => {
  let exchanges = 0;
  const client = { auth: {
    signInWithOAuth: async (input) => { assert.equal(input.provider, 'google'); assert.equal(input.options.redirectTo, redirect); assert.equal(input.options.skipBrowserRedirect, true); return { data: { url: 'https://example.supabase.co/authorize' }, error: null }; },
    exchangeCodeForSession: async (code) => { exchanges++; assert.equal(code, 'abc'); return { data: { session }, error: null }; },
  } };
  const cancelled = serviceFactory(client, redirect, false, async () => ({ type: 'cancel' }));
  assert.equal((await cancelled.signInWithGoogle()).status, 'cancelled');
  assert.equal(exchanges, 0);
  const auth = serviceFactory(client, redirect, false, async () => ({ type: 'success', url: `${redirect}?code=abc` }));
  const [result, callback] = await Promise.all([auth.signInWithGoogle(), auth.completeCallback(`${redirect}?code=abc`)]);
  assert.equal(result.session, session); assert.equal(callback, session); assert.equal(exchanges, 1);
});

test('web OAuth redirects without opening the native browser and bad callbacks fail safely', async () => {
  const client = { auth: { signInWithOAuth: async (input) => { assert.equal(input.options.skipBrowserRedirect, false); return { data: { url: 'https://example.supabase.co/authorize' }, error: null }; } } };
  const auth = serviceFactory(client, 'https://app.example/auth/callback', true, () => { throw new Error('Unexpected native browser'); });
  assert.equal((await auth.signInWithGoogle()).status, 'redirected');
  await assert.rejects(auth.completeCallback('https://untrusted.example/auth/callback?code=abc'));
  await assert.rejects(serviceFactory(null, redirect).signIn('a@example.com', 'password'));
});

test('signout invokes Supabase only and restore/API failures are surfaced', async () => {
  let signouts = 0;
  const auth = serviceFactory({ auth: { signOut: async () => { signouts++; return { error: null }; }, getSession: async () => ({ data: {}, error: { code: 'request_timeout' } }) } }, redirect);
  await auth.signOut(); assert.equal(signouts, 1);
  await assert.rejects(auth.restoreSession());
});

test('profile uses Google metadata with safe missing-avatar defaults', () => {
  const google = helpers.getUserProfile({ email: 'a@example.com', user_metadata: { full_name: 'User', avatar_url: 'https://example.com/avatar' }, app_metadata: { provider: 'google' } });
  assert.deepEqual(google, { name: 'User', email: 'a@example.com', avatarUrl: 'https://example.com/avatar', provider: 'google' });
  const email = helpers.getUserProfile({ email: 'a@example.com', user_metadata: { avatar_url: 'javascript:invalid' }, app_metadata: { provider: 'email' } });
  assert.equal(email.name, 'a'); assert.equal(email.avatarUrl, null); assert.equal(email.provider, 'email');
});

test('all auth strings are translated into all five languages', () => {
  const translations = modules()('i18n/auth.ts').authTranslations;
  const keys = Object.keys(translations.en).sort();
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), keys);
});

test('confirmation validates email and handles the resend cooldown safely', () => {
  const confirmation = modules()('utils/email-verification.ts');
  assert.equal(confirmation.isValidVerificationEmail(' a@example.com '), true);
  for (const email of ['', 'invalid', 'a@', 'a @example.com']) assert.equal(confirmation.isValidVerificationEmail(email), false);
  assert.equal(confirmation.resendSecondsRemaining(60000, 0), 60);
  assert.equal(confirmation.resendSecondsRemaining(60000, 59500), 1);
  assert.equal(confirmation.resendSecondsRemaining(60000, 65000), 0);
});

test('confirmation resend uses signup resend and the existing redirect, never another signup', async () => {
  let resends = 0;
  const auth = serviceFactory({ auth: {
    resend: async (input) => { resends++; assert.deepEqual(input, { email: 'a@example.com', type: 'signup', options: { emailRedirectTo: redirect } }); return { error: null }; },
  } }, redirect);
  await auth.resendConfirmationEmail(' a@example.com ');
  await assert.rejects(auth.resendConfirmationEmail('bad'), { code: 'email_address_invalid' });
  assert.equal(resends, 1);
  await assert.rejects(serviceFactory({ auth: { resend: async () => ({ error: { code: 'over_email_send_rate_limit' } }) } }, redirect).resendConfirmationEmail('a@example.com'), { code: 'over_email_send_rate_limit' });
  const webRedirect = 'https://app.example/auth/callback';
  await serviceFactory({ auth: { resend: async (input) => { assert.equal(input.options.emailRedirectTo, webRedirect); return { error: null }; } } }, webRedirect, true).resendConfirmationEmail('a@example.com');
});

test('confirmation callback accepts returned sessions and rejects missing sessions without fabricating auth', async () => {
  const auth = serviceFactory({ auth: { setSession: async (input) => {
    assert.deepEqual(input, { access_token: 'access', refresh_token: 'refresh' });
    return { data: { session }, error: null };
  } } }, redirect);
  assert.equal(await auth.completeCallback(`${redirect}#access_token=access&refresh_token=refresh`), session);
  await assert.rejects(serviceFactory({ auth: { exchangeCodeForSession: async () => ({ data: { session: null }, error: null }) } }, redirect).completeCallback(`${redirect}?code=confirmed`), { code: 'oauth_callback_error' });
  await assert.rejects(serviceFactory(null, redirect).completeCallback(redirect), { code: 'oauth_callback_invalid' });
});

test('native signup and resend pin the mobile email redirect independently of Google redirect', async () => {
  let signupRedirect; let resendRedirect; let googleRedirect;
  const googleUrl = 'https://different.example/auth/callback';
  const auth = serviceFactory({ auth: {
    signUp: async (input) => { signupRedirect = input.options.emailRedirectTo; return { data: { session: null }, error: null }; },
    resend: async (input) => { resendRedirect = input.options.emailRedirectTo; return { error: null }; },
    signInWithOAuth: async (input) => { googleRedirect = input.options.redirectTo; return { data: { url: 'https://example.com/oauth' }, error: null }; },
  } }, googleUrl, false, async () => ({ type: 'cancel' }));
  await auth.signUp('Name', 'a@example.com', 'password');
  await auth.resendConfirmationEmail('a@example.com');
  await auth.signInWithGoogle();
  assert.equal(signupRedirect, redirect); assert.equal(resendRedirect, redirect); assert.equal(googleRedirect, googleUrl);
});

test('email confirmation without a mobile session returns a sign-in outcome, not fabricated auth', async () => {
  const auth = serviceFactory({ auth: { exchangeCodeForSession: async () => ({ data: { session: null }, error: null }) } }, redirect);
  assert.equal(await auth.completeCallback(`${redirect}?type=signup`), null);
  assert.equal(await auth.completeCallback(`${redirect}?code=confirmed`, true), null);
  await assert.rejects(auth.completeCallback(`${redirect}?error=access_denied&type=signup`), { code: 'oauth_callback_invalid' });
  const missingVerifier = serviceFactory({ auth: { exchangeCodeForSession: async () => ({ data: {}, error: { name: 'AuthPKCECodeVerifierMissingError' } }) } }, redirect);
  assert.equal(await missingVerifier.completeCallback(`${redirect}?code=confirmed`, true), null);
  const offline = serviceFactory({ auth: { exchangeCodeForSession: async () => { throw Object.assign(new Error('Offline'), { name: 'TypeError' }); } } }, redirect);
  await assert.rejects(offline.completeCallback(`${redirect}?code=confirmed`, true));
  assert.equal(helpers.inspectAuthCallback(`${redirect}#type=signup`, redirect).emailConfirmationDetected, true);
  assert.equal(helpers.inspectAuthCallback(`${redirect}?code=x`, redirect, true).detectionSource, 'pending-registration');
  assert.equal(helpers.inspectAuthCallback('https://untrusted.example?type=signup', redirect, true).emailConfirmationDetected, false);
});

test('completed and failed callbacks emit no temporary diagnostics, sessions or errors', async (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  const logs = [];
  context.mock.method(console, 'info', (...args) => logs.push(args));
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  try {
    const auth = serviceFactory({ auth: { setSession: async () => ({ data: { session }, error: null }) } }, redirect);
    await auth.completeCallback(`${redirect}?email=PRIVATE_EMAIL#type=signup&access_token=SECRET_ACCESS&refresh_token=SECRET_REFRESH`);
    assert.deepEqual(logs, []);
    const failed = serviceFactory({ auth: { exchangeCodeForSession: async () => { throw new Error('SECRET_ERROR'); } } }, redirect);
    await assert.rejects(failed.completeCallback(`${redirect}?code=SECRET_CODE`));
    assert.deepEqual(logs, []);
    for (const secret of ['SECRET_ACCESS', 'SECRET_REFRESH', 'SECRET_CODE', 'SECRET_ERROR', 'PRIVATE_EMAIL', 'user-id']) assert.equal(JSON.stringify(logs).includes(secret), false);
    assert.equal(helpers.inspectAuthCallback('invalid SECRET_TOKEN', redirect).safeUrl, '[invalid callback]');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, '__DEV__', descriptor); else delete globalThis.__DEV__;
  }
});

test('SDK PKCE flow ids are forwarded when present and never printed in callback diagnostics', async (context) => {
  const flowId = '123e4567-e89b-42d3-a456-426614174000';
  assert.deepEqual(helpers.parseAuthCallback(`${redirect}?code=code&sb_flow_id=${flowId}`, redirect), { type: 'code', code: 'code', flowId });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  const logs = [];
  context.mock.method(console, 'info', (...args) => logs.push(args));
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  try {
    const auth = serviceFactory({ auth: { exchangeCodeForSession: async (code, options) => {
      assert.equal(code, 'secret-code'); assert.deepEqual(options, { flowId });
      return { data: { session }, error: null };
    } } }, redirect);
    assert.equal(await auth.completeCallback(`${redirect}?code=secret-code&sb_flow_id=${flowId}`, true), session);
    assert.equal(JSON.stringify(logs).includes(flowId), false);
    assert.equal(JSON.stringify(logs).includes('secret-code'), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, '__DEV__', descriptor); else delete globalThis.__DEV__;
  }
});

test('pending registration cannot convert an active Google OAuth failure into email confirmation success', async () => {
  let auth;
  const error = { name: 'AuthPKCECodeVerifierMissingError' };
  auth = serviceFactory({ auth: {
    signInWithOAuth: async () => ({ data: { url: 'https://example.com/google' }, error: null }),
    exchangeCodeForSession: async () => ({ data: {}, error }),
  } }, redirect, false, async () => {
    await assert.rejects(auth.completeCallback(`${redirect}?code=google-code`, true), (cause) => cause === error);
    return { type: 'cancel' };
  });
  assert.equal((await auth.signInWithGoogle()).status, 'cancelled');
});

test('signup and resend no longer emit temporary redirect diagnostics', async (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  const logs = [];
  context.mock.method(console, 'info', (...args) => logs.push(args));
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  try {
    const auth = serviceFactory({ auth: {
      signUp: async () => ({ data: { session: null }, error: null }), resend: async () => ({ error: null }),
    } }, redirect);
    await auth.signUp('Private Name', 'private@example.com', 'PRIVATE_PASSWORD');
    await auth.resendConfirmationEmail('private@example.com');
    assert.deepEqual(logs, []);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, '__DEV__', descriptor); else delete globalThis.__DEV__;
  }
});

test('pending verification persists only email and cooldown; malformed storage and storage failures are safe', async () => {
  let stored = null;
  const storage = { getItem: async () => stored, setItem: async (_key, value) => { stored = value; }, removeItem: async () => { stored = null; } };
  const pending = modules({ '@react-native-async-storage/async-storage': { __esModule: true, default: storage } })('services/pending-verification.ts');
  assert.equal(await pending.readPendingVerification(), null);
  const deadline = Date.now() + 30000;
  await pending.savePendingVerification({ email: 'a@example.com', resendAvailableAt: deadline, password: 'not-persisted', token: 'not-persisted' });
  assert.deepEqual(JSON.parse(stored), { email: 'a@example.com', resendAvailableAt: deadline });
  assert.deepEqual(await pending.readPendingVerification(), { email: 'a@example.com', resendAvailableAt: deadline });
  stored = 'broken'; assert.equal(await pending.readPendingVerification(), null);
  stored = JSON.stringify({ email: 'invalid' }); assert.equal(await pending.readPendingVerification(), null);
  stored = JSON.stringify({ email: 'a@example.com' }); assert.equal((await pending.readPendingVerification()).resendAvailableAt, 0);
  await pending.savePendingVerification(null); assert.equal(stored, null);
  storage.getItem = async () => { throw new Error('Unavailable'); };
  storage.setItem = storage.getItem;
  assert.equal(await pending.readPendingVerification(), null);
  await pending.savePendingVerification({ email: 'a@example.com', resendAvailableAt: deadline });
});

test('confirmation-link strings exist in all five languages', () => {
  const translations = modules()('i18n/email-confirmation.ts').confirmationTranslations;
  const keys = Object.keys(translations.en).sort();
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), keys);
});

test('profile supports metadata fallbacks, initials and localized valid creation dates', () => {
  const profile = helpers.getUserProfile({ user_metadata: { full_name: ' ', name: 'Марія Коваль', picture: 'https://example.com/picture' }, app_metadata: { provider: 'google' } });
  assert.equal(profile.name, 'Марія Коваль');
  assert.equal(profile.avatarUrl, 'https://example.com/picture');
  assert.equal(helpers.getAvatarInitials(profile.name), 'МК');
  assert.equal(helpers.getAvatarInitials('  Jane Middle Doe '), 'JD');
  assert.equal(helpers.getAvatarInitials('Ágnes'), 'Á');
  assert.equal(helpers.getAvatarInitials(''), '');
  assert.equal(helpers.getUserProfile({ user_metadata: {}, app_metadata: {} }).name, '');
  assert.equal(helpers.formatAccountDate(undefined, 'en'), null);
  assert.equal(helpers.formatAccountDate('invalid', 'en'), null);
  assert.match(helpers.formatAccountDate('2026-10-14T12:00:00Z', 'en'), /2026/);
});

test('display-name update validates input and updates only full_name, preserving avatar metadata', async () => {
  const user = { id: 'user-id', user_metadata: { full_name: 'Old', avatar_url: 'https://example.com/avatar', name: 'Google Name' } };
  let calls = 0;
  const auth = serviceFactory({ auth: { updateUser: async (input) => {
    calls++;
    assert.deepEqual(input, { data: { full_name: 'New Name' } });
    return { data: { user: { ...user, user_metadata: { ...user.user_metadata, ...input.data } } }, error: null };
  } } }, redirect);
  await assert.rejects(auth.updateDisplayName(' '), { code: 'auth.nameRequired' });
  await assert.rejects(auth.updateDisplayName('x'.repeat(81)), { code: 'profile.nameTooLong' });
  assert.equal(calls, 0);
  const updated = await auth.updateDisplayName(' New Name ');
  assert.equal(helpers.getUserProfile(updated).name, 'New Name');
  assert.equal(updated.user_metadata.avatar_url, user.user_metadata.avatar_url);
  assert.equal(updated.user_metadata.name, 'Google Name');
  assert.equal(calls, 1);
});

test('profile updates surface API errors and missing-user responses without false success', async () => {
  const error = { code: 'request_timeout' };
  await assert.rejects(serviceFactory({ auth: { updateUser: async () => ({ data: {}, error }) } }, redirect).updateDisplayName('Name'), (cause) => cause === error);
  await assert.rejects(serviceFactory({ auth: { updateUser: async () => ({ data: { user: null }, error: null }) } }, redirect).updateDisplayName('Name'), { code: 'profile_update_failed' });
});

test('new profile strings are translated in all supported languages', () => {
  const translations = modules()('i18n/profile.ts').profileTranslations;
  const keys = Object.keys(translations.en).sort();
  for (const language of ['sk', 'ru', 'uk', 'hu']) {
    assert.deepEqual(Object.keys(translations[language]).sort(), keys);
    for (const value of Object.values(translations[language])) assert.ok(value.trim());
  }
});

test('client persists native sessions with refresh/PKCE and rejects privileged keys', () => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let configuration;
  const storage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
  const overrides = {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '@supabase/supabase-js': { createClient: (_url, _key, options) => { configuration = options; return { auth: {} }; }, processLock: () => {} },
    'react-native': { Platform: { OS: 'ios' } },
  };
  try {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    assert.ok(modules(overrides)('lib/supabase.ts').supabase);
    assert.equal(configuration.auth.storage, storage);
    assert.equal(configuration.auth.persistSession, true);
    assert.equal(configuration.auth.autoRefreshToken, true);
    assert.equal(configuration.auth.detectSessionInUrl, false);
    assert.equal(configuration.auth.flowType, 'pkce');
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_not_allowed';
    assert.equal(modules(overrides)('lib/supabase.ts').supabase, null);
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
    assert.equal(modules(overrides)('lib/supabase.ts').supabase, null);
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    configuration = null;
    modules({ ...overrides, 'react-native': { Platform: { OS: 'web' } } })('lib/supabase.ts');
    assert.equal(configuration.auth.storage, undefined);
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test('native PKCE bridge uses Expo random values and SHA-256 without insecure fallbacks', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const nodeCrypto = require('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    modules({ 'expo-crypto': {
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      getRandomValues: (array) => { array.fill(7); return array; },
      digest: async (algorithm, data) => {
        assert.equal(algorithm, 'SHA-256');
        const bytes = nodeCrypto.createHash('sha256').update(data).digest();
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    } })('lib/auth-crypto.native.ts');
    assert.deepEqual(Array.from(globalThis.crypto.getRandomValues(new Uint32Array(3))), [7, 7, 7]);
    const data = new TextEncoder().encode('verifier');
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    assert.equal(Buffer.from(hash).toString('hex'), nodeCrypto.createHash('sha256').update(data).digest('hex'));
    await assert.rejects(globalThis.crypto.subtle.digest('SHA-1', data));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); else delete globalThis.crypto;
  }
});

test('client configuration emits no temporary diagnostics in development or production', (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const devDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  const logs = [];
  context.mock.method(console, 'info', (...args) => logs.push(args));
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  const overrides = {
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
    '@supabase/supabase-js': { createClient: () => ({ auth: {} }), processLock: () => {} },
    'react-native': { Platform: { OS: 'web' } },
  };
  try {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(modules(overrides)('lib/supabase.ts').supabase, null);
    assert.deepEqual(logs, []);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://private-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_value_never_logged';
    assert.ok(modules(overrides)('lib/supabase.ts').supabase);
    assert.deepEqual(logs, []);
    assert.equal(JSON.stringify(logs).includes('private-project'), false);
    assert.equal(JSON.stringify(logs).includes('test_value_never_logged'), false);
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
    modules(overrides)('lib/supabase.ts');
    assert.equal(logs.length, 0);
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    if (devDescriptor) Object.defineProperty(globalThis, '__DEV__', devDescriptor); else delete globalThis.__DEV__;
  }
});
