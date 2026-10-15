const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const config = require('../app.json').expo;

function load(file) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', source)(module.exports);
  return module.exports;
}
const { getSystemBarStyle, getTabBarLayout, shouldHideSystemBars } = load('utils/system-ui.ts');
const { resolveThemeMode, createTheme } = load('theme/theme.ts');

test('system bars use contrasting icons for resolved theme, independent of high contrast/accent', () => {
  for (const system of ['light', 'dark']) {
    for (const preference of ['light', 'dark', 'system']) {
      for (const contrast of [false, true]) {
        for (const accent of ['orange', 'purple', 'green', 'red', 'yellow']) {
          const mode = resolveThemeMode(preference, system);
          const theme = createTheme(mode, contrast, accent);
          assert.equal(getSystemBarStyle(theme.mode), mode === 'dark' ? 'light' : 'dark');
        }
      }
    }
  }
});

test('tab bar includes gesture, three-button and iOS bottom insets exactly once', () => {
  for (const inset of [0, 12, 24, 34, 48, 80]) {
    const layout = getTabBarLayout(inset);
    assert.equal(layout.paddingBottom, Math.max(12, inset));
    assert.equal(layout.height - layout.paddingBottom, 60);
    assert.ok(layout.paddingBottom >= inset);
  }
  assert.deepEqual(getTabBarLayout(NaN), getTabBarLayout(0));
  assert.deepEqual(getTabBarLayout(-1), getTabBarLayout(0));
});

test('native system-bar plugins keep controls visible and disable the Android contrast scrim', () => {
  const navigation = config.plugins.find((plugin) => plugin[0] === 'expo-navigation-bar')[1];
  const status = config.plugins.find((plugin) => plugin[0] === 'expo-status-bar')[1];
  assert.equal(navigation.enforceContrast, false);
  assert.equal(navigation.hidden, false);
  assert.equal(status.hidden, false);
  const pluginRoot = path.dirname(require.resolve('expo-navigation-bar/package.json'));
  const { applyEnforceNavigationBarContrast } = require(path.join(pluginRoot, 'plugin/build/withNavigationBar.js'));
  const native = { modResults: { resources: { style: [{ $: { name: 'AppTheme' }, item: [
    { $: { name: 'android:enforceNavigationBarContrast' }, _: 'true' },
  ] }] } } };
  const styles = applyEnforceNavigationBarContrast(native, navigation.enforceContrast).modResults.resources.style[0].item;
  assert.equal(styles.filter((item) => item.$.name === 'android:enforceNavigationBarContrast').length, 1);
  assert.equal(styles.find((item) => item.$.name === 'android:enforceNavigationBarContrast')._, 'false');
});

test('every tab uses navigator height instead of hardcoded system inset estimates', () => {
  for (const screen of ['index', 'inventory', 'scan', 'recipes', 'more']) {
    const source = fs.readFileSync(path.join(__dirname, `../src/app/(tabs)/${screen}.tsx`), 'utf8');
    assert.match(source, /useBottomTabBarHeight\(\)/);
    assert.doesNotMatch(source, /useSafeAreaInsets|insets\.bottom/);
    assert.match(source, /edges=\{\['top', 'left', 'right'\]\}/);
  }
});

test('immersive visibility is Android-only, opt-in, and suspended for the keyboard', () => {
  for (const platform of ['android', 'ios', 'web']) {
    for (const enabled of [false, true]) {
      for (const keyboard of [false, true]) {
        assert.equal(shouldHideSystemBars(platform, enabled, keyboard), platform === 'android' && enabled && !keyboard);
      }
    }
  }
});

test('immersive tabs keep a gesture floor and retain larger three-button clearance', () => {
  assert.equal(getTabBarLayout(0, true).paddingBottom, 24);
  assert.equal(getTabBarLayout(48, true).paddingBottom, 48);
  assert.equal(getTabBarLayout(24, true).height, getTabBarLayout(0, true).height);
  assert.equal(getTabBarLayout(0, false).paddingBottom, 12);
});

test('immersive labels are localized in all five languages', () => {
  const translations = load('i18n/system-ui.ts').systemUITranslations;
  for (const language of ['en', 'sk', 'ru', 'uk', 'hu']) {
    assert.ok(translations[language]['appearance.immersive']);
    assert.ok(translations[language]['appearance.immersiveHint']);
  }
});
