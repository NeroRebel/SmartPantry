const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');

function setup(seed = '') {
  const connection = new DatabaseSync(':memory:'); if (seed) connection.exec(seed);
  let failRemoval = false;
  const db = {
    execAsync: async (sql) => connection.exec(sql), closeAsync: async () => {},
    getAllAsync: async (sql, ...params) => connection.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => connection.prepare(sql).get(...params) ?? null,
    runAsync: async (sql, ...params) => {
      if (failRemoval && sql.startsWith('UPDATE products SET deleted_at')) throw new Error('injected tombstone failure');
      const result = connection.prepare(sql).run(...(Array.isArray(params[0]) ? params[0] : params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withExclusiveTransactionAsync: async (task) => {
      connection.exec('BEGIN IMMEDIATE');
      try { await task(db); connection.exec('COMMIT'); } catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
    withTransactionAsync: async (task) => db.withExclusiveTransactionAsync(task),
  };
  const cache = new Map();
  function load(file) {
    file = path.normalize(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const requireLocal = (name) => {
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => db };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      const target = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(requireLocal, module, module.exports);
    return module.exports;
  }
  return { connection, db, load, failRemoval: () => { failRemoval = true; } };
}

const product = { name: 'Milk', brand: 'Farm', barcode: '0123', category: 'Dairy', quantity: 1, unit: 'L', expirationDate: '2026-11-01', storageLocation: 'Refrigerator', imageUrl: null, notes: 'original' };

test('confirmed per-user purge removes active rows, tombstones and metadata but preserves other users and preferences', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const products = app.load('db/products.ts');
    const shopping = app.load('db/shopping-list.ts'); const history = app.load('db/product-history.ts');
    const cleanup = app.load('db/account-cleanup.ts');
    for (const owner of ['a', 'b']) {
      state.setLocalUserId(owner); await app.load('db/local-owner.ts').claimLegacyData(owner);
      const id = await products.createProduct(product); await history.markProductAsConsumed(id);
      await products.createProduct(product); await shopping.createShoppingItem({ name: 'Eggs' });
      await app.db.runAsync('INSERT INTO local_metadata (key,value) VALUES (?,?)', `last_sync:${owner}`, 'timestamp');
    }
    await assert.rejects(cleanup.purgeDeletedAccount('a'), /confirmation required/);
    await cleanup.recordDeletedAccount('a'); await cleanup.purgeDeletedAccount('a');
    for (const table of ['products', 'shopping_list', 'product_history']) {
      assert.equal(app.connection.prepare(`SELECT count(*) n FROM ${table} WHERE user_id='a'`).get().n, 0);
      assert.ok(app.connection.prepare(`SELECT count(*) n FROM ${table} WHERE user_id='b'`).get().n > 0);
    }
    assert.equal(app.connection.prepare("SELECT value FROM local_metadata WHERE key='last_sync:a'").get(), undefined);
    assert.equal(app.connection.prepare("SELECT value FROM local_metadata WHERE key='last_sync:b'").get().value, 'timestamp');
    assert.equal(app.connection.prepare("SELECT value FROM local_metadata WHERE key='legacy_data_claimed_by_user_id'").get().value, 'retired');
    assert.equal(app.connection.prepare('SELECT notifications_enabled FROM notification_settings').get().notifications_enabled, 1);
    assert.deepEqual(await cleanup.getDeletedAccountsToClean(), ['a']);
    await cleanup.purgeDeletedAccount('a'); // Idempotent after an interrupted session cleanup.
    await cleanup.forgetDeletedAccountReceipt('a'); assert.deepEqual(await cleanup.getDeletedAccountsToClean(), []);
    state.setLocalUserId('c'); await app.load('db/local-owner.ts').claimLegacyData('c');
    assert.deepEqual(await products.getProducts(), []);
  } finally { app.connection.close(); }
});

test('account deletion lock prevents queued repository writes without blocking another account', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const products = app.load('db/products.ts');
    state.setLocalUserId('a'); await app.load('services/account-lock.ts').blockAccount('a');
    await assert.rejects(products.createProduct(product), { code: 'account.deleting' });
    state.setLocalUserId('b'); await products.createProduct(product); assert.equal((await products.getProducts()).length, 1);
  } finally { app.connection.close(); }
});
const legacy = `CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, brand TEXT, barcode TEXT, category TEXT NOT NULL, quantity REAL, unit TEXT, expiration_date TEXT NOT NULL, storage_location TEXT, image_url TEXT, notes TEXT, notification_id TEXT, created_at TEXT NOT NULL);
INSERT INTO products (id,name,category,expiration_date,notification_id,created_at) VALUES (7,'Legacy Milk','Dairy','2026-11-01','device-reminder','2026-10-01');
CREATE TABLE shopping_list (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,quantity REAL,unit TEXT,category TEXT,completed INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'manual',created_at TEXT NOT NULL);
INSERT INTO shopping_list (id,name,completed,created_at) VALUES (3,'Eggs',1,'2026-10-02T00:00:00.000Z');
CREATE TABLE product_history (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,product_name TEXT NOT NULL,brand TEXT,category TEXT,quantity REAL,unit TEXT,expiration_date TEXT,action TEXT NOT NULL,action_date TEXT NOT NULL,created_at TEXT);
INSERT INTO product_history (id,product_id,product_name,category,quantity,action,action_date) VALUES (2,7,'Legacy Milk','Dairy',1,'consumed','2026-10-03T00:00:00.000Z');`;

test('transactional migration preserves every legacy ID, snapshot, reminder and settings', async () => {
  const app = setup(legacy);
  try {
    await app.load('db/database.ts').initializeDatabase();
    const milk = await app.load('db/products.ts').getProductById('7');
    assert.equal(milk.name, 'Legacy Milk'); assert.equal(milk.notificationId, 'device-reminder'); assert.equal(milk.createdAt, '2026-10-01');
    assert.equal((await app.load('db/shopping-list.ts').getShoppingItems())[0].id, '3');
    const [history] = await app.load('db/product-history.ts').getProductHistory();
    assert.equal(history.id, '2'); assert.equal(history.productId, '7'); assert.equal(history.category, 'Dairy'); assert.equal(history.quantity, 1);
    const migrated = app.connection.prepare('SELECT user_id,updated_at,deleted_at FROM products').get();
    assert.equal(migrated.user_id, ''); assert.equal(migrated.updated_at, '2026-10-01T00:00:00.000Z'); assert.equal(migrated.deleted_at, null);
    assert.equal(app.connection.prepare('SELECT notifications_enabled FROM notification_settings').get().notifications_enabled, 1);
    await app.load('db/sync-migration.ts').migrateSyncMetadata(app.db);
    assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM products').get().count, 1);
  } finally { app.connection.close(); }
});

test('legacy adoption happens once and all three repositories isolate account caches', async () => {
  const app = setup(legacy);
  try {
    const state = app.load('db/local-state.ts'); const owners = app.load('db/local-owner.ts');
    const products = app.load('db/products.ts'); const shopping = app.load('db/shopping-list.ts'); const history = app.load('db/product-history.ts');
    state.setLocalUserId('user-a'); await owners.claimLegacyData('user-a');
    assert.equal((await products.getProducts()).length, 1); assert.equal((await shopping.getShoppingItems()).length, 1); assert.equal((await history.getProductHistory()).length, 1);
    state.setLocalUserId('user-b'); await owners.claimLegacyData('user-b');
    assert.deepEqual(await products.getProducts(), []); assert.deepEqual(await shopping.getShoppingItems(), []); assert.deepEqual(await history.getProductHistory(), []);
    await assert.rejects(products.updateProduct('7', product)); await products.deleteProduct('7');
    const own = await products.createProduct({ ...product, name: 'B Milk' }); assert.match(own, /^[a-f0-9]{32}$/);
    assert.equal(await products.getProductById('7'), null);
    state.setLocalUserId('user-a');
    assert.equal((await products.getProductById('7')).name, 'Legacy Milk'); assert.equal(await products.getProductById(own), null);
    assert.equal(app.connection.prepare("SELECT value FROM local_metadata WHERE key='legacy_data_claimed_by_user_id'").get().value, 'user-a');
    state.setLocalUserId(null); assert.deepEqual(await products.getProducts(), []);
    state.setLocalUserId('user-b'); assert.equal((await products.getProductById(own)).name, 'B Milk');
  } finally { app.connection.close(); }
});

test('soft deletes, clears and consume/waste retain account-scoped history and tombstones', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); state.setLocalUserId('a');
    const products = app.load('db/products.ts'); const shopping = app.load('db/shopping-list.ts'); const history = app.load('db/product-history.ts');
    const consumed = await products.createProduct(product); await history.markProductAsConsumed(consumed);
    const wasted = await products.createProduct(product); await history.markProductAsWasted(wasted);
    assert.deepEqual(await products.getProducts(), []); assert.equal((await history.getProductHistory()).length, 2);
    assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM products WHERE deleted_at IS NOT NULL').get().count, 2);
    const item = await shopping.createShoppingItem({ name: 'Eggs' }); await shopping.toggleShoppingItemCompleted(item); await shopping.clearCompletedShoppingItems();
    assert.deepEqual(await shopping.getShoppingItems(), []);
    assert.equal(app.connection.prepare('SELECT completed,deleted_at IS NOT NULL AS removed FROM shopping_list').get().removed, 1);
    state.setLocalUserId('b'); const b = await products.createProduct(product);
    state.setLocalUserId('a'); await app.load('db/manage-data.ts').clearAllAppData();
    assert.deepEqual(await history.getProductHistory(), []); assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM product_history WHERE deleted_at IS NOT NULL').get().count, 2);
    state.setLocalUserId('b'); assert.ok(await products.getProductById(b));
  } finally { app.connection.close(); }
});

