const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');

function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  const load = (name) => {
    let filename = path.resolve(root, name);
    if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index');
    if (!path.extname(filename)) filename += fs.existsSync(`${filename}.ts`) ? '.ts' : '.tsx';
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const requireLocal = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2));
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id));
      return require(id);
    };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      console, setTimeout, clearTimeout, ...globals,
    }, { filename })(requireLocal, module, module.exports);
    return module.exports;
  };
  return load;
}

function timers() {
  let next = 0; const tasks = new Map();
  return {
    setTimeout(fn) { const id = ++next; tasks.set(id, fn); return id; },
    clearTimeout(id) { tasks.delete(id); },
    flush() { const batch = [...tasks.values()]; tasks.clear(); batch.forEach((fn) => fn()); },
  };
}

function hookHarness() {
  const slots = []; let cursor = 0; let queued = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, (value) => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; queued.push(() => { slots[i].cleanup = fn(); }); } },
  };
  return {
    react,
    render(fn) { cursor = 0; queued = []; const result = fn(); queued.forEach((effect) => effect()); return result; },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('feedback preserves account ownership and stale dismissal cannot clear newer feedback', () => {
  let owner = 'a'; const clock = timers();
  const feedback = loader({ '@/db/local-state': { getLocalUserId: () => owner } }, clock)('services/feedback');
  let events = 0; const unsubscribe = feedback.subscribeFeedback(() => events++);
  const first = feedback.showFeedback('saved'); owner = 'b';
  const second = feedback.showFeedback('updated', { tone: 'error' });
  feedback.dismissFeedback(first);
  assert.equal(feedback.getFeedback().id, second);
  assert.equal(feedback.getFeedback().owner, 'b');
  assert.equal(feedback.getFeedback().tone, 'error');
  clock.flush(); assert.equal(feedback.getFeedback(), null); assert.equal(events, 3);
  unsubscribe();
});

test('confirmation prevents stacked native dialogs and cancellation never mutates data', () => {
  const calls = []; let actions = 0;
  const { confirmAction } = loader({ 'react-native': { Platform: { OS: 'android' }, Alert: { alert: (...args) => calls.push(args) } } })('utils/confirm-action');
  const options = { title: 'title', message: 'message', cancel: 'cancel', confirm: 'confirm', onConfirm: () => actions++ };
  confirmAction(options); confirmAction(options); assert.equal(calls.length, 1);
  calls[0][2][0].onPress(); assert.equal(actions, 0);
  confirmAction(options); calls[1][2][1].onPress(); assert.equal(actions, 1);
  confirmAction(options); calls[2][3].onDismiss(); confirmAction(options); assert.equal(calls.length, 4);
});

test('web confirmation honors cancellation', () => {
  let accepted = false; let actions = 0;
  const { confirmAction } = loader({ 'react-native': { Platform: { OS: 'web' } } }, { window: { confirm: () => accepted } })('utils/confirm-action');
  const options = { title: '', message: '', cancel: '', confirm: '', onConfirm: () => actions++ };
  confirmAction(options); assert.equal(actions, 0); accepted = true; confirmAction(options); assert.equal(actions, 1);
});

test('remote failures distinguish rate limits, connectivity and service errors without exposing messages', () => {
  const { remoteErrorKey } = loader()('utils/load-error');
  assert.equal(remoteErrorKey({ status: 429 }), 'polish.rateLimited');
  for (const name of ['TypeError', 'AbortError', 'AuthRetryableFetchError']) assert.equal(remoteErrorKey({ name }), 'polish.networkError');
  for (const error of [null, { status: 500 }, { message: 'private request contents' }]) assert.equal(remoteErrorKey(error), 'polish.serviceError');
});

test('focused loading serializes requests and coalesces refresh bursts', async () => {
  const h = hookHarness(); const clock = timers(); let listener; let foreground; let calls = 0; const resolves = [];
  const load = loader({ react: h.react, 'expo-router': { useFocusEffect: (fn) => h.react.useEffect(fn, [fn]) },
    'react-native': { AppState: { addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } } },
    '@/db/local-state': { subscribeLocalChanges: (fn) => { listener = fn; return () => {}; } },
  }, clock);
  const hook = load('hooks/use-focused-data').useFocusedData;
  const fetch = () => { calls++; return new Promise((resolve) => resolves.push(resolve)); };
  const render = () => h.render(() => hook(fetch, { midnight: false }));
  let result = render(); assert.equal(calls, 1);
  result.reload(); foreground('active'); listener('local'); listener('remote'); clock.flush(); assert.equal(calls, 1);
  resolves.shift()(1); await settle(); assert.equal(calls, 2);
  resolves.shift()(2); await settle(); result = render(); assert.equal(result.data, 2); assert.equal(result.loading, false);
  h.unmount();
});

