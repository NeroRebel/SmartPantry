const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');

// Run the application SQL against real SQLite, replacing only Expo's native bridge.
function loadModules(sqlite) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (name) => {
      if (name === 'expo-sqlite') return sqlite;
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function bridge(filename = ':memory:') {
  let connection;
  let opens = 0;
  return {
    get connection() { return connection; },
    get opens() { return opens; },
    async openDatabaseAsync(name) {
      assert.equal(name, 'smartpantry.db');
      opens++;
      connection = new DatabaseSync(filename);
      return {
        execAsync: async (sql) => connection.exec(sql),
        closeAsync: async () => connection.close(),
        getAllAsync: async (sql, ...params) => connection.prepare(sql).all(...params),
        getFirstAsync: async (sql, ...params) => connection.prepare(sql).get(...params) ?? null,
        runAsync: async (sql, ...params) => {
          const result = connection.prepare(sql).run(...(Array.isArray(params[0]) ? params[0] : params));
          return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
        },
      };
    },
  };
}

const input = {
  name: "Farmer's Milk", brand: null, barcode: '123', category: 'Dairy', quantity: 0.5,
  unit: 'L', expirationDate: '2026-10-15', storageLocation: 'Refrigerator', imageUrl: null,
  notes: "'); DROP TABLE products; --",
};

test('date status boundaries, leap days and daylight saving calendar days', () => {
  const utils = loadModules({})(path.join(root, 'utils/product-status.ts'));
  const today = new Date(2026, 9, 12, 23, 59);
  for (const [date, status] of [['2026-10-11', 'expired'], ['2026-10-12', 'expiringSoon'], ['2026-10-15', 'expiringSoon'], ['2026-10-16', 'fresh']]) {
    assert.equal(utils.getProductStatus(date, today), status);
  }
  assert.equal(utils.getDaysUntilExpiry('2026-10-26', new Date(2026, 9, 24)), 2);
  assert.equal(utils.getDaysUntilExpiry('2026-03-30', new Date(2026, 2, 28)), 2);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-10-1', 'bad']) assert.equal(utils.isValidISODate(date), false);
  assert.equal(utils.isValidISODate('2028-02-29'), true);
});

test('dashboard stats derive from SQLite and update after product changes', async () => {
  const sqlite = bridge();
  const load = loadModules(sqlite);
  const products = load(path.join(root, 'db/products.ts'));
  const { toLocalISODate } = load(path.join(root, 'utils/product-status.ts'));
  const dateFromToday = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toLocalISODate(date);
  };
  try {
    assert.deepEqual(await products.getProductStats(), { total: 0, fresh: 0, expiringSoon: 0, expired: 0 });
    const expiredId = await products.createProduct({ ...input, expirationDate: dateFromToday(-1) });
    const soonId = await products.createProduct({ ...input, expirationDate: dateFromToday(3) });
    await products.createProduct({ ...input, expirationDate: dateFromToday(4) });
    assert.deepEqual(await products.getProductStats(), { total: 3, fresh: 1, expiringSoon: 1, expired: 1 });
    await products.updateProduct(soonId, { ...input, expirationDate: dateFromToday(0) });
    assert.deepEqual(await products.getProductStats(), { total: 3, fresh: 1, expiringSoon: 1, expired: 1 });
    await products.updateProduct(soonId, { ...input, expirationDate: dateFromToday(4) });
    await products.deleteProduct(expiredId);
    assert.deepEqual(await products.getProductStats(), { total: 2, fresh: 2, expiringSoon: 0, expired: 0 });
  } finally {
    sqlite.connection?.close();
  }
});

test('CRUD, parameter binding, ordering, null fields and schema', async () => {
  const sqlite = bridge();
  const load = loadModules(sqlite);
  const db = load(path.join(root, 'db/database.ts'));
  const products = load(path.join(root, 'db/products.ts'));
  await Promise.all([db.initializeDatabase(), db.initializeDatabase()]);
  assert.equal(sqlite.opens, 1);
  assert.equal((await products.getProducts()).length, 0);
  const id = await products.createProduct(input);
  const before = await products.getProductById(id);
  assert.equal(before.name, input.name);
  assert.equal(before.notes, input.notes);
  assert.equal(before.quantity, 0.5);
  assert.equal(before.brand, null);
  const earlier = await products.createProduct({ ...input, name: 'Earlier', expirationDate: '2026-10-11' });
  assert.deepEqual((await products.getProducts()).map((p) => p.id), [earlier, id]);
  await products.updateProduct(id, { ...input, name: 'Updated', quantity: null, expirationDate: '2026-10-10' });
  const after = await products.getProductById(id);
  assert.equal(after.name, 'Updated');
  assert.equal(after.quantity, null);
  assert.equal(after.createdAt, before.createdAt);
  assert.equal((await products.getProducts())[0].id, id);
  await assert.rejects(products.createProduct({ ...input, expirationDate: '2026-02-30' }));
  await assert.rejects(products.createProduct({ ...input, name: ' ' }));
  await assert.rejects(products.createProduct({ ...input, quantity: -1 }));
  await products.deleteProduct(id);
  assert.equal(await products.getProductById(id), null);
  await assert.rejects(products.updateProduct(id, input));
  assert.equal((await products.getProducts()).length, 1);
  const columns = sqlite.connection.prepare('PRAGMA table_info(products)').all().map((p) => p.name);
  assert.equal(columns.includes('status'), false);
  sqlite.connection.close();
});

test('file database persists across app connections and initialization can retry', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpantry-test-'));
  const filename = path.join(folder, 'smartpantry.db');
  let first;
  let second;
  try {
    first = bridge(filename);
    const products = loadModules(first)(path.join(root, 'db/products.ts'));
    const id = await products.createProduct(input);
    first.connection.close();
    first = null;
    second = bridge(filename);
    const reopened = loadModules(second)(path.join(root, 'db/products.ts'));
    assert.equal((await reopened.getProductById(id)).name, input.name);
    await reopened.deleteProduct(id);
    assert.equal((await reopened.getProducts()).length, 0);
  } finally {
    first?.connection?.close();
    second?.connection?.close();
    for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file));
    fs.rmdirSync(folder);
  }
  let attempts = 0;
  const sqlite = bridge();
  const db = loadModules({ openDatabaseAsync: async (...args) => {
    if (++attempts === 1) throw new Error('Temporary failure');
    return sqlite.openDatabaseAsync(...args);
  } })(path.join(root, 'db/database.ts'));
  await assert.rejects(db.initializeDatabase());
  await db.initializeDatabase();
  assert.equal(attempts, 2);
  sqlite.connection.close();
});