test('failed lifecycle tombstone rolls back its history snapshot', async () => {
  const app = setup();
  try {
    const products = app.load('db/products.ts'); const history = app.load('db/product-history.ts');
    const id = await products.createProduct(product); app.failRemoval();
    await assert.rejects(history.markProductAsConsumed(id), /injected/);
    assert.ok(await products.getProductById(id)); assert.deepEqual(await history.getProductHistory(), []);
  } finally { app.connection.close(); }
});

test('failed migration rolls back table copies instead of losing legacy data', async () => {
  const app = setup(legacy.replace("1,'consumed'", "1,'invalid-action'"));
  try {
    await assert.rejects(app.load('db/database.ts').initializeDatabase());
    assert.equal(app.connection.prepare('SELECT name FROM products WHERE id=7').get().name, 'Legacy Milk');
    assert.equal(app.connection.prepare('SELECT action FROM product_history').get().action, 'invalid-action');
    assert.equal(app.connection.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE '%_sync_v1'").get().count, 0);
  } finally { app.connection.close(); }
});

test('an operation queued before an account switch keeps its captured owner', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const products = app.load('db/products.ts');
    state.setLocalUserId('a'); const pending = products.createProduct(product); state.setLocalUserId('b');
    const id = await pending; assert.equal(await products.getProductById(id), null);
    state.setLocalUserId('a'); assert.ok(await products.getProductById(id));
  } finally { app.connection.close(); }
});

