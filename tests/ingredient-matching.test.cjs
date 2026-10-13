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

const matching = loadModules()(path.join(root, 'utils/ingredient-matching.ts'));
const product = (name, quantity = 1, expirationDate = '2999-01-01') => ({ name, quantity, expirationDate });
const ingredient = (name) => ({ name, measure: null });
const recipe = (id, names) => ({
  id, name: `Recipe ${id}`, imageUrl: null, emoji: '🍽️', category: 'Other', tags: [],
  area: null, description: null, instructions: 'Cook.', prepTime: null, difficulty: null,
  ingredients: names.map(ingredient),
});

test('normalizes simple singulars and matches common pantry pairs', () => {
  assert.equal(matching.normalizeIngredientName('  Tomatoes! '), 'tomato');
  assert.equal(matching.normalizeIngredientName('Eggs'), 'egg');
  assert.equal(matching.getIngredientDiscoveryTerm('Chicken Breast'), 'chicken');
  for (const [pantry, recipeIngredient] of [
    ['Milk', 'milk'], ['Tomatoes', 'tomato'], ['Eggs', 'egg'],
    ['Chicken Breast', 'chicken'], ['Pasta', 'pasta'],
  ]) assert.equal(matching.doesPantryProductMatchIngredient(product(pantry), ingredient(recipeIngredient)), true);
});

test('avoids processed-food and cut false positives and excludes unusable stock', () => {
  assert.equal(matching.doesPantryProductMatchIngredient(product('Tomato Sauce'), ingredient('tomato')), false);
  assert.equal(matching.doesPantryProductMatchIngredient(product('Chicken Stock'), ingredient('chicken')), false);
  assert.equal(matching.doesPantryProductMatchIngredient(product('Chicken Thigh'), ingredient('chicken breast')), false);
  assert.equal(matching.doesPantryProductMatchIngredient(product('Milk', 0), ingredient('milk')), false);
  assert.equal(matching.doesPantryProductMatchIngredient(product('Milk', 1, '2000-01-01'), ingredient('milk')), false);
});

test('calculates complete, partial, zero and empty-pantry matches', () => {
  const meal = recipe('1', ['Milk', 'Egg', 'Tomato']);
  const full = matching.calculateRecipeMatch(meal, [product('Milk'), product('Eggs'), product('Tomatoes')]);
  assert.equal(full.availableCount, 3);
  assert.equal(full.totalCount, 3);
  assert.equal(full.matchPercentage, 100);
  assert.equal(full.missingIngredients.length, 0);
  const partial = matching.calculateRecipeMatch(meal, [product('Milk')]);
  assert.equal(partial.availableCount, 1);
  assert.equal(partial.missingIngredients.length, 2);
  assert.equal(partial.matchPercentage, 33);
  assert.equal(matching.calculateRecipeMatch(meal, [product('Pasta')]).matchPercentage, 0);
  assert.equal(matching.calculateRecipeMatch(meal, []).availableCount, 0);
  assert.equal(matching.calculateRecipeMatch(recipe('empty', []), []).matchPercentage, 0);
  assert.deepEqual(matching.sortRecipeMatches([partial, full]).map((match) => match.recipe.id), ['1', '1']);
});

test('sorts full matches, then percentage, then fewer missing ingredients', () => {
  const pantry = [product('Milk'), product('Eggs')];
  const full = matching.calculateRecipeMatch(recipe('full', ['Milk', 'Egg']), pantry);
  const halfOneMissing = matching.calculateRecipeMatch(recipe('half-one', ['Milk', 'Flour']), pantry);
  const halfTwoMissing = matching.calculateRecipeMatch(recipe('half-two', ['Milk', 'Egg', 'Flour', 'Sugar']), pantry);
  const zero = matching.calculateRecipeMatch(recipe('zero', ['Flour']), pantry);
  assert.deepEqual(matching.sortRecipeMatches([zero, halfTwoMissing, full, halfOneMissing]).map((match) => match.recipe.id), ['full', 'half-one', 'half-two', 'zero']);
});

test('pantry discovery caps requests, deduplicates IDs, caches details and rescales on refresh', async () => {
  let pantry = [product('Chicken Breast'), product('Tomatoes'), product('Pasta'), product('Milk'), product('Eggs')];
  const terms = [];
  const lookups = [];
  const previews = (term) => Array.from({ length: 8 }, (_, index) => ({ id: index === 0 ? 'shared' : `${term}-${index}`, name: 'Preview' }));
  const load = loadModules({
    '@/db/products': { getProducts: async () => pantry },
    '@/data/recipes': {
      getRecipesByIngredient: async (term) => { terms.push(term); return previews(term); },
      getRecipeById: async (id) => { lookups.push(id); return recipe(id, id === 'shared' ? ['Chicken', 'Tomato', 'Egg'] : [id.split('-')[0], 'Egg']); },
    },
  });
  const discovery = load(path.join(root, 'data/pantry-recipes.ts'));
  const first = await discovery.getPantryRecipeMatches();
  assert.equal(first.totalProducts, 5);
  assert.deepEqual(terms, ['chicken', 'tomato', 'pasta', 'milk']);
  assert.ok(lookups.length <= 12);
  assert.equal(new Set(lookups).size, lookups.length);
  assert.ok(first.matches.every((match) => match.availableCount > 0));
  assert.equal(first.matches.find((match) => match.recipe.id === 'shared').matchPercentage, 100);
  const firstLookups = lookups.length;
  await discovery.getPantryRecipeMatches();
  assert.equal(terms.length, 4);
  assert.equal(lookups.length, firstLookups);
  pantry = [product('Chicken Breast'), product('Tomatoes')];
  const second = await discovery.getPantryRecipeMatches();
  assert.equal(second.totalProducts, 2);
  assert.equal(terms.length, 4);
  assert.ok(lookups.length - firstLookups <= 12);
  assert.equal(new Set(lookups).size, lookups.length);
  assert.equal(second.matches.find((match) => match.recipe.id === 'shared').availableCount, 2);
  pantry = [];
  const empty = await discovery.getPantryRecipeMatches();
  assert.equal(empty.totalProducts, 0);
  assert.deepEqual(empty.matches, []);
  assert.equal(terms.length, 4);
});
