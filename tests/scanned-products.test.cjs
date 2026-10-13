const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../src');

function modules(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireLocal = (name) => {
      if (name in overrides) return overrides[name];
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(requireLocal, module, module.exports);
    return module.exports;
  }
  return (file) => load(path.join(root, file));
}

const load = modules({ 'expo-constants': { default: { expoConfig: { version: '1.0.0' } } }, 'react-native': { Platform: { OS: 'ios' } } });
const utils = load('utils/scanned-product.ts');
const api = load('api/open-food-facts.ts');
const code = '3017624010701';

test('mapper isolates API fields, defaults missing data, and leaves expiration unset', () => {
  const product = api.mapOpenFoodFactsProduct({ product_name: ' Milk ', brands: ' Brand ', quantity: '1 L', categories_tags: ['en:dairy'], image_front_url: 'https://images.openfoodfacts.org/milk.jpg', nutrition_grades: 'b' }, code);
  assert.deepEqual(product, { barcode: code, name: 'Milk', brand: 'Brand', category: 'Dairy', quantity: 1, unit: 'L', imageUrl: 'https://images.openfoodfacts.org/milk.jpg', packageQuantity: '1 L', nutritionGrade: 'B' });
  const values = utils.scannedProductFormValues(product);
  assert.equal(values.barcode, code);
  assert.equal(values.expirationDate, undefined);
  assert.equal(api.mapOpenFoodFactsProduct({ product_name_en: 'Fallback', image_url: 'javascript:bad' }, code).imageUrl, null);
  assert.equal(api.mapOpenFoodFactsProduct({ product_name_en: 'Fallback' }, code).name, 'Fallback');
  assert.equal(api.mapOpenFoodFactsProduct({}, code).category, 'Other');
});

test('category mapping uses obvious categories and handles substitutes conservatively', () => {
  for (const [tag, expected] of [['en:milks', 'Dairy'], ['en:cheeses', 'Dairy'], ['en:meats', 'Meat & Fish'], ['en:fish', 'Meat & Fish'], ['en:beverages', 'Drinks'], ['en:breads', 'Bakery'], ['en:fruits', 'Fruits'], ['en:vegetables', 'Vegetables'], ['en:pastas', 'Pantry'], ['en:rice', 'Pantry'], ['en:frozen-foods', 'Frozen'], ['en:milk-chocolates', 'Other'], ['en:unknown', 'Other']]) {
    assert.equal(utils.mapFoodCategory([tag]), expected, tag);
  }
  assert.equal(utils.mapFoodCategory(['en:plant-based-foods', 'en:milks']), 'Other');
});

test('simple quantities parse safely; multipacks and descriptive quantities stay display-only', () => {
  for (const [input, quantity, unit] of [['500 g', 500, 'g'], ['1 L', 1, 'L'], ['250 ml', 250, 'ml'], ['2 kg', 2, 'kg'], ['0,5 l', 0.5, 'L']]) {
    assert.deepEqual(utils.parsePackageQuantity(input), { quantity, unit });
  }
  for (const input of ['6 x 330 ml', '1 large', '500', '0 g', '1e3 g', null]) {
    assert.deepEqual(utils.parsePackageQuantity(input), { quantity: null, unit: null });
  }
});

test('not found is distinct from invalid payloads and optional fields can be absent', () => {
  assert.equal(api.parseOpenFoodFactsResponse({ status: 0 }, code), null);
  assert.equal(api.parseOpenFoodFactsResponse({ status: 1, product: {} }, code).name, '');
  for (const payload of [null, [], {}, { status: 1 }, { status: 1, product: [] }, { status: 2 }, { status: '1', product: {} }]) {
    assert.throws(() => api.parseOpenFoodFactsResponse(payload, code));
  }
});

test('barcode validation preserves leading zeros and detects UPC-A/EAN-13 duplicates', () => {
  for (const value of ['12345678', '012345678905', code, '12345678901234']) assert.equal(utils.isValidBarcode(value), true);
  for (const value of ['', 'abc', '1234567', '123456789', '123456789012345']) assert.equal(utils.isValidBarcode(value), false);
  const products = [{ id: 1, barcode: null }, { id: 2, barcode: '012345678905' }];
  assert.equal(utils.findBarcodeProduct(products, '0012345678905').id, 2);
  assert.equal(utils.findBarcodeProduct(products, code), null);
});

