const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');
global.__DEV__ = false;

function setup(permission = true, existingDatabase) {
  const connection = existingDatabase ?? new DatabaseSync(':memory:');
  const scheduled = new Map();
  const canceled = [];
  let nextId = 0;
  let allowed = permission;
  const notifications = {
    AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler() {}, async setNotificationChannelAsync() {},
    async getPermissionsAsync() { return { granted: allowed, status: allowed ? 'granted' : 'denied' }; },
    async requestPermissionsAsync() { return { granted: allowed, status: allowed ? 'granted' : 'denied' }; },
    async scheduleNotificationAsync(request) { const id = `reminder-${++nextId}`; scheduled.set(id, request); return id; },
    async cancelScheduledNotificationAsync(id) { canceled.push(id); scheduled.delete(id); },
    async getAllScheduledNotificationsAsync() { return [...scheduled].map(([identifier, request]) => ({ identifier, content: request.content })); },
  };
  const db = {
    async execAsync(sql) { connection.exec(sql); }, async closeAsync() {},
    async getAllAsync(sql, ...params) { return connection.prepare(sql).all(...params); },
    async getFirstAsync(sql, ...params) { return connection.prepare(sql).get(...params) ?? null; },
    async runAsync(sql, ...params) {
      const result = connection.prepare(sql).run(...(Array.isArray(params[0]) ? params[0] : params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async withExclusiveTransactionAsync(callback) {
      connection.exec('BEGIN');
      try { await callback(db); connection.exec('COMMIT'); }
      catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
    async withTransactionAsync(callback) { return db.withExclusiveTransactionAsync(callback); },
  };
  const cache = new Map();
  const i18n = require('i18next').createInstance();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (name) => {
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => db };
      if (name === 'expo-notifications') return notifications;
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === '@/i18n') {
        if (!i18n.isInitialized) {
          const locales = load(path.join(root, 'i18n/polish.ts')).polishTranslations;
          i18n.init({ lng: 'en', fallbackLng: 'en', keySeparator: false, initAsync: false, resources: Object.fromEntries(Object.entries(locales).map(([key, translation]) => [key, { translation: { ...translation, 'more.expirationReminders': 'Expiration reminders' } }])) });
        }
        return { i18n };
      }
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { connection, scheduled, canceled, notifications, i18n, load: (filename) => load(path.join(root, filename)), setPermission: (value) => { allowed = value; } };
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const input = { name: 'Milk', brand: null, barcode: null, category: 'Dairy', quantity: 1,
  unit: 'L', expirationDate: futureDate(7), storageLocation: 'Refrigerator', imageUrl: null, notes: null };

test('expiration notifications use the selected language without changing product names or duplicating reminders', async () => {
  const app = setup();
  try {
    app.load('db/local-state.ts').setLocalUserId('a');
    const products = app.load('db/products.ts');
    const reminders = app.load('services/notifications.ts');
    const id = await products.createProduct(input);
    const bodies = new Set();
    for (const language of ['en', 'sk', 'ru', 'uk', 'hu']) {
      await app.i18n.changeLanguage(language);
      await reminders.syncProductReminder(id);
      assert.equal(app.scheduled.size, 1);
      const content = [...app.scheduled.values()][0].content;
      assert.equal(content.title, app.i18n.t('notifications.title', { name: 'Milk' }));
      assert.equal(content.body, app.i18n.t('notifications.tomorrow', { name: 'Milk', count: 1 }));
      assert.ok(content.body.includes('Milk'));
      bodies.add(content.body);
    }
    assert.equal(bodies.size, 5);
  } finally { app.connection.close(); }
});

test('account deletion cancels only the deleted owner reminders including unmapped scheduled notifications', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const products = app.load('db/products.ts');
    const reminders = app.load('services/notifications.ts');
    state.setLocalUserId('a'); const a = await products.createProduct(input); await reminders.syncProductReminder(a);
    state.setLocalUserId('b'); const b = await products.createProduct(input); await reminders.syncProductReminder(b);
    const aId = app.connection.prepare("SELECT notification_id FROM products WHERE user_id='a'").get().notification_id;
    const bId = app.connection.prepare("SELECT notification_id FROM products WHERE user_id='b'").get().notification_id;
    app.scheduled.set('orphan-a', { content: { data: { kind: 'smartpantry-expiration', userId: 'a' } } });
    await app.load('services/account-lock.ts').blockAccount('a');
    await reminders.cancelDeletedAccountReminders('a');
    assert.ok(app.canceled.includes(aId)); assert.ok(app.canceled.includes('orphan-a'));
    assert.ok(!app.canceled.includes(bId)); assert.ok(app.scheduled.has(bId));
  } finally { app.connection.close(); }
});

test('reminder date and copy handle timing and past dates', () => {
  const reminders = setup().load('utils/expiration-reminder.ts');
  const now = new Date(2026, 9, 13, 8, 0);
  assert.equal(reminders.getReminderDate('2026-10-14', 1, now).getDate(), 13);
  assert.equal(reminders.getReminderDate('2026-10-13', 0, now).getHours(), 9);
  assert.equal(reminders.getReminderDate('2026-10-13', 3, now), null);
  assert.equal(reminders.getReminderBody('Milk', 0), 'Milk expires today.');
  assert.equal(reminders.getReminderBody('Milk', 1), 'Milk expires tomorrow.');
  assert.equal(reminders.getReminderBody('Milk', 3), 'Milk expires in 3 days.');
});

test('existing products migrate without data loss and settings persist', async () => {
  const connection = new DatabaseSync(':memory:');
  connection.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, brand TEXT, barcode TEXT, category TEXT,
    quantity REAL, unit TEXT, expiration_date TEXT, storage_location TEXT, image_url TEXT, notes TEXT, created_at TEXT);
    INSERT INTO products (id, name, category, expiration_date, created_at) VALUES (7, 'Old Milk', 'Dairy', '2026-10-20', '2026-10-01');`);
  const app = setup(true, connection);
  const products = app.load('db/products.ts');
  const settings = app.load('db/notification-settings.ts');
  assert.equal((await products.getProductById('7')).name, 'Old Milk');
  assert.equal((await products.getProductById('7')).notificationId, null);
  assert.deepEqual(await settings.getNotificationSettings(), { notificationsEnabled: true, defaultReminderDays: 1 });
  await settings.saveNotificationSettings({ notificationsEnabled: false, defaultReminderDays: 3 });
  assert.deepEqual(await settings.getNotificationSettings(), { notificationsEnabled: false, defaultReminderDays: 3 });
  assert.equal(connection.prepare('SELECT COUNT(*) AS count FROM products').get().count, 1);
  connection.close();
});

test('create, edit, delete, consume, waste and global preferences sync reminders', async () => {
  const app = setup();
  const products = app.load('db/products.ts');
  const lifecycle = app.load('services/product-lifecycle.ts');
  const reminders = app.load('services/notifications.ts');
  const settings = app.load('db/notification-settings.ts');
  const id = await lifecycle.addProduct(input);
  assert.equal(app.scheduled.size, 1);
  const firstId = (await products.getProductById(id)).notificationId;
  assert.ok(firstId);
  await lifecycle.editProduct(id, { ...input, expirationDate: futureDate(9) });
  assert.ok(app.canceled.includes(firstId));
  assert.equal(app.scheduled.size, 1);
  await reminders.setNotificationsEnabled(false);
  assert.equal(app.scheduled.size, 0);
  assert.equal((await products.getProductById(id)).notificationId, null);
  assert.equal((await settings.getNotificationSettings()).notificationsEnabled, false);
  await reminders.setNotificationsEnabled(true);
  assert.equal(app.scheduled.size, 1);
  await reminders.setDefaultReminderDays(2);
  assert.equal(app.scheduled.size, 1);
  assert.equal((await settings.getNotificationSettings()).defaultReminderDays, 2);
  assert.equal([...app.scheduled.values()][0].trigger.date.getHours(), 9);
  await lifecycle.removeProduct(id);
  assert.equal(app.scheduled.size, 0);
  assert.equal(await products.getProductById(id), null);
  const consumed = await lifecycle.addProduct(input);
  await lifecycle.finishProduct(consumed, 'consumed');
  assert.equal(app.scheduled.size, 0);
  const wasted = await lifecycle.addProduct(input);
  await lifecycle.finishProduct(wasted, 'wasted');
  assert.equal(app.scheduled.size, 0);
  assert.deepEqual(app.connection.prepare('SELECT action FROM product_history ORDER BY action_date, id').all().map((row) => row.action), ['consumed', 'wasted']);
  app.connection.close();
});

test('denied permission and past reminder do not schedule; enable reports denial', async () => {
  const app = setup(false);
  const lifecycle = app.load('services/product-lifecycle.ts');
  const reminders = app.load('services/notifications.ts');
  await lifecycle.addProduct(input);
  assert.equal(app.scheduled.size, 0);
  await assert.rejects(reminders.setNotificationsEnabled(true), /permission/);
  app.setPermission(true);
  await lifecycle.addProduct({ ...input, expirationDate: futureDate(-1) });
  assert.equal(app.scheduled.size, 0);
  app.connection.close();
});

test('clear operations preserve other data and clear all cancels reminders', async () => {
  const app = setup();
  const lifecycle = app.load('services/product-lifecycle.ts');
  const manage = app.load('db/manage-data.ts');
  const service = app.load('services/manage-data.ts');
  const shopping = app.load('db/shopping-list.ts');
  await lifecycle.addProduct(input);
  await shopping.createShoppingItem({ name: 'Bread', quantity: null, unit: null, category: null });
  await manage.clearShoppingList();
  assert.equal((await shopping.getShoppingItems()).length, 0);
  assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM products').get().count, 1);
  const processed = await lifecycle.addProduct(input);
  await lifecycle.finishProduct(processed, 'consumed');
  assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM product_history').get().count, 1);
  await manage.clearProductHistory();
  assert.equal(app.connection.prepare('SELECT COUNT(*) AS count FROM product_history WHERE deleted_at IS NULL').get().count, 0);
  await shopping.createShoppingItem({ name: 'Eggs', quantity: null, unit: null, category: null });
  await service.clearAllDataAndReminders();
  for (const table of ['products', 'shopping_list', 'product_history']) {
    assert.equal(app.connection.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at IS NULL`).get().count, 0);
    assert.ok(app.connection.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at IS NOT NULL`).get().count > 0);
  }
  assert.equal(app.scheduled.size, 0);
  app.connection.close();
});

test('remote product create/update/delete reconciles one reminder and repeated pulls do not duplicate it', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); state.setLocalUserId('a');
    const products = app.load('db/products.ts'); const local = app.load('sync/local-store.ts').localSyncStore;
    const mapper = app.load('sync/sync-mappers.ts'); const reminders = app.load('services/notifications.ts');
    const id = await products.createProduct(input); const [row] = await local.read('products', 'a'); await products.deleteProduct(id);
    let remote = { ...mapper.localToCloud('products', row), id: 'remote', updated_at: state.localTimestamp() };
    await local.apply('products', 'a', remote); await reminders.reconcileAccountReminders(); await reminders.restoreProductReminders();
    assert.equal(app.scheduled.size, 1); const first = (await products.getProductById('remote')).notificationId;
    await local.apply('products', 'a', remote); await reminders.reconcileAccountReminders(); await reminders.restoreProductReminders();
    assert.equal(app.scheduled.size, 1); assert.equal((await products.getProductById('remote')).notificationId, first);
    remote = { ...remote, expiration_date: futureDate(12), updated_at: state.localTimestamp() };
    await local.apply('products', 'a', remote); await reminders.restoreProductReminders();
    assert.equal(app.scheduled.size, 1); assert.ok(app.canceled.includes(first));
    const now = state.localTimestamp(); remote = { ...remote, updated_at: now, deleted_at: now };
    await local.apply('products', 'a', remote); await reminders.reconcileAccountReminders();
    assert.equal(app.scheduled.size, 0); assert.equal(await products.getProductById('remote'), null);
  } finally { app.connection.close(); }
});

test('account switches cancel the previous account reminders and restore only the active cache', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const lifecycle = app.load('services/product-lifecycle.ts');
    const reminders = app.load('services/notifications.ts'); const products = app.load('db/products.ts');
    state.setLocalUserId('a'); const a = await lifecycle.addProduct({ ...input, name: 'A Milk' }); assert.equal(app.scheduled.size, 1);
    state.setLocalUserId('b'); await reminders.reconcileAccountReminders(); assert.equal(app.scheduled.size, 0);
    const b = await lifecycle.addProduct({ ...input, name: 'B Milk' }); assert.equal(app.scheduled.size, 1);
    state.setLocalUserId('a'); await reminders.reconcileAccountReminders(); await reminders.restoreProductReminders();
    assert.equal(app.scheduled.size, 1); assert.ok((await products.getProductById(a)).notificationId); assert.equal(await products.getProductById(b), null);
    assert.equal([...app.scheduled.values()][0].content.data.userId, 'a');
    state.setLocalUserId(null); await reminders.reconcileAccountReminders(); assert.equal(app.scheduled.size, 0);
  } finally { app.connection.close(); }
});

test('switching accounts during a delete cannot delete another account row with the same ID', async () => {
  const app = setup();
  try {
    const state = app.load('db/local-state.ts'); const products = app.load('db/products.ts');
    const reminders = app.load('services/notifications.ts'); const lifecycle = app.load('services/product-lifecycle.ts');
    state.setLocalUserId('a'); await app.load('db/database.ts').initializeDatabase();
    const now = new Date().toISOString();
    for (const owner of ['a', 'b']) app.connection.prepare('INSERT INTO products (id,user_id,name,category,expiration_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('shared', owner, `${owner} Milk`, 'Dairy', futureDate(7), now, now);
    await reminders.syncProductReminder('shared'); const cancel = app.notifications.cancelScheduledNotificationAsync;
    app.notifications.cancelScheduledNotificationAsync = async (id) => { await cancel(id); state.setLocalUserId('b'); };
    await assert.rejects(lifecycle.removeProduct('shared'), /account changed/);
    assert.equal((await products.getProductById('shared')).name, 'b Milk');
    state.setLocalUserId('a'); assert.equal((await products.getProductById('shared')).name, 'a Milk');
  } finally { app.connection.close(); }
});
