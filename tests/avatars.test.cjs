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
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    function requireLocal(name) {
      if (name in overrides) return overrides[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) throw new Error(`Unexpected dependency: ${name}`);
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    }
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireLocal, module, module.exports);
    return module.exports;
  }
  return (file) => load(path.join(root, file));
}

const helpers = modules()('utils/avatar.ts');
const serviceFactory = modules({ '@/lib/supabase': { supabase: null } })('services/avatars.ts').createAvatarService;
const jpeg = () => new Uint8Array([255, 216, 255, 224, 0, 0]).buffer;
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
const webp = () => new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]).buffer;

function fixture(metadata = {}) {
  const state = { user: { id: 'user-a', email: 'a@example.com', user_metadata: { full_name: 'Name', avatar_url: 'https://example.com/google', ...metadata } }, files: new Map(), calls: [], uploadError: false, updateError: false, removeError: false, signError: false };
  const bucket = {
    upload: async (name, buffer, options) => {
      state.calls.push(['upload', name, options]);
      if (state.uploadError) return { error: new Error('Upload failed') };
      state.files.set(name, { buffer, contentType: options.contentType });
      return { error: null };
    },
    remove: async (names) => {
      state.calls.push(['remove', names]);
      if (state.removeError) return { error: new Error('Remove failed') };
      for (const name of names) state.files.delete(name);
      return { error: null };
    },
    createSignedUrl: async (name, seconds) => {
      state.calls.push(['sign', name, seconds]);
      if (state.signError) return { data: null, error: new Error('Signing failed') };
      return { data: { signedUrl: `https://example.com/private/${name}?token=SECRET` }, error: null };
    },
  };
  const client = { storage: { from: (name) => { assert.equal(name, 'avatars'); return bucket; } }, auth: {
    getSession: async () => ({ data: { session: state.user ? { user: state.user } : null }, error: null }),
    updateUser: async ({ data }) => {
      state.calls.push(['metadata', data]);
      if (state.updateError) return { data: { user: null }, error: new Error('Metadata failed') };
      const metadata = { ...state.user.user_metadata, ...data };
      for (const key of Object.keys(metadata)) if (metadata[key] === null) delete metadata[key];
      state.user = { ...state.user, user_metadata: metadata };
      return { data: { user: state.user }, error: null };
    },
  } };
  return { state, bucket, service: serviceFactory(client) };
}

test('avatar bytes validate actual JPEG/PNG/WebP signatures and enforce the size cap', () => {
  assert.equal(helpers.avatarMimeType(jpeg()), 'image/jpeg');
  assert.equal(helpers.avatarMimeType(png()), 'image/png');
  assert.equal(helpers.avatarMimeType(webp()), 'image/webp');
  assert.throws(() => helpers.avatarMimeType(new ArrayBuffer(0)), { code: 'avatar.unsupported' });
  assert.throws(() => helpers.avatarMimeType(new TextEncoder().encode('<svg/>').buffer), { code: 'avatar.unsupported' });
  assert.throws(() => helpers.validateAvatarSize(helpers.MAX_AVATAR_BYTES + 1), { code: 'avatar.tooLarge' });
  assert.doesNotThrow(() => helpers.validateAvatarSize(helpers.MAX_AVATAR_BYTES));
  assert.equal(helpers.avatarErrorKey(new Error('SECRET_ERROR')), 'avatar.uploadFailed');
});

test('only owned custom paths are resolved; custom, Google, picture and initials priorities remain safe', () => {
  const user = { id: 'user-a', user_metadata: { avatar_path: 'user-a/avatar', avatar_url: 'https://example.com/google', picture: 'https://example.com/picture' } };
  assert.equal(helpers.resolveAvatarUrl(user, 'https://example.com/signed'), 'https://example.com/signed');
  assert.equal(helpers.resolveAvatarUrl(user, null), 'https://example.com/google');
  user.user_metadata.avatar_path = 'user-b/avatar';
  assert.equal(helpers.customAvatarPath(user), null);
  assert.equal(helpers.resolveAvatarUrl(user, 'https://example.com/signed'), 'https://example.com/google');
  user.user_metadata.avatar_url = 'javascript:invalid';
  assert.equal(helpers.resolveAvatarUrl(user, null), 'https://example.com/picture');
  delete user.user_metadata.picture;
  assert.equal(helpers.resolveAvatarUrl(user, null), null);
  assert.equal(helpers.resolveAvatarUrl(null, 'https://example.com/signed'), null);
  assert.throws(() => helpers.avatarPath('../user-b'));
});