function syncHarness(app) {
  const state = app.load('db/local-state.ts'); state.setLocalUserId('a');
  const tables = { products: new Map(), shopping_list: new Map(), product_history: new Map() };
  let offline = false; let beforeWrite = null; let writes = 0;
  const cloud = {
    read: async (entity, owner) => { if (offline) throw new TypeError('Network request failed'); return [...tables[entity].values()].filter((row) => row.user_id === owner).map((row) => ({ ...row })); },
    write: async (entity, row, previous) => {
      if (offline) throw new TypeError('Network request failed');
      if (beforeWrite) { const run = beforeWrite; beforeWrite = null; await run(); }
      const existing = tables[entity].get(row.id);
      if (previous ? existing?.updated_at !== previous.updated_at : !!existing) return null;
      const returned = { ...row, updated_at: previous ? state.localTimestamp() : row.updated_at };
      tables[entity].set(row.id, returned); writes++; return returned;
    },
  };
  const { syncEntity } = app.load('sync/entity-sync.ts'); const local = app.load('sync/local-store.ts').localSyncStore;
  return { tables, local, state, get writes() { return writes; }, offline: (value) => { offline = value; }, beforeWrite: (callback) => { beforeWrite = callback; },
    run: (entity) => syncEntity(entity, 'a', new AbortController().signal, { local, cloud, assertOwner: (owner) => assert.equal(owner, state.getLocalUserId()) }),
  };
}

