// A shared gate for local writes, profile operations and sync during account deletion.
const blocked = new Set<string>();
const operations = new Map<string, Set<Promise<unknown>>>();
export function isAccountBlocked(userId: string): boolean { return blocked.has(userId); }
export function assertAccountWritable(userId: string): void {
  if (blocked.has(userId)) throw Object.assign(new Error('Account deletion in progress'), { code: 'account.deleting' });
}
export async function runAccountOperation<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  assertAccountWritable(userId);
  const task = Promise.resolve().then(() => { assertAccountWritable(userId); return operation(); });
  const tasks = operations.get(userId) ?? new Set<Promise<unknown>>();
  tasks.add(task); operations.set(userId, tasks);
  try { return await task; } finally { tasks.delete(task); if (!tasks.size) operations.delete(userId); }
}
export async function blockAccount(userId: string): Promise<void> {
  blocked.add(userId);
  await Promise.allSettled([...(operations.get(userId) ?? [])]);
}
export function unblockAccount(userId: string): void { blocked.delete(userId); }
