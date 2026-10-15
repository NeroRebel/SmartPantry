const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const root = path.resolve(__dirname, '../src');

function compile(file, overrides) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })((name) => {
    if (!(name in overrides)) throw new Error(`Unexpected dependency: ${name}`);
    return overrides[name];
  }, module, module.exports);
  return module.exports;
}

const resources = compile('i18n/sync.ts', {}).syncTranslations;
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
const native = Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'View', 'Modal', 'ScrollView', 'TextInput'].map((type) => [type, type]));
native.StyleSheet = { create: (styles) => styles };
const theme = { useThemedStyles: (create) => { const colors = { text: 'text', secondary: 'secondary', accent: 'accent', accentSoft: 'accentSoft', border: 'border', danger: 'danger' }; return { colors, styles: create(colors) }; } };
function hooks() {
  const slots = []; let index = 0; let effects = [];
  return {
    react: {
      useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
      useEffect(effect, deps) { const i = index++; if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) { slots[i] = deps; effects.push(effect); } },
    },
    render(component) { index = 0; const tree = component(); const pending = effects; effects = []; pending.forEach((effect) => effect()); return tree; },
  };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) { return nodes(tree, (node) => node.type === 'Text').map((node) => node.props.children).flat(Infinity).join(' '); }
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

function section(overrides = {}, language = 'en') {
  const state = { status: 'idle', lastSuccessfulSyncAt: null, errorKey: null, configured: true, canSync: true, syncNow: async () => {}, ...overrides };
  const react = hooks();
  const component = compile('components/sync-section.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, react: react.react, 'react/jsx-runtime': jsx, 'react-native': native,
    'react-i18next': { useTranslation: () => ({ i18n: { language }, t: (key, values) => {
      assert.ok(key in resources[language], `Missing translation: ${key}`);
      return resources[language][key].replace('{{date}}', values?.date ?? '');
    } }) },
    '@/sync/sync-context': { useSync: () => state }, '@/theme/theme-context': theme,
  }).SyncSection;
  return { state, render: () => react.render(component) };
}

test('Profile renders the shared Cloud Sync section, not the obsolete unconditional local-only card', () => {
  const react = hooks(); const SharedSyncSection = () => null;
  const profile = compile('app/profile.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-router': { router: {} }, react: react.react, 'react/jsx-runtime': jsx,
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) },
    '@/auth/auth-context': { useAuth: () => ({ user: { id: 'a', created_at: '2026-01-01' } }) },
    '@/components/user-avatar': { UserAvatar: 'UserAvatar' }, '@/components/sync-section': { SyncSection: SharedSyncSection }, '@/theme/theme-context': theme,
    '@/utils/auth': { formatAccountDate: () => 'January 1, 2026', getUserProfile: () => ({ name: 'Name', email: 'a@example.com', provider: 'email', avatarUrl: null }), hasEmailIdentity: () => true },
    '@/utils/avatar': { customAvatarPath: () => null },
  }).default;
  const tree = react.render(profile);
  assert.equal(nodes(tree, (node) => node.type === SharedSyncSection).length, 1);
  assert.equal(nodes(tree, (node) => node.type === 'UserAvatar').length, 1);
  assert.ok(text(tree).includes('password.change')); assert.ok(text(tree).includes('auth.signOut'));
  assert.ok(text(tree).includes('account.changeEmail')); assert.ok(text(tree).includes('account.deleteTitle'));
  assert.equal(text(tree).includes('profile.localBody'), false); assert.equal(text(tree).includes('profile.localTitle'), false);
});

test('all statuses, timestamp and visible Sync now action render in every supported language', () => {
  for (const language of ['en', 'sk', 'ru', 'uk', 'hu']) {
    for (const [status, key] of [['idle', 'never'], ['synced', 'synced'], ['syncing', 'syncing'], ['offline', 'offline'], ['error', 'error']]) {
      const app = section({ status }, language); const tree = app.render();
      assert.ok(text(tree).includes(resources[language][`sync.${key}`]));
      assert.equal(nodes(tree, (node) => node.type === 'Pressable' && node.props.accessibilityLabel === resources[language]['sync.now']).length, 1);
    }
    const date = '2026-10-15T12:00:00.000Z';
    assert.ok(text(section({ status: 'synced', lastSuccessfulSyncAt: date }, language).render()).includes(new Date(date).toLocaleString(language)));
  }
});

test('Sync now is disabled while running or not ready; offline/error states still allow retry', () => {
  for (const state of [{ status: 'syncing' }, { canSync: false }, { configured: false }]) {
    const button = nodes(section(state).render(), (node) => node.type === 'Pressable')[0];
    assert.equal(button.props.disabled, true); assert.equal(button.props.accessibilityState.disabled, true);
  }
  for (const status of ['idle', 'synced', 'offline', 'error']) assert.equal(nodes(section({ status }).render(), (node) => node.type === 'Pressable')[0].props.disabled, false);
  assert.ok(text(section({ configured: false, canSync: false }).render()).includes(resources.en['sync.unavailable']));
});

test('manual action invokes only the existing provider and prevents rapid duplicate taps', async () => {
  let calls = 0; let release;
  const app = section({ syncNow: async () => { calls++; await new Promise((resolve) => { release = resolve; }); } });
  const button = nodes(app.render(), (node) => node.type === 'Pressable')[0];
  button.props.onPress(); button.props.onPress();
  assert.equal(calls, 1); assert.equal(nodes(app.render(), (node) => node.type === 'Pressable')[0].props.disabled, true);
  release(); await flush(); assert.equal(nodes(app.render(), (node) => node.type === 'Pressable')[0].props.disabled, false);
});

test('provider errors and unexpected manual failures show safe localized feedback without raw error text', async () => {
  const normal = section({ status: 'error', errorKey: 'sync.errorHelp' });
  assert.ok(nodes(normal.render(), (node) => node.props.accessibilityRole === 'alert').length);
  const app = section({ syncNow: async () => { throw new Error('SECRET_REQUEST_CONTENT'); } });
  nodes(app.render(), (node) => node.type === 'Pressable')[0].props.onPress(); await flush();
  const tree = app.render(); assert.ok(text(tree).includes(resources.en['sync.errorHelp'])); assert.equal(text(tree).includes('SECRET_REQUEST_CONTENT'), false);
  app.state.status = 'synced'; app.render(); assert.equal(text(app.render()).includes(resources.en['sync.errorHelp']), false);
});