test('remote focused data ignores unrelated SQLite writes but refreshes on foreground and account changes', async () => {
  const h = hookHarness(); const clock = timers(); let listener; let foreground; let calls = 0;
  const hook = loader({ react: h.react, 'expo-router': { useFocusEffect: (fn) => h.react.useEffect(fn, [fn]) },
    'react-native': { AppState: { addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } } },
    '@/db/local-state': { subscribeLocalChanges: (fn) => { listener = fn; return () => {}; } },
  }, clock)('hooks/use-focused-data').useFocusedData;
  const fetch = async () => ++calls;
  const render = () => h.render(() => hook(fetch, { localChanges: false, midnight: false, remote: true }));
  render(); await settle(); listener('local'); listener('remote'); clock.flush(); await settle(); assert.equal(calls, 1);
  foreground('active'); await settle(); assert.equal(calls, 2);
  listener('account'); clock.flush(); await settle(); assert.equal(calls, 3); h.unmount();
});

test('focused loading ignores late completion after blur and exposes safe error keys', async () => {
  const h = hookHarness(); let resolve;
  const hook = loader({ react: h.react, 'expo-router': { useFocusEffect: (fn) => h.react.useEffect(fn, [fn]) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/db/local-state': { subscribeLocalChanges: () => () => {} },
  })('hooks/use-focused-data').useFocusedData;
  const fetch = () => new Promise((done) => { resolve = done; });
  h.render(() => hook(fetch, { midnight: false })); h.unmount(); resolve('stale'); await settle();
  assert.equal(h.render(() => hook(fetch, { midnight: false })).data, undefined);
  const fail = async () => { throw { name: 'TypeError', message: 'private detail' }; };
  h.render(() => hook(fail, { midnight: false, remote: true })); await settle();
  assert.equal(h.render(() => hook(fail, { midnight: false, remote: true })).error, 'polish.networkError'); h.unmount();
});

test('avatar name and token refreshes reuse the signed URL; avatar version changes refresh it', async () => {
  const h = hookHarness(); const clock = timers(); let calls = 0;
  const hook = loader({ react: h.react,
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/services/avatars': { avatarService: { signedUrl: async () => `https://example.com/${++calls}` } },
  }, clock)('hooks/use-user-avatar').useUserAvatar;
  const user = { id: 'a', email: 'a@example.com', user_metadata: { avatar_path: 'a/avatar', avatar_version: '1', full_name: 'A' } };
  h.render(() => hook(user)); await settle(); assert.equal(calls, 1);
  h.render(() => hook({ ...user, user_metadata: { ...user.user_metadata, full_name: 'New name' } })); await settle(); assert.equal(calls, 1);
  h.render(() => hook({ ...user, user_metadata: { ...user.user_metadata, avatar_version: '2' } })); await settle(); assert.equal(calls, 2);
  h.unmount();
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
test('all accent controls have readable text and status colors stay independent of accent', () => {
  const { createTheme } = loader()('theme/theme');
  for (const mode of ['light', 'dark']) for (const highContrast of [false, true]) {
    const base = createTheme(mode, highContrast, 'orange').colors;
    for (const accent of ['orange', 'purple', 'green', 'red', 'yellow']) {
      const c = createTheme(mode, highContrast, accent).colors;
      assert.ok(contrast(c.onAccent, c.accentFill) >= 4.5, `${mode}/${accent} button`);
      assert.ok(contrast(c.accent, c.surface) >= 4.5, `${mode}/${accent} interactive text`);
      for (const key of ['fresh', 'soon', 'expired', 'danger', 'warning', 'success']) assert.equal(c[key], base[key]);
    }
  }
});

test('all literal UI translation keys exist in each supported language including plural variants', () => {
  const { resources } = loader({ 'react-i18next': { initReactI18next: { type: '3rdParty', init() {} } } })('i18n');
  const keys = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.tsx?$/.test(file)) continue;
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node) => {
        if (ts.isCallExpression(node) && (node.expression.getText(ast) === 't' || node.expression.getText(ast) === 'i18n.t')) {
          const collect = (value) => {
            if (ts.isStringLiteral(value) && value.text.includes('.')) keys.add(value.text);
            else if (ts.isConditionalExpression(value)) { collect(value.whenTrue); collect(value.whenFalse); }
          };
          if (node.arguments[0]) collect(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
      }; visit(ast);
    }
  }; walk(root);
  assert.ok(keys.size > 150);
  const missing = [];
  for (const [language, { translation }] of Object.entries(resources)) for (const key of keys) {
    if (!translation[key] && !Object.keys(translation).some((candidate) => candidate.startsWith(`${key}_`))) missing.push(`${language}:${key}`);
  }
  assert.deepEqual(missing, []);
});
