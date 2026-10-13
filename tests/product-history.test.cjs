const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');

function setup({ platform = 'ios', failDelete = false } = {}) {
  let connection;
  const sqlite = {
    async openDatabaseAsync(name) {
      assert.equal(name, 'smartpantry.db');
      connection = new DatabaseSync(':memory:');
      const db = {
        execAsync: async (sql) => connection.exec(sql),
        closeAsync: async () => connection.close(),
        getAllAsync: async (sql, ...params) => connection.prepare(sql).all(...params),
        getFirstAsync: async (sql, ...params) => connection.prepare(sql).get(...params) ?? null,
        runAsync: async (sql, ...params) => {
          if (failDelete && sql.startsWith('DELETE FROM products')) throw new Error('Simulated delete failure');
          const result = connection.prepare(sql).run(...(Array.isArray(params[0]) ? params[0] : params));
          return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
        },
        withExclusiveTransactionAsync: async (task) => transaction('BEGIN IMMEDIATE', () => task(db)),
        withTransactionAsync: async (task) => transaction('BEGIN', task),
      };
      async function transaction(begin, task) {
        connection.exec(begin);
        try {
          await task();
          connection.exec('COMMIT');
        } catch (error) {
          connection.exec('ROLLBACK');
          throw error;
        }
      }
      return db;
    },
  };
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
      if (name === 'react-native') return { Platform: { OS: platform } };
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    products: load(path.join(root, 'db/products.ts')),
    history: load(path.join(root, 'db/product-history.ts')),
    get connection() { return connection; },
  };
}

const input = {
  name: 'Milk', brand: 'Local Farm', barcode: null, category: 'Dairy', quantity: 1,
  unit: 'L', expirationDate: '2026-10-20', storageLocation: 'Refrigerator', imageUrl: null, notes: null,
};

test('marking consumed stores a snapshot and removes the active product atomically', async () => {
  const db = setup();
  try {
    const id = await db.products.createProduct(input);
    const original = await db.products.getProductById(id);
    await db.history.markProductAsConsumed(id);
    assert.equal(await db.products.getProductById(id), null);
    const [entry] = await db.history.getProductHistory();
    assert.equal(entry.productId, id);
    assert.equal(entry.productName, 'Milk');
    assert.equal(entry.brand, 'Local Farm');
    assert.equal(entry.category, 'Dairy');
    assert.equal(entry.quantity, 1);
    assert.equal(entry.unit, 'L');
    assert.equal(entry.expirationDate, '2026-10-20');
    assert.equal(entry.createdAt, original.createdAt);
    assert.equal(entry.action, 'consumed');
    assert.ok(Number.isFinite(Date.parse(entry.actionDate)));
    await assert.rejects(db.history.markProductAsConsumed(id));
    assert.equal((await db.history.getProductHistory()).length, 1);
  } finally {
    db.connection?.close();
  }
});

test('marking wasted works through the web transaction fallback', async () => {
  const db = setup({ platform: 'web' });
  try {
    const id = await db.products.createProduct({ ...input, name: 'Tomatoes', category: 'Vegetables', quantity: 4, unit: 'pcs' });
    await db.history.markProductAsWasted(id);
    assert.equal((await db.products.getProducts()).length, 0);
    const [entry] = await db.history.getProductHistory();
    assert.equal(entry.action, 'wasted');
    assert.equal(entry.productName, 'Tomatoes');
    assert.equal(entry.category, 'Vegetables');
    assert.equal(entry.quantity, 4);
  } finally {
    db.connection?.close();
  }
});

test('a failed removal rolls back the inserted history snapshot', async () => {
  const db = setup({ failDelete: true });
  try {
    const id = await db.products.createProduct(input);
    await assert.rejects(db.history.markProductAsWasted(id), /Simulated delete failure/);
    assert.equal((await db.products.getProducts()).length, 1);
    assert.deepEqual(await db.history.getProductHistory(), []);
  } finally {
    db.connection?.close();
  }
});

test('history date ranges, ordering and deletion use persisted action dates', async () => {
  const db = setup();
  const entry = (name, actionDate) => ({
    productId: null, productName: name, brand: null, category: null, quantity: null,
    unit: null, expirationDate: null, action: 'wasted', actionDate, createdAt: null,
  });
  try {
    await db.history.createProductHistoryEntry(entry('Old', '2026-09-01T12:00:00.000Z'));
    const middle = await db.history.createProductHistoryEntry(entry('Middle', '2026-10-10T12:00:00.000Z'));
    await db.history.createProductHistoryEntry(entry('Latest', '2026-10-13T12:00:00.000Z'));
    assert.deepEqual((await db.history.getProductHistory()).map((item) => item.productName), ['Latest', 'Middle', 'Old']);
    assert.deepEqual((await db.history.getProductHistoryByDateRange('2026-10-10T00:00:00.000Z', '2026-10-13T00:00:00.000Z')).map((item) => item.productName), ['Middle']);
    await db.history.deleteProductHistoryEntry(middle);
    assert.deepEqual((await db.history.getProductHistory()).map((item) => item.productName), ['Latest', 'Old']);
  } finally {
    db.connection?.close();
  }
});

const stats = setupStats();
function setupStats() {
  const filename = path.join(root, 'utils/statistics.ts');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(module, exports) {${source}\n})`, { filename })(module, module.exports);
  return module.exports;
}

test('statistics handle zero history, waste rate, categories and latest activity', () => {
  assert.equal(stats.calculateWasteRate(0, 0), 0);
  assert.equal(stats.calculateWasteRate(18, 4).toFixed(1), '18.2');
  const entry = (id, action, category, day) => ({ id, action, category, actionDate: `2026-10-${day}T12:00:00.000Z` });
  const entries = [
    entry(1, 'wasted', 'Dairy', '10'), entry(2, 'consumed', 'Dairy', '11'),
    entry(3, 'wasted', 'Vegetables', '13'), entry(4, 'wasted', 'Vegetables', '12'),
    entry(5, 'consumed', 'Pantry', '13'),
  ];
  const result = stats.calculateStatistics(entries);
  assert.equal(result.consumed, 2);
  assert.equal(result.wasted, 3);
  assert.equal(result.total, 5);
  assert.equal(result.wasteRate, 60);
  assert.deepEqual(result.wastedCategories, [{ category: 'Vegetables', count: 2 }, { category: 'Dairy', count: 1 }]);
  assert.deepEqual(result.recent.map((item) => item.id), [5, 3, 4, 2, 1]);
  assert.deepEqual(stats.calculateStatistics([]).wastedCategories, []);
});

test('period bounds include today and the prior calendar days', () => {
  const now = new Date(2026, 9, 13, 12);
  const seven = stats.getStatisticsDateRange('7d', now);
  assert.equal(seven.start, new Date(2026, 9, 7).toISOString());
  assert.equal(seven.end, new Date(2026, 9, 14).toISOString());
  const thirty = stats.getStatisticsDateRange('30d', now);
  assert.equal(thirty.start, new Date(2026, 8, 14).toISOString());
  assert.equal(stats.getStatisticsDateRange('all', now), null);
});