test('upload/replacement use one deterministic object and preserve unrelated metadata', async () => {
  const { state, service } = fixture({ picture: 'https://example.com/old', other: 'preserve' });
  const first = await service.upload(state.user, jpeg());
  assert.equal(first.user_metadata.avatar_path, 'user-a/avatar');
  assert.equal(first.user_metadata.full_name, 'Name');
  assert.equal(first.user_metadata.avatar_url, 'https://example.com/google');
  assert.equal(first.user_metadata.other, 'preserve');
  assert.ok(first.user_metadata.avatar_version);
  await service.upload(first, png());
  assert.equal(state.files.size, 1);
  assert.equal(state.files.get('user-a/avatar').contentType, 'image/png');
  assert.deepEqual(state.calls[0], ['upload', 'user-a/avatar', { upsert: true, contentType: 'image/jpeg', cacheControl: '0' }]);
  assert.deepEqual(Object.keys(state.calls.find((call) => call[0] === 'metadata')[1]).sort(), ['avatar_path', 'avatar_version']);
});

test('invalid/oversized images and upload failure do not modify profile metadata', async () => {
  const { state, service } = fixture();
  await assert.rejects(service.upload(state.user, new ArrayBuffer(2)), { code: 'avatar.unsupported' });
  await assert.rejects(service.upload(state.user, new ArrayBuffer(helpers.MAX_AVATAR_BYTES + 1)), { code: 'avatar.tooLarge' });
  assert.equal(state.calls.length, 0);
  state.uploadError = true;
  await assert.rejects(service.upload(state.user, jpeg()));
  assert.equal(state.calls.filter((call) => call[0] === 'metadata').length, 0);
});

test('development diagnostics keep Storage classifications but never messages, paths or nested credentials', async () => {
  const previousDev = global.__DEV__; const previousWarn = console.warn;
  const logs = [];
  global.__DEV__ = true; console.warn = (...args) => logs.push(args);
  try {
    const { state, bucket, service } = fixture();
    const failure = Object.assign(new Error('new row violates row-level security policy'), {
      name: 'StorageApiError', statusCode: '403', access_token: 'SECRET', session: { refresh_token: 'SECRET' },
    });
    bucket.upload = async () => ({ error: failure });
    await assert.rejects(service.upload(state.user, jpeg()), (error) => error === failure);
    assert.deepEqual(logs, [['[SmartPantry] Avatar storage upload failed', {
      name: 'StorageApiError', status: '403', bucket: 'avatars',
    }]]);
    assert.equal(JSON.stringify(logs).includes('SECRET'), false);
    assert.equal(JSON.stringify(logs).includes('user-a'), false);
    assert.equal(JSON.stringify(logs).includes(failure.message), false);
    logs.length = 0;
    bucket.upload = async () => { throw Object.assign(new Error('Request failed https://example.com?token=SECRET Bearer SECRET access_token=SECRET sb_publishable_SECRET'), { status: 500 }); };
    await assert.rejects(service.upload(state.user, jpeg()));
    assert.equal(logs[0][1].status, 500);
    assert.equal(JSON.stringify(logs).includes('SECRET'), false);
    logs.length = 0; global.__DEV__ = false;
    await assert.rejects(service.upload(state.user, jpeg()));
    assert.equal(logs.length, 0);
  } finally { console.warn = previousWarn; if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev; }
});

test('metadata failures are distinguished from Storage failures in development', async () => {
  const previousDev = global.__DEV__; const previousWarn = console.warn;
  const logs = []; global.__DEV__ = true; console.warn = (...args) => logs.push(args);
  try {
    const { state, service } = fixture(); state.updateError = true;
    await assert.rejects(service.upload(state.user, jpeg()));
    assert.equal(logs[0][0], '[SmartPantry] Avatar metadata update failed');
    assert.equal(logs[0][1].bucket, 'avatars');
    assert.equal(Object.hasOwn(logs[0][1], 'message'), false);
  } finally { console.warn = previousWarn; if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev; }
});

test('upload rejects missing user IDs and absent sessions before reaching Storage', async () => {
  const { state, service } = fixture(); const user = state.user;
  await assert.rejects(service.upload({ ...user, id: undefined }, jpeg()), { code: 'avatar.sessionChanged' });
  await assert.rejects(service.upload({ ...user, id: '' }, jpeg()), { code: 'avatar.sessionChanged' });
  state.user = null;
  await assert.rejects(service.upload(user, jpeg()), { code: 'avatar.sessionChanged' });
  assert.equal(state.calls.length, 0);
});

test('first-upload metadata failure compensates; failed replacement never deletes a referenced avatar', async () => {
  const first = fixture(); first.state.updateError = true;
  await assert.rejects(first.service.upload(first.state.user, jpeg()));
  assert.equal(first.state.files.size, 0);
  const replacement = fixture({ avatar_path: 'user-a/avatar' }); replacement.state.updateError = true;
  await assert.rejects(replacement.service.upload(replacement.state.user, jpeg()));
  assert.equal(replacement.state.files.size, 1);
  assert.equal(replacement.state.calls.some((call) => call[0] === 'remove'), false);
});

