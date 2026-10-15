let owner = '';
let revision = 0;
export type LocalChangeReason = 'local' | 'remote' | 'account';
const listeners = new Set<(reason: LocalChangeReason) => void>();

export function getLocalUserId(): string { return owner; }
export function assertLocalAccount(expectedOwner: string): void {
  if (expectedOwner !== owner) throw new Error('The active account changed. Please try again.');
}
export function getLocalRevision(): number { return revision; }
export function setLocalUserId(userId: string | null): void {
  const next = userId ?? '';
  if (next === owner) return;
  owner = next;
  notifyLocalChange('account');
}
export function notifyLocalChange(reason: LocalChangeReason = 'local'): void {
  revision++;
  for (const listener of listeners) listener(reason);
}
export function subscribeLocalChanges(listener: (reason: LocalChangeReason) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Serialize repository transactions (including the web transaction fallback).
let pending: Promise<unknown> = Promise.resolve();
export function serializeLocal<T>(task: () => Promise<T>): Promise<T> {
  const result = pending.then(task);
  pending = result.catch(() => {});
  return result;
}

let lastTimestamp = 0;
export function localTimestamp(previous?: string): string {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1, previous ? Date.parse(previous) + 1 || 0 : 0);
  return new Date(lastTimestamp).toISOString();
}
