const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');

function loadModules(overrides = {}) {
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
      if (name in overrides) return overrides[name];
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

const load = loadModules();
const shopping = load(path.join(root, 'utils/recipe-shopping.ts'));
const ingredient = (name, measure = null) => ({ name, measure });
const item = (name, completed = false) => ({ name, completed });
const product = (name) => ({ name, quantity: 1, expirationDate: '2999-01-01' });
const recipe = (names) => ({ ingredients: names.map(([name, measure]) => ingredient(name, measure)) });

test('simple measures become quantity and unit; complex measures remain visible text', () => {
  for (const [measure, quantity, unit] of [
    ['200 g', 200, 'g'], ['2 kg', 2, 'kg'], ['1 L', 1, 'L'], ['1', 1, null],
    ['1 cup', 1, 'cup'], ['2 tbsp', 2, 'tbsp'], ['0.5 ml', 0.5, 'ml'],
    ['½ tsp', null, '½ tsp'], ['to taste', null, 'to taste'], ['1 large', null, '1 large'],
    [null, null, null],
  ]) {
    assert.deepEqual(shopping.recipeIngredientToShoppingItem(ingredient('Flour', measure)), {
      name: 'Flour', quantity, unit, source: 'recipe',
    });
  }
});

test('active normalized duplicates are skipped, completed items permit new entries', () => {
  const missing = [ingredient('Tomato', '2 pcs'), ingredient('Egg', '3 pcs'), ingredient('Chicken', '200 g'), ingredient('Pasta', '500 g')];
  const existing = [item('Tomatoes'), item('Eggs', true), item('Chicken Breast')];
  const selected = shopping.selectMissingShoppingItems(missing, existing);
  assert.deepEqual(selected.items.map((entry) => entry.name), ['Egg', 'Pasta']);
  assert.equal(selected.skipped, 2);
  assert.deepEqual(shopping.selectMissingShoppingItems([ingredient('Milk'), ingredient('milk')], []).items.map((entry) => entry.name), ['Milk']);
  assert.equal(shopping.selectMissingShoppingItems([ingredient('Milk'), ingredient('milk')], []).skipped, 1);
  assert.equal(shopping.selectMissingShoppingItems([], []).items.length, 0);
});

test('service uses current RecipeMatch and inserts only missing, nonduplicate items', async () => {
  let pantry = [product('Milk')];
  const listed = [item('Tomatoes'), item('Eggs', true)];
  const inserted = [];
  let listReads = 0;
  const service = loadModules({
    '@/db/products': { getProducts: async () => pantry },
    '@/db/shopping-list': {
      getShoppingItems: async () => { listReads++; return listed; },
      createShoppingItem: async (entry) => { inserted.push(entry); listed.push(item(entry.name)); return inserted.length; },
    },
  })(path.join(root, 'data/recipe-shopping.ts'));
  const meal = recipe([['Milk', '1 L'], ['Tomato', '2 pcs'], ['Egg', '3 pcs'], ['Rice', '200 g']]);
  assert.deepEqual(await service.addMissingRecipeIngredients(meal), { added: 2, skipped: 1, missing: 3 });
  assert.deepEqual(inserted.map((entry) => [entry.name, entry.quantity, entry.unit, entry.source]), [
    ['Egg', 3, 'pcs', 'recipe'], ['Rice', 200, 'g', 'recipe'],
  ]);
  assert.deepEqual(await service.addMissingRecipeIngredients(meal), { added: 0, skipped: 3, missing: 3 });
  pantry = [product('Milk'), product('Tomatoes'), product('Eggs'), product('Rice')];
  assert.deepEqual(await service.addMissingRecipeIngredients(meal), { added: 0, skipped: 0, missing: 0 });
  assert.equal(listReads, 2);
});