test('remove deletes the file, clears only custom metadata and restores account-photo fallback', async () => {
  const { state, service } = fixture({ avatar_path: 'user-a/avatar', avatar_version: 'old' });
  state.files.set('user-a/avatar', { buffer: jpeg() });
  const user = await service.remove(state.user);
  assert.equal(state.files.size, 0);
  assert.equal(user.user_metadata.avatar_path, undefined);
  assert.equal(user.user_metadata.avatar_version, undefined);
  assert.equal(user.user_metadata.full_name, 'Name');
  assert.equal(helpers.resolveAvatarUrl(user, null), 'https://example.com/google');
});

test('removal failures leave retryable state and never silently report success', async () => {
  const { state, service } = fixture({ avatar_path: 'user-a/avatar' });
  state.files.set('user-a/avatar', { buffer: jpeg() }); state.removeError = true;
  await assert.rejects(service.remove(state.user));
  assert.equal(state.files.size, 1);
  assert.equal(state.calls.some((call) => call[0] === 'metadata'), false);
  state.removeError = false; state.updateError = true;
  await assert.rejects(service.remove(state.user));
  assert.equal(state.files.size, 0);
  state.updateError = false;
  assert.equal((await service.remove(state.user)).user_metadata.avatar_path, undefined);
});

test('signed URL uses owned path, finite expiration and cache-busting version without persisting the URL', async () => {
  const { state, service } = fixture({ avatar_path: 'user-a/avatar', avatar_version: 'new-version' });
  const url = new URL(await service.signedUrl(state.user));
  assert.equal(url.searchParams.get('v'), 'new-version');
  assert.equal(url.searchParams.get('token'), 'SECRET');
  assert.deepEqual(state.calls, [['sign', 'user-a/avatar', helpers.AVATAR_URL_SECONDS]]);
  assert.equal(state.user.user_metadata.avatar_url, 'https://example.com/google');
  state.signError = true; await assert.rejects(service.signedUrl(state.user));
});

test('account switching blocks mutation/signing of another user folder before a storage request', async () => {
  const { state, service } = fixture();
  const another = { id: 'user-b', user_metadata: { avatar_path: 'user-b/avatar' } };
  await assert.rejects(service.upload(another, jpeg()), { code: 'avatar.sessionChanged' });
  await assert.rejects(service.remove(another), { code: 'avatar.sessionChanged' });
  await assert.rejects(service.signedUrl(another), { code: 'avatar.sessionChanged' });
  assert.equal(state.calls.length, 0);
});

test('native picker crops images and reads an Expo File ArrayBuffer; cancellation changes nothing', async () => {
  let canceled = false; let reads = 0;
  const pick = modules({
    'react-native': { Platform: { OS: 'android' } },
    'expo-image-picker': { launchImageLibraryAsync: async (options) => {
      assert.deepEqual(options.mediaTypes, ['images']); assert.equal(options.allowsEditing, true); assert.deepEqual(options.aspect, [1, 1]);
      return canceled ? { canceled: true } : { canceled: false, assets: [{ uri: 'file:///avatar.jpg', type: 'image', fileName: 'original.HEIC' }] };
    } },
    'expo-file-system': { File: class { constructor(uri) { assert.equal(uri, 'file:///avatar.jpg'); this.size = jpeg().byteLength; } async arrayBuffer() { reads++; return jpeg(); } } },
  })('services/avatar-picker.ts').pickAvatar;
  assert.equal(helpers.avatarMimeType(await pick()), 'image/jpeg');
  canceled = true; assert.equal(await pick(), null); assert.equal(reads, 1);
});

test('web picker uses the selected browser file only on web and rejects excessive size before reading', async () => {
  let size = png().byteLength;
  const pick = modules({
    'react-native': { Platform: { OS: 'web' } }, 'expo-file-system': { File: class { constructor() { throw new Error('Unexpected native File'); } } },
    'expo-image-picker': { launchImageLibraryAsync: async (options) => {
      assert.equal(options.allowsEditing, false);
      return { canceled: false, assets: [{ uri: 'blob:image', file: { size, arrayBuffer: async () => png() } }] };
    } },
  })('services/avatar-picker.ts').pickAvatar;
  assert.equal(helpers.avatarMimeType(await pick()), 'image/png');
  size = helpers.MAX_AVATAR_BYTES + 1;
  await assert.rejects(pick(), { code: 'avatar.tooLarge' });
});

test('avatar strings are translated into all five languages and SQL includes an owner boundary', () => {
  const translations = modules()('i18n/avatar.ts').avatarTranslations;
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), Object.keys(translations.en).sort());
  const sql = fs.readFileSync(path.resolve(__dirname, '../docs/avatar-storage.sql'), 'utf8');
  assert.match(sql, /as restrictive/i);
  assert.match(sql, /for update to authenticated[\s\S]+using[\s\S]+with check/i);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
});
