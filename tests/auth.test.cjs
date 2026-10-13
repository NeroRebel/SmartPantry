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
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
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

test('development configuration diagnostics contain only three booleans and never credentials', (context) => {
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
    assert.deepEqual(logs[0], ['[SmartPantry] Supabase configuration', {
      SUPABASE_URL_exists: false, SUPABASE_PUBLISHABLE_KEY_exists: false, SUPABASE_client_initialized: false,
    }]);
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://private-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_value_never_logged';
    modules(overrides)('lib/supabase.ts');
    assert.deepEqual(logs[1][1], {
      SUPABASE_URL_exists: true, SUPABASE_PUBLISHABLE_KEY_exists: true, SUPABASE_client_initialized: true,
    });
    assert.equal(JSON.stringify(logs).includes('private-project'), false);
    assert.equal(JSON.stringify(logs).includes('test_value_never_logged'), false);
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
    modules(overrides)('lib/supabase.ts');
    assert.equal(logs.length, 2);
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    if (devDescriptor) Object.defineProperty(globalThis, '__DEV__', devDescriptor); else delete globalThis.__DEV__;
  }
});
