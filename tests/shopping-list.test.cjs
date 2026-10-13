const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');

function setup(filename = ':memory:') {
  let connection;
  const sqlite = {
    async openDatabaseAsync(name) {
      assert.equal(name, 'smartpantry.db');
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
  return { repository: load(path.join(root, 'db/shopping-list.ts')), get connection() { return connection; } };
}

test('shopping items support create, read, edit, toggle, delete and empty list', async () => {
  const db = setup();
  const repo = db.repository;
  try {
    assert.deepEqual(await repo.getShoppingItems(), []);
    const id = await repo.createShoppingItem({ name: '  Milk  ', quantity: 1, unit: ' L ', category: ' Dairy ' });
    const initial = (await repo.getShoppingItems())[0];
    assert.equal(initial.id, id);
    assert.equal(initial.name, 'Milk');
    assert.equal(initial.quantity, 1);
    assert.equal(initial.unit, 'L');
    assert.equal(initial.category, 'Dairy');
    assert.equal(initial.completed, false);
    assert.equal(initial.source, 'manual');
    assert.ok(initial.createdAt);
    assert.equal(db.connection.prepare('SELECT completed FROM shopping_list WHERE id = ?').get(id).completed, 0);

    await repo.updateShoppingItem(id, { name: 'Oat Milk', quantity: 2, unit: 'pack', category: null });
    assert.equal((await repo.getShoppingItems())[0].name, 'Oat Milk');
    assert.equal((await repo.getShoppingItems())[0].category, null);
    await repo.toggleShoppingItemCompleted(id);
    assert.equal((await repo.getShoppingItems())[0].completed, true);
    assert.equal(db.connection.prepare('SELECT completed FROM shopping_list WHERE id = ?').get(id).completed, 1);
    await repo.toggleShoppingItemCompleted(id);
    assert.equal((await repo.getShoppingItems())[0].completed, false);
    await repo.deleteShoppingItem(id);
    assert.deepEqual(await repo.getShoppingItems(), []);
    await assert.rejects(repo.updateShoppingItem(id, { name: 'Gone' }));
    await assert.rejects(repo.toggleShoppingItemCompleted(id));
  } finally {
    db.connection?.close();
  }
});

test('clear purchased preserves to-buy items and recipe source is ready', async () => {
  const db = setup();
  const repo = db.repository;
  try {
    const purchased = await repo.createShoppingItem({ name: 'Tomatoes', quantity: 4, unit: 'pcs', source: 'recipe' });
    const pending = await repo.createShoppingItem({ name: 'Eggs', quantity: 12, unit: 'pcs' });
    await repo.toggleShoppingItemCompleted(purchased);
    assert.equal((await repo.getShoppingItems()).find((item) => item.id === purchased).source, 'recipe');
    assert.equal(await repo.clearCompletedShoppingItems(), 1);
    assert.deepEqual((await repo.getShoppingItems()).map((item) => item.id), [pending]);
    assert.equal(await repo.clearCompletedShoppingItems(), 0);
  } finally {
    db.connection?.close();
  }
});

test('shopping input validates required name and quantity and binds user text', async () => {
  const db = setup();
  const repo = db.repository;
  try {
    assert.deepEqual(await repo.getShoppingItems(), []);
    await assert.rejects(repo.createShoppingItem({ name: '  ' }));
    await assert.rejects(repo.createShoppingItem({ name: 'Milk', quantity: -1 }));
    await assert.rejects(repo.createShoppingItem({ name: 'Milk', quantity: Number.NaN }));
    const text = "Milk'); DROP TABLE shopping_list; --";
    await repo.createShoppingItem({ name: text });
    assert.equal((await repo.getShoppingItems())[0].name, text);
    assert.equal(db.connection.prepare('SELECT count(*) AS count FROM shopping_list').get().count, 1);
  } finally {
    db.connection?.close();
  }
});

test('shopping items persist when reopening the existing database file', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpantry-shopping-'));
  const filename = path.join(folder, 'smartpantry.db');
  let first;
  let second;
  try {
    first = setup(filename);
    const id = await first.repository.createShoppingItem({ name: 'Bread' });
    first.connection.close();
    first = null;
    second = setup(filename);
    assert.equal((await second.repository.getShoppingItems())[0].id, id);
    assert.equal((await second.repository.getShoppingItems())[0].name, 'Bread');
  } finally {
    first?.connection?.close();
    second?.connection?.close();
    for (const file of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, file));
    fs.rmdirSync(folder);
  }
});
