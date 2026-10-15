const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function modules(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.normalize(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`)((name) => {
      if (name in overrides) return overrides[name];
      return load(name.startsWith('@/') ? `src/${name.slice(2)}.ts` : path.join(path.dirname(file), `${name}.ts`));
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = modules({ '@/lib/supabase': { supabase: null }, './notifications': {}, '@/db/account-cleanup': {} });
const utils = load('src/utils/account.ts');
const auth = load('src/utils/auth.ts');
const account = load('src/services/account-deletion.ts');

test('email change reuses provider detection and rejects invalid or unchanged email', () => {
  assert.equal(auth.hasEmailIdentity({ identities: [{ provider: 'google' }], email: 'user@example.com' }), false);
  assert.equal(auth.hasEmailIdentity({ identities: [{ provider: 'google' }, { provider: 'email' }] }), true);
  assert.equal(utils.validateEmailChange('bad'), 'auth.invalidEmail');
  assert.equal(utils.validateEmailChange(' USER@example.com ', 'user@example.com'), 'account.sameEmail');
  assert.equal(utils.validateEmailChange('new@example.com', 'user@example.com'), null);
  assert.equal(utils.canConfirmAccountDeletion(false, 'DELETE'), false);
  assert.equal(utils.canConfirmAccountDeletion(true, 'delete'), false);
  assert.equal(utils.canConfirmAccountDeletion(true, 'DELETE'), true);
});
function deletionSetup() {
  const calls = []; let serverFails = false; let cleanupFails = false;
  const remove = account.createAccountDeletion({
    pause: async () => { calls.push('pause'); assert.equal(load('src/services/account-lock.ts').isAccountBlocked('a'), true); },
    resume: () => calls.push('resume'),
    removeCloud: async () => { calls.push('server'); if (serverFails) throw new Error('network'); },
    record: async () => calls.push('receipt'),
    cleanup: async () => { calls.push('cleanup'); if (cleanupFails) throw new Error('disk'); },
    clearSession: async (id) => { assert.equal(id, 'a'); calls.push('session'); },
    forgetReceipt: async () => calls.push('forget'),
  });
  return { remove, calls, serverFails: (v) => { serverFails = v; }, cleanupFails: (v) => { cleanupFails = v; } };
}
test('failed server deletion never clears local data and resumes sync', async () => {
  const app = deletionSetup(); app.serverFails(true);
  await assert.rejects(app.remove('a', 'DELETE'));
  assert.deepEqual(app.calls, ['pause', 'server', 'resume']);
  assert.equal(load('src/services/account-lock.ts').isAccountBlocked('a'), false);
});
test('confirmed deletion clears session; cleanup retry never calls server twice', async () => {
  const app = deletionSetup(); app.cleanupFails(true);
  await assert.rejects(app.remove('a', 'DELETE'), { code: 'account.cleanupFailed' });
  assert.equal(load('src/services/account-lock.ts').isAccountBlocked('a'), true);
  app.cleanupFails(false); await app.remove('a', 'DELETE');
  assert.deepEqual(app.calls, ['pause', 'server', 'receipt', 'cleanup', 'pause', 'receipt', 'cleanup', 'session', 'forget']);
  await assert.rejects(app.remove('a', 'delete'), { code: 'account.confirmRequired' });
});
test('account gate drains profile operations and blocks later writes only for the deleting owner', async () => {
  const gate = modules()('src/services/account-lock.ts'); let release;
  const task = gate.runAccountOperation('a', () => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve(); let drained = false;
  const pause = gate.blockAccount('a').then(() => { drained = true; });
  await Promise.resolve(); assert.equal(drained, false);
  await assert.rejects(gate.runAccountOperation('a', async () => {}), { code: 'account.deleting' });
  await gate.runAccountOperation('b', async () => {});
  release(); await task; await pause; assert.equal(drained, true);
});
test('cloud delete validates current account and requires matching server confirmation', async () => {
  let invokes = 0; let response = { data: { deleted: true, userId: 'a' }, error: null };
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'a' }, access_token: 'test-account-a-token' } } }) }, functions: { invoke: async (name, options) => {
    invokes++; assert.equal(name, 'delete-account'); assert.deepEqual(options.body, { confirmation: 'DELETE' });
    assert.equal(options.headers.Authorization, 'Bearer test-account-a-token'); return response;
  } } };
  await assert.rejects(account.deleteCloudAccount('b', client)); assert.equal(invokes, 0);
  await account.deleteCloudAccount('a', client);
  response = { data: { deleted: true, userId: 'b' }, error: null };
  await assert.rejects(account.deleteCloudAccount('a', client), { code: 'account.deleteFailed' });
  response = { data: null, error: new Error('secret request context') };
  await assert.rejects(account.deleteCloudAccount('a', client), { code: 'account.deleteFailed' });
});
const edge = modules()('supabase/functions/delete-account/handler.ts');
const owner = '11111111-1111-4111-8111-111111111111';
function edgeSetup() {
  let files = [{ id: '1', name: 'avatar' }, { id: '2', name: 'avatar.jpg' }]; const calls = [];
  const deps = { cascadeVerified: true, validateUser: async (token) => token === 'valid' ? owner : null,
    list: async (folder) => { assert.equal(folder, owner); return { data: files, error: null }; },
    remove: async (paths) => { calls.push(paths); files = []; return { error: null }; },
    deleteUser: async (id) => { assert.equal(id, owner); calls.push('auth'); return { error: null }; },
  };
  const request = (body = { confirmation: 'DELETE' }, token = 'valid') => new Request('https://example.com', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { deps, calls, request };
}
test('edge validates JWT, rejects arbitrary owner input and requires deployment preflight', async () => {
  const app = edgeSetup(); const handler = edge.createDeleteAccountHandler(app.deps);
  assert.equal((await handler(app.request({}, 'invalid'))).status, 401);
  assert.equal((await handler(app.request({ confirmation: 'DELETE', user_id: 'other' }))).status, 400);
  app.deps.cascadeVerified = false; assert.equal((await handler(app.request())).status, 503);
  assert.equal(app.calls.length, 0);
});
test('edge removes all owned avatar extensions before hard auth deletion', async () => {
  const app = edgeSetup(); const response = await edge.createDeleteAccountHandler(app.deps)(app.request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { deleted: true, userId: owner });
  assert.deepEqual(app.calls, [[`${owner}/avatar`, `${owner}/avatar.jpg`], 'auth']);
});
test('avatar failure aborts auth deletion and malformed paths never escape the user folder', async () => {
  const app = edgeSetup(); app.deps.remove = async () => ({ error: { message: 'failure' } });
  assert.equal((await edge.createDeleteAccountHandler(app.deps)(app.request())).status, 502);
  assert.equal(app.calls.length, 0);
  await assert.rejects(edge.collectAvatarPaths(owner, { list: async () => ({ data: [{ name: '../other', id: 'x' }], error: null }) }));
});
test('avatar cleanup traverses nested owned folders and paginates', async () => {
  const calls = [];
  const result = await edge.collectAvatarPaths(owner, { list: async (folder, offset) => {
    calls.push([folder, offset]);
    return { data: folder === owner ? offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ name: `file-${i}`, id: `id-${i}` })) : [{ name: 'nested', id: null }] : [{ name: 'avatar.png', id: 'nested-id' }], error: null };
  } });
  assert.equal(result.length, 101); assert.ok(result.every((name) => name.startsWith(`${owner}/`)));
  assert.deepEqual(calls, [[owner, 0], [owner, 100], [`${owner}/nested`, 0]]);
});
test('account translations have complete keys in all five languages', () => {
  const resources = modules()('src/i18n/account.ts').accountTranslations;
  for (const locale of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(resources[locale]).sort(), Object.keys(resources.en).sort());
});

test('startup retries confirmed cleanup before removing its receipt and scopes session clearing to the deleted ID', async () => {
  const calls = []; let pending = ['a'];
  const recovery = modules({
    '@/lib/supabase': { supabase: null },
    './notifications': { cancelDeletedAccountReminders: async (id) => calls.push(['notifications', id]) },
    '@/db/account-cleanup': {
      getDeletedAccountsToClean: async () => pending,
      purgeDeletedAccount: async (id) => calls.push(['purge', id]),
      forgetDeletedAccountReceipt: async (id) => { calls.push(['receipt', id]); pending = []; },
    },
  })('src/services/account-deletion.ts');
  await recovery.recoverDeletedAccountCleanup(async (id) => calls.push(['session', id]));
  assert.deepEqual(calls, [['notifications', 'a'], ['purge', 'a'], ['session', 'a'], ['receipt', 'a']]);
  await recovery.recoverDeletedAccountCleanup(async () => assert.fail('already cleaned'));
  assert.equal(calls.length, 4);
});
