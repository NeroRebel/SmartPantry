const assert = require('node:assert/strict'); const { test } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function modules() {
  const cache = new Map();
  function load(file) {
    file = path.normalize(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`)((name) => load(`${name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name)}.ts`), module, module.exports);
    return module.exports;
  }
  return load;
}
function setup() {
  let activeOwner = 'a'; let offline = false; let wait = null;
  const calls = []; const successes = []; const load = modules();
  const service = load('sync/sync-service.ts').createSyncService({
    assertOwner: (owner) => { if (owner !== activeOwner) throw new (load('sync/sync-types.ts').SyncAccountChanged)(); },
    local: { read: async () => [], apply: async () => false, acknowledge: async () => false, lastSuccessful: async () => null, recordSuccess: async (owner, date) => successes.push([owner, date]) },
    cloud: { read: async (entity, owner, signal) => { calls.push([entity, owner]); if (wait) { const pending = wait; wait = null; await pending; } if (offline) throw new TypeError('Network request failed'); return []; }, write: async () => null },
    reconcileReminders: async () => calls.push(['reminders', activeOwner]),
  });
  return { service, calls, successes, offline: (next) => { offline = next; }, owner: (next) => { activeOwner = next; }, wait: (next) => { wait = next; } };
}
async function flush() { for (let i = 0; i < 80; i++) await Promise.resolve(); }

test('deletion pause aborts and drains sync, blocks reactivation and retries until explicitly resumed', async () => {
  const app = setup();
  try {
    let release; app.wait(new Promise((resolve) => { release = resolve; }));
    app.service.activate('a'); const first = app.service.syncNow(); await flush();
    let drained = false; const pause = app.service.pauseAndDrain('a').then(() => { drained = true; });
    await flush(); assert.equal(drained, false); app.service.activate('a'); app.service.schedule(0);
    release(); await first; await pause; assert.equal(drained, true);
    await app.service.syncNow(); assert.equal(app.successes.length, 0); assert.equal(app.service.getSnapshot().userId, null);
    app.service.resume('a'); app.service.activate('a'); await app.service.syncNow(); assert.equal(app.successes.length, 1);
  } finally { app.service.dispose(); }
});

test('sync coordinator runs products, shopping and history once, coalesces concurrent runs, records success', async () => {
  const app = setup();
  try {
    let release; app.wait(new Promise((resolve) => { release = resolve; })); app.service.activate('a');
    const first = app.service.syncNow(); assert.equal(app.service.syncNow(), first);
    await flush(); assert.equal(app.service.getSnapshot().status, 'syncing'); release(); await first;
    assert.deepEqual(app.calls.map(([entity]) => entity), ['products', 'reminders', 'shopping_list', 'product_history']);
    assert.equal(app.successes.length, 1); assert.equal(app.successes[0][0], 'a'); assert.equal(app.service.getSnapshot().status, 'synced');
    assert.ok(app.service.getSnapshot().lastSuccessfulSyncAt);
  } finally { app.service.dispose(); }
});

test('account switching cancels stale runs, scopes last-sync state and runs only the new account afterward', async () => {
  const app = setup();
  try {
    let release; app.wait(new Promise((resolve) => { release = resolve; })); app.service.activate('a'); const first = app.service.syncNow(); await flush();
    app.owner('b'); app.service.activate('b'); const second = app.service.syncNow();
    assert.equal(app.service.getSnapshot().userId, 'b'); assert.equal(app.service.getSnapshot().lastSuccessfulSyncAt, null);
    release(); await first; await second;
    assert.deepEqual(app.successes.map(([owner]) => owner), ['b']); assert.equal(app.service.getSnapshot().userId, 'b'); assert.equal(app.service.getSnapshot().status, 'synced');
    app.service.activate(null); assert.equal(app.service.getSnapshot().lastSuccessfulSyncAt, null);
  } finally { app.service.dispose(); }
});

test('offline retries are bounded; local changes can schedule a later successful retry', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] }); const app = setup();
  try {
    app.offline(true); app.service.activate('a'); await app.service.syncNow();
    assert.equal(app.service.getSnapshot().status, 'offline'); assert.equal(app.successes.length, 0);
    context.mock.timers.tick(10000); await flush(); context.mock.timers.tick(30000); await flush();
    assert.equal(app.calls.filter(([entity]) => entity !== 'reminders').length, 3);
    assert.equal(app.calls.filter(([entity]) => entity === 'reminders').length, 3);
    context.mock.timers.tick(120000); await flush(); assert.equal(app.calls.filter(([entity]) => entity !== 'reminders').length, 3);
    app.offline(false); app.service.schedule(); context.mock.timers.tick(1500); await flush();
    assert.equal(app.service.getSnapshot().status, 'synced'); assert.equal(app.successes.length, 1);
  } finally { app.service.dispose(); }
});

test('sync translations cover every UI key in all supported languages', () => {
  const translations = modules()('i18n/sync.ts').syncTranslations;
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), Object.keys(translations.en).sort());
});

test('cloud adapter scopes every request, paginates, and conditionally updates against fetched versions', async () => {
  const load = modules(); const requests = []; let owner = 'a';
  const base = { id: '1', user_id: 'a', name: 'Eggs', quantity: 12, unit: 'pcs', category: 'Dairy', is_purchased: false, created_at: '2026-10-15T00:00:00.000Z', updated_at: '2026-10-15T00:00:00.000Z', deleted_at: null };
  let returned = [base];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: owner } } }, error: null }) },
    from: (entity) => {
      const request = { entity, filters: [], operation: 'read' };
      const query = {
        select: (columns) => { request.columns = columns; return query; },
        eq: (field, value) => { request.filters.push([field, value]); return query; },
        order: (field) => { request.order = field; return query; },
        range: (from, to) => { request.range = [from, to]; return query; },
        update: (row) => { request.operation = 'update'; request.row = row; return query; },
        upsert: (row, options) => { request.operation = 'insert'; request.row = row; request.options = options; return query; },
        abortSignal: async (signal) => { assert.ok(signal instanceof AbortSignal); requests.push(request); return { data: returned, error: null }; },
      };
      return query;
    },
  };
  const store = load('sync/cloud-store.ts').createCloudStore(client); const signal = new AbortController().signal;
  assert.equal((await store.read('shopping_list', 'a', signal)).length, 1);
  assert.deepEqual(requests[0].filters, [['user_id', 'a']]); assert.deepEqual(requests[0].range, [0, 249]); assert.equal(requests[0].order, 'id');
  await store.write('shopping_list', base, base, signal);
  assert.deepEqual(requests[1].filters, [['user_id', 'a'], ['id', '1'], ['updated_at', base.updated_at]]);
  await store.write('shopping_list', base, undefined, signal);
  assert.deepEqual(requests[2].options, { onConflict: 'user_id,id', ignoreDuplicates: true });
  returned = []; assert.equal(await store.write('shopping_list', base, base, signal), null);
  owner = 'b'; await assert.rejects(store.read('shopping_list', 'a', signal));
  await assert.rejects(store.write('shopping_list', base, undefined, signal));
  assert.equal(requests.length, 4);
});
