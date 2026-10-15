import { getLocalUserId } from '@/db/local-state';

export interface Feedback {
  id: number; owner: string; key: string; tone: 'success' | 'error';
  values?: Record<string, string | number>;
  action?: { key: string; run: () => void };
}
let current: Feedback | null = null;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const publish = () => { for (const listener of listeners) listener(); };
export const getFeedback = () => current;
export function subscribeFeedback(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function dismissFeedback(id?: number) {
  if (id !== undefined && current?.id !== id) return;
  clearTimeout(timer); current = null; publish();
}
export function showFeedback(key: string, options: Partial<Omit<Feedback, 'key' | 'id'>> = {}) {
  clearTimeout(timer);
  const id = ++sequence;
  current = { id, key, owner: getLocalUserId(), tone: 'success', ...options };
  publish();
  timer = setTimeout(() => dismissFeedback(id), 8000);
  return id;
}
