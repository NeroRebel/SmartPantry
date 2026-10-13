const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/data/product-presets.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
vm.runInThisContext(`(function(module, exports) {${source}\n})`, { filename })(loadedModule, loadedModule.exports);
const { presetCategories, productPresets, filterProductPresets, getPresetFormValues } = loadedModule.exports;

test('preset catalog has unique IDs and products in every category', () => {
  assert.equal(new Set(productPresets.map((preset) => preset.id)).size, productPresets.length);
  for (const category of presetCategories) {
    assert.ok(productPresets.some((preset) => preset.category === category), category);
  }
  assert.equal(filterProductPresets('', 'All').length, productPresets.length);
});

test('search and category chips filter locally by product name', () => {
  assert.deepEqual(filterProductPresets(' MILK ', 'All').map((preset) => preset.name), ['Milk']);
  assert.deepEqual(filterProductPresets('tom', 'All').map((preset) => preset.name), ['Tomatoes']);
  assert.deepEqual(filterProductPresets('chic', 'All').map((preset) => preset.name), ['Chicken Breast']);
  assert.ok(filterProductPresets('', 'Dairy').every((preset) => preset.category === 'Dairy'));
  assert.deepEqual(filterProductPresets('milk', 'Vegetables'), []);
  assert.deepEqual(filterProductPresets('not-a-product', 'All'), []);
});

test('preset defaults seed editable form fields without quantity or expiration', () => {
  const milk = productPresets.find((preset) => preset.id === 'milk');
  const tomatoes = productPresets.find((preset) => preset.id === 'tomatoes');
  assert.deepEqual(getPresetFormValues(milk), {
    name: 'Milk', category: 'Dairy', unit: 'L', storageLocation: 'Refrigerator',
  });
  assert.equal(getPresetFormValues(tomatoes).category, 'Vegetables');
  const fields = getPresetFormValues(milk);
  fields.name = 'Oat Milk';
  fields.unit = 'ml';
  assert.equal(milk.name, 'Milk');
  assert.equal(milk.defaultUnit, 'L');
  assert.equal('quantity' in fields, false);
  assert.equal('expirationDate' in fields, false);
});
