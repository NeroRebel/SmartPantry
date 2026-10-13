const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../src');
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
    const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
    return load(`${target}.ts`);
  };
  vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

const { mockRecipes, mockAvailableIngredients } = load(path.join(root, 'data/mock-recipes.ts'));
const { getRecipes, getRecipeById, getRecipeCategories, mapMealDbMealToRecipe } = load(path.join(root, 'api/recipes.ts'));
const { filterRecipes, recipeCategories } = load(path.join(root, 'utils/recipe-filters.ts'));

const fullMeal = {
  idMeal: '123', strMeal: 'Tomato Pasta', strCategory: 'Pasta', strArea: 'Italian',
  strInstructions: 'Cook pasta.\r\nServe warm.', strMealThumb: null, strTags: 'Quick, Family',
  strIngredient1: ' Tomatoes ', strMeasure1: ' 2 pcs ', strIngredient2: ' ', strMeasure2: '1 tsp',
  strIngredient3: 'Pasta', strMeasure3: '200 g',
};

async function withFetch(handler, run) {
  const original = global.fetch;
  global.fetch = async (url) => ({ ok: true, json: async () => handler(new URL(url)) });
  try { await run(); } finally { global.fetch = original; }
}

test('mock catalog is complete and uses stable internal fields', () => {
  assert.equal(mockRecipes.length, 10);
  assert.equal(new Set(mockRecipes.map((recipe) => recipe.id)).size, mockRecipes.length);
  for (const recipe of mockRecipes) {
    assert.ok(recipe.name && recipe.category && recipe.ingredients.length && recipe.instructions);
    assert.ok(recipe.prepTime > 0);
    assert.ok(recipe.ingredients.every((ingredient) => ingredient.name && ingredient.measure));
    assert.ok(recipe.instructions.split('\n').length >= 2);
    assert.ok((mockAvailableIngredients[recipe.id] ?? []).every((name) => recipe.ingredients.some((ingredient) => ingredient.name === name)));
  }
});

test('search matches recipe names and ingredients, combined with category', () => {
  assert.equal(filterRecipes(mockRecipes, '', 'All').length, 10);
  assert.deepEqual(filterRecipes(mockRecipes, '  CARBONARA ', 'All').map((recipe) => recipe.id), ['pasta-carbonara']);
  assert.ok(filterRecipes(mockRecipes, 'garlic', 'All').some((recipe) => recipe.id === 'creamy-tomato-pasta'));
  assert.deepEqual(filterRecipes(mockRecipes, 'chicken', 'Pasta'), []);
  assert.ok(filterRecipes(mockRecipes, '', 'Vegetarian').some((recipe) => recipe.id === 'shakshuka'));
  assert.deepEqual(filterRecipes(mockRecipes, 'nothing-matches', 'All'), []);
});

test('mapper turns numbered fields into internal ingredients and handles missing data', () => {
  const recipe = mapMealDbMealToRecipe(fullMeal);
  assert.equal(recipe.id, '123');
  assert.equal(recipe.imageUrl, null);
  assert.equal(recipe.instructions, 'Cook pasta.\nServe warm.');
  assert.deepEqual(recipe.ingredients, [{ name: 'Tomatoes', measure: '2 pcs' }, { name: 'Pasta', measure: '200 g' }]);
  assert.deepEqual(recipe.tags, ['Quick', 'Family']);
  assert.equal(mapMealDbMealToRecipe({ idMeal: '124', strMeal: 'Plain' }).ingredients.length, 0);
  assert.throws(() => mapMealDbMealToRecipe({ idMeal: '', strMeal: 'Broken' }));
});

test('browse uses partial category results without per-card lookups', async () => {
  const paths = [];
  await withFetch((url) => {
    paths.push(url.pathname + url.search);
    if (url.pathname.endsWith('/filter.php')) {
      const category = url.searchParams.get('c');
      return { meals: [{ idMeal: category === 'Chicken' ? '200' : '201', strMeal: `${category} Dinner`, strMealThumb: null }] };
    }
    throw new Error('Unexpected endpoint');
  }, async () => {
    const initial = await getRecipes();
    assert.deepEqual(initial.map((recipe) => recipe.id), ['200', '201']);
    assert.equal(initial[0].ingredientCount, null);
    assert.deepEqual((await getRecipes('', 'Pasta')).map((recipe) => recipe.id), ['201']);
  });
  assert.equal(paths.length, 3);
  assert.ok(paths.every((path) => path.includes('/filter.php?c=')));
});

test('search encodes query, filters category locally and treats null meals as empty', async () => {
  const paths = [];
  await withFetch((url) => {
    paths.push(url.pathname + url.search);
    return { meals: url.searchParams.get('s') === 'nothing' ? null : [fullMeal, { ...fullMeal, idMeal: '125', strCategory: 'Chicken' }] };
  }, async () => {
    const pasta = await getRecipes('  tomato pasta ', 'Pasta');
    assert.deepEqual(pasta.map((recipe) => recipe.id), ['123']);
    assert.equal(pasta[0].ingredientCount, 2);
    assert.deepEqual(await getRecipes('nothing'), []);
  });
  assert.ok(paths[0].includes('search.php?s=tomato%20pasta'));
});

test('detail loads full recipe by ID and category list uses the API', async () => {
  const paths = [];
  await withFetch((url) => {
    paths.push(url.pathname + url.search);
    if (url.pathname.endsWith('/lookup.php')) return { meals: [fullMeal] };
    return { meals: [{ strCategory: 'Pasta' }, { strCategory: 'Breakfast' }, { strCategory: 'Seafood' }] };
  }, async () => {
    assert.equal((await getRecipeById('123')).ingredients.length, 2);
    assert.equal(await getRecipeById('not-an-id'), null);
    assert.deepEqual(await getRecipeCategories(), ['All', 'Breakfast', 'Pasta']);
  });
  assert.deepEqual(paths, ['/api/json/v1/1/lookup.php?i=123', '/api/json/v1/1/list.php?c=list']);
  assert.ok(recipeCategories.includes('Dessert'));
});

test('detail handles a missing meal and missing optional fields', async () => {
  await withFetch(() => ({ meals: null }), async () => {
    assert.equal(await getRecipeById('999999'), null);
  });
  const sparse = mapMealDbMealToRecipe({ idMeal: '444', strMeal: 'Simple Dish' });
  assert.equal(sparse.category, 'Other');
  assert.equal(sparse.area, null);
  assert.equal(sparse.imageUrl, null);
  assert.equal(sparse.instructions, '');
  assert.deepEqual(sparse.ingredients, []);
});

test('network and invalid responses surface errors without mock fallback', async () => {
  const original = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try { await assert.rejects(getRecipes('offline'), /offline/); } finally { global.fetch = original; }
  await withFetch(() => ({ meals: [fullMeal] }), async () => {
    assert.equal((await getRecipes('online')).length, 1);
  });
  await withFetch(() => ({ meals: {} }), async () => {
    await assert.rejects(getRecipes('bad'), /Invalid recipe response/);
  });
  global.fetch = async () => ({ ok: false, status: 503 });
  try { await assert.rejects(getRecipes('broken'), /503/); } finally { global.fetch = original; }
});