test('lookup limits fields, sets native client identity, caches results, and handles failures', async (context) => {
  const fresh = modules({ 'expo-constants': { default: { expoConfig: { version: '1.0.0' } } }, 'react-native': { Platform: { OS: 'android' } } })('api/open-food-facts.ts');
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++;
    assert.match(url, /api\/v2\/product\/3017624010701.json\?fields=/);
    assert.doesNotMatch(url, /nutriments/);
    assert.match(options.headers['User-Agent'], /SmartPantry\/1.0.0/);
    return { ok: true, json: async () => ({ status: 1, product: { product_name: 'Milk' } }) };
  });
  assert.equal((await fresh.lookupBarcode(code)).name, 'Milk');
  await fresh.lookupBarcode(code);
  assert.equal(requests, 1);
  await assert.rejects(fresh.lookupBarcode('invalid'));
  context.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 404, json: async () => ({ status: 0 }) }));
  assert.equal(await fresh.lookupBarcode('12345678'), null);
  context.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(fresh.lookupBarcode('123456789012'));
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(fresh.lookupBarcode('123456789013'));
});

test('web uses the same API without attempting a browser-controlled User-Agent', async (context) => {
  const web = modules({ 'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } } })('api/open-food-facts.ts');
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers['User-Agent'], undefined);
    return { ok: true, json: async () => ({ status: 0 }) };
  });
  assert.equal(await web.lookupBarcode(code), null);
});

test('lookup timeout and caller cancellation abort the network request', async (context) => {
  const client = modules({ 'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } } })('api/open-food-facts.ts');
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const timed = assert.rejects(client.lookupBarcode(code), /aborted/);
  context.mock.timers.tick(12_000);
  await timed;
  const controller = new AbortController();
  const cancelled = assert.rejects(client.lookupBarcode(code, controller.signal), /aborted/);
  controller.abort();
  await cancelled;
});

test('all scanner UI keys have translations in all five languages', () => {
  const translations = modules()('i18n/scanner.ts').scannerTranslations;
  const keys = Object.keys(translations.en).sort();
  for (const language of ['sk', 'ru', 'uk', 'hu']) assert.deepEqual(Object.keys(translations[language]).sort(), keys);
});

test('search mapper reuses product mapping, handles brand arrays, ranks and skips unusable hits', () => {
  const results = api.mapOpenFoodFactsSearchResponse({ products: [
    null, [], 'invalid', { code: '12345678' },
    { code: '12345678', product_name: 'Fanta Mango', brands: ['Fanta'], quantity: '500 ml', categories_tags: ['en:plant-based-foods-and-beverages', 'en:beverages'], image_front_url: 'https://images.openfoodfacts.org/fanta.jpg' },
    { code: '12345678', product_name: 'Duplicate' },
    { product_name_en: 'Mango drink', brands: ['Fanta', null, 'Company'], image_url: 'https://images.openfoodfacts.org/drink.jpg' },
    { product_name: 'Fanta Mango', brands: 'Fanta' },
  ] }, 'Fanta Mango');
  assert.equal(results.length, 3);
  assert.equal(results[0].name, 'Fanta Mango');
  assert.equal(results[0].category, 'Drinks');
  assert.equal(results[0].quantity, 500);
  assert.equal(results[0].unit, 'ml');
  assert.equal(results[2].brand, 'Fanta, Company');
  assert.equal(results[2].barcode, null);
  assert.equal(results[2].imageUrl, 'https://images.openfoodfacts.org/drink.jpg');
  assert.deepEqual(api.mapOpenFoodFactsSearchResponse({ products: [] }, 'Nothing'), []);
  for (const payload of [null, {}, { products: null }, { products: {} }, { products: [], timed_out: true }]) assert.throws(() => api.mapOpenFoodFactsSearchResponse(payload, 'Milk'));
});

test('fallback selection preserves original barcode through review, form values and duplicate detection', () => {
  const candidate = { ...api.mapOpenFoodFactsProduct({ product_name: 'Fanta Mango', quantity: '1 L' }, '12345678') };
  const selected = utils.selectFallbackProduct(candidate, code);
  assert.equal(selected.barcode, code);
  assert.equal(candidate.barcode, '12345678');
  assert.equal(utils.scannedProductFormValues(selected).barcode, code);
  assert.equal(utils.scannedProductFormValues(selected).expirationDate, undefined);
  assert.equal(utils.findBarcodeProduct([{ id: 4, barcode: code }], selected.barcode).id, 4);
  const handoff = load('data/scanned-product-review.ts');
  const key = handoff.rememberProductSelection(candidate, code);
  assert.equal(handoff.getProductSelection(key, code).barcode, code);
  assert.throws(() => handoff.getProductSelection(key, '87654321'));
  assert.throws(() => handoff.getProductSelection('lost-session', code));
  assert.throws(() => utils.selectFallbackProduct(candidate, 'invalid'));
});

test('name search uses bounded full-text requests and caches mapped results', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const search = modules({ 'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } } })('api/open-food-facts.ts');
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.match(url, /world.openfoodfacts.org\/cgi\/search.pl/);
    assert.match(url, /search_terms=Fanta%20Mango/);
    assert.match(url, /page_size=20/);
    assert.match(url, /image_front_url/);
    assert.equal(options.headers['User-Agent'], undefined);
    return { ok: true, json: async () => ({ products: [{ product_name: 'Fanta Mango', brands: ['Fanta'] }] }) };
  });
  assert.deepEqual(await search.searchProducts('ab'), []);
  assert.equal((await search.searchProducts('Fanta Mango'))[0].name, 'Fanta Mango');
  await search.searchProducts('  Fanta   Mango ');
  assert.equal(calls, 1);
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  context.mock.timers.tick(6500);
  await assert.rejects(search.searchProducts('Tiger BubbleGum'));
  context.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  context.mock.timers.tick(6500);
  await assert.rejects(search.searchProducts('Monster Mango'));
  context.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ products: null }) }));
  context.mock.timers.tick(6500);
  await assert.rejects(search.searchProducts('Coca Cola Zero'));
});

