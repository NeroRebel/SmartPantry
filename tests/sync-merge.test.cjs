const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
const root = path.resolve(__dirname, '../src/sync'); const cache = new Map();
function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)((name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports);
  return module.exports;
}
const { planMerge, compareUpdatedAt } = load(path.join(root, 'merge.ts'));
const row = (id, day, deleted = false, owner = 'a') => ({ id, user_id: owner, updated_at: `2026-10-${day}T00:00:00.000Z`, deleted_at: deleted ? `2026-10-${day}T00:00:00.000Z` : null });

test('merge uploads local-only rows, downloads cloud-only rows and does not duplicate equals', () => {
  const local = row('local', '10'); const remote = row('remote', '11'); const equal = row('equal', '12');
  const plan = planMerge([local, equal], [remote, equal], 'a');
  assert.deepEqual(plan.push, [local]); assert.deepEqual(plan.pull, [remote]);
  assert.deepEqual(planMerge([local, remote, equal], [local, remote, equal], 'a').push, []);
  assert.deepEqual(planMerge([local, remote, equal], [local, remote, equal], 'a').pull, []);
});
test('last-write-wins includes both local and remote tombstones without resurrection', () => {
  const local = [row('local-newer', '12'), row('remote-newer', '10'), row('deleted-local', '12', true), row('deleted-remote', '10'), row('only-tombstone', '12', true)];
  const remote = [row('local-newer', '10'), row('remote-newer', '12'), row('deleted-local', '10'), row('deleted-remote', '12', true)];
  const plan = planMerge(local, remote, 'a');
  assert.deepEqual(plan.push.map((r) => r.id), ['local-newer', 'deleted-local', 'only-tombstone']);
  assert.deepEqual(plan.pull.map((r) => r.id), ['remote-newer', 'deleted-remote']);
  assert.ok(plan.pull[1].deleted_at);
});
test('timestamp comparisons preserve PostgreSQL microseconds and normalize time zones', () => {
  assert.equal(compareUpdatedAt('2026-10-15T10:00:00.123456Z', '2026-10-15T10:00:00.123455Z'), 1);
  assert.equal(compareUpdatedAt('2026-10-15T12:00:00+02:00', '2026-10-15T10:00:00.000000Z'), 0);
  assert.throws(() => compareUpdatedAt('invalid', '2026-10-15T10:00:00Z'));
});
test('merge rejects foreign owners, duplicate identities and malformed timestamps', () => {
  assert.throws(() => planMerge([row('1', '10', false, 'b')], [], 'a'));
  assert.throws(() => planMerge([], [row('1', '10', false, 'b')], 'a'));
  assert.throws(() => planMerge([row('1', '10'), row('1', '12')], [], 'a'));
  assert.throws(() => planMerge([{ ...row('1', '10'), updated_at: 'bad' }], [], 'a'));
});