test('products sync local-only and cloud-only rows, resolves newer versions and is idempotent', async () => {
  const app = setup();
  try {
    const sync = syncHarness(app); const products = app.load('db/products.ts');
    const id = await products.createProduct(product);
    assert.equal((await sync.run('products')).pushed, 1);
    assert.equal(sync.tables.products.get(id).barcode, '0123');
    assert.equal('notification_id' in sync.tables.products.get(id), false);
    assert.equal((await sync.run('products')).pushed, 0);
    await products.updateProduct(id, { ...product, name: 'Local newer' });
    await sync.run('products'); assert.equal(sync.tables.products.get(id).name, 'Local newer');
    const remote = { ...sync.tables.products.get(id), id: 'cloud-only', name: 'Cloud Milk', updated_at: sync.state.localTimestamp() };
    sync.tables.products.set(remote.id, remote);
    assert.equal((await sync.run('products')).pulled, 1); assert.equal((await products.getProductById(remote.id)).name, 'Cloud Milk');
    sync.tables.products.set(id, { ...sync.tables.products.get(id), name: 'Remote newer', updated_at: sync.state.localTimestamp() });
    await sync.run('products'); assert.equal((await products.getProductById(id)).name, 'Remote newer');
    const writes = sync.writes; await sync.run('products'); assert.equal(sync.writes, writes);
    assert.equal((await sync.run('products')).pulled, 0);
  } finally { app.connection.close(); }
});

test('product tombstones propagate both ways and downloading into a new device never resurrects them', async () => {
  const app = setup(); const another = setup();
  try {
    const sync = syncHarness(app); const products = app.load('db/products.ts');
    const id = await products.createProduct(product); await sync.run('products'); await products.deleteProduct(id); await sync.run('products');
    assert.ok(sync.tables.products.get(id).deleted_at);
    const id2 = await products.createProduct(product); await sync.run('products');
    const now = sync.state.localTimestamp(); sync.tables.products.set(id2, { ...sync.tables.products.get(id2), deleted_at: now, updated_at: now });
    await sync.run('products'); assert.deepEqual(await products.getProducts(), []);
    const next = syncHarness(another); for (const [id, row] of sync.tables.products) next.tables.products.set(id, row);
    await next.run('products'); assert.deepEqual(await another.load('db/products.ts').getProducts(), []);
    assert.equal(another.connection.prepare('SELECT COUNT(*) AS count FROM products WHERE deleted_at IS NOT NULL').get().count, 2);
  } finally { app.connection.close(); another.connection.close(); }
});

test('offline sync preserves pending local edits and a concurrent local edit survives server acknowledgement', async () => {
  const app = setup();
  try {
    const sync = syncHarness(app); const products = app.load('db/products.ts');
    const id = await products.createProduct(product); sync.offline(true);
    await assert.rejects(sync.run('products')); assert.equal((await products.getProductById(id)).name, 'Milk');
    sync.offline(false); await sync.run('products');
    await products.updateProduct(id, { ...product, name: 'Sent snapshot' });
    sync.beforeWrite(() => products.updateProduct(id, { ...product, name: 'Edited during upload' }));
    await assert.rejects(sync.run('products'));
    assert.equal((await products.getProductById(id)).name, 'Edited during upload');
    await sync.run('products'); assert.equal(sync.tables.products.get(id).name, 'Edited during upload');
    const writes = sync.writes; await sync.run('products'); assert.equal(sync.writes, writes);
  } finally { app.connection.close(); }
});

test('shopping sync maps is_purchased, preserves local source and syncs clears as tombstones', async () => {
  const app = setup();
  try {
    const sync = syncHarness(app); const shopping = app.load('db/shopping-list.ts');
    const id = await shopping.createShoppingItem({ name: 'Eggs', quantity: 12, unit: 'pcs', source: 'recipe' });
    await shopping.toggleShoppingItemCompleted(id); await sync.run('shopping_list');
    assert.equal(sync.tables.shopping_list.get(id).is_purchased, true);
    assert.equal('completed' in sync.tables.shopping_list.get(id), false); assert.equal('source' in sync.tables.shopping_list.get(id), false);
    sync.tables.shopping_list.set(id, { ...sync.tables.shopping_list.get(id), is_purchased: false, updated_at: sync.state.localTimestamp() });
    await sync.run('shopping_list'); const [item] = await shopping.getShoppingItems();
    assert.equal(item.completed, false); assert.equal(item.source, 'recipe');
    const remote = { ...sync.tables.shopping_list.get(id), id: 'remote-shopping', name: 'Bread', is_purchased: true, updated_at: sync.state.localTimestamp() };
    sync.tables.shopping_list.set(remote.id, remote); await sync.run('shopping_list');
    assert.equal((await shopping.getShoppingItems()).find((item) => item.id === remote.id).source, 'manual');
    await shopping.clearCompletedShoppingItems(); await sync.run('shopping_list');
    assert.ok(sync.tables.shopping_list.get(remote.id).deleted_at); assert.equal((await shopping.getShoppingItems()).length, 1);
    const writes = sync.writes; await sync.run('shopping_list'); assert.equal(sync.writes, writes);
  } finally { app.connection.close(); }
});

