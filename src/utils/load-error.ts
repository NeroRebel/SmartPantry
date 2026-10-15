// Only classify known network failures as connectivity problems; never show raw SDK text.
export function remoteErrorKey(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { name?: string; status?: number } : {};
  if (value.status === 429) return 'polish.rateLimited';
  if (value.name === 'TypeError' || value.name === 'AbortError' || value.name === 'AuthRetryableFetchError') return 'polish.networkError';
  return 'polish.serviceError';
}