test('search rate limit delays new requests and cancellation removes stale queued searches', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const search = modules({ 'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } } })('api/open-food-facts.ts');
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, json: async () => ({ products: [] }) }; });
  await search.searchProducts('First');
  const controller = new AbortController();
  const cancelled = assert.rejects(search.searchProducts('Second', controller.signal), /cancelled/);
  controller.abort();
  await cancelled;
  assert.equal(calls, 1);
  const queued = search.searchProducts('Third');
  context.mock.timers.tick(6499);
  await Promise.resolve();
  assert.equal(calls, 1);
  context.mock.timers.tick(1);
  await queued;
  assert.equal(calls, 2);
});

test('scanned products save as normal SQLite products, preserve barcode/image, and permit duplicates', async () => {
  const connection = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql) => connection.exec(sql),
    getAllAsync: async (sql, ...params) => connection.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => connection.prepare(sql).get(...params) ?? null,
    runAsync: async (sql, ...params) => {
      const result = connection.prepare(sql).run(...(Array.isArray(params[0]) ? params[0] : params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
  };
  const products = modules({ 'expo-sqlite': { openDatabaseAsync: async () => db } })('db/products.ts');
  try {
    const scanned = api.mapOpenFoodFactsProduct({ product_name: 'Milk', quantity: '1 L', categories_tags: ['en:dairy'], image_front_url: 'https://images.openfoodfacts.org/milk.jpg' }, code);
    const input = { brand: null, storageLocation: null, notes: null, ...utils.scannedProductFormValues(scanned), expirationDate: '2030-01-01' };
    const id = await products.createProduct(input);
    await products.createProduct(input);
    const saved = await products.getProductById(id);
    assert.equal(saved.barcode, code);
    assert.equal(saved.imageUrl, scanned.imageUrl);
    assert.equal(saved.quantity, 1);
    assert.equal((await products.getProducts()).length, 2);
  } finally { connection.close(); }
});