test('consumed/wasted snapshots and product tombstones survive history sync on a new device', async () => {
  const app = setup(); const another = setup();
  try {
    const sync = syncHarness(app); const products = app.load('db/products.ts'); const history = app.load('db/product-history.ts');
    const consumed = await products.createProduct(product); await history.markProductAsConsumed(consumed);
    const wasted = await products.createProduct({ ...product, name: 'Wasted Milk' }); await history.markProductAsWasted(wasted);
    await sync.run('products'); await sync.run('product_history');
    const snapshots = [...sync.tables.product_history.values()];
    assert.equal(snapshots.length, 2); assert.ok(snapshots.every((row) => row.barcode === '0123' && row.notes === 'original' && row.processed_at));
    assert.equal(snapshots.some((row) => 'action_date' in row || 'product_name' in row), false);
    assert.ok(sync.tables.products.get(consumed).deleted_at); assert.ok(sync.tables.products.get(wasted).deleted_at);
    const next = syncHarness(another);
    for (const entity of ['products', 'product_history']) for (const [id, row] of sync.tables[entity]) next.tables[entity].set(id, row);
    await next.run('products'); await next.run('product_history');
    assert.deepEqual(await another.load('db/products.ts').getProducts(), []);
    const received = await another.load('db/product-history.ts').getProductHistory();
    assert.equal(received.length, 2); assert.equal(received.find((row) => row.action === 'consumed').productId, consumed);
    assert.equal(received.find((row) => row.action === 'wasted').productName, 'Wasted Milk');
    assert.ok(received.every((row) => row.barcode === '0123' && row.storageLocation === 'Refrigerator' && row.quantity === 1));
    const entry = (await history.getProductHistory())[0]; await history.deleteProductHistoryEntry(entry.id); await sync.run('product_history');
    assert.ok(sync.tables.product_history.get(entry.id).deleted_at);
    const writes = sync.writes; await sync.run('product_history'); assert.equal(sync.writes, writes);
  } finally { app.connection.close(); another.connection.close(); }
});

test('invalid active cloud expiration fails safely instead of breaking local inventory', async () => {
  const app = setup();
  try {
    const sync = syncHarness(app); const products = app.load('db/products.ts'); const id = await products.createProduct(product); await sync.run('products');
    const mapper = app.load('sync/sync-mappers.ts');
    assert.throws(() => mapper.validateCloudRow('products', { ...sync.tables.products.get(id), expiration_date: null }, 'a'));
    assert.equal((await products.getProductById(id)).expirationDate, '2026-11-01');
    assert.throws(() => mapper.validateCloudRow('shopping_list', {}, 'a'));
  } finally { app.connection.close(); }
});

test('downloaded processed_at is normalized for history range boundaries without truncating sync versions', async () => {
  const app = setup();
  try {
    const sync = syncHarness(app); const history = app.load('db/product-history.ts');
    const id = await history.createProductHistoryEntry({ productId: null, productName: 'Milk', brand: null, category: 'Dairy', quantity: 1, unit: 'L', expirationDate: '2026-11-01', action: 'consumed', actionDate: '2026-10-15T00:00:00.000Z', createdAt: null });
    await sync.run('product_history');
    const remote = { ...sync.tables.product_history.get(id), id: 'remote-history', processed_at: '2026-10-15T00:00:00+00:00', created_at: '2026-10-15T00:00:00+00:00', updated_at: '2099-10-15T00:00:00.123456+00:00' };
    sync.tables.product_history.set(remote.id, remote); await sync.run('product_history');
    const entries = await history.getProductHistoryByDateRange('2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z');
    assert.equal(entries.length, 2); assert.equal(entries.find((row) => row.id === remote.id).actionDate, '2026-10-15T00:00:00.000Z');
    assert.equal(app.connection.prepare('SELECT updated_at FROM product_history WHERE id=?').get(remote.id).updated_at, remote.updated_at);
  } finally { app.connection.close(); }
});
