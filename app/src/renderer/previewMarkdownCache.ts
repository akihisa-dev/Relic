export function rememberPreviewCacheEntry(
  cache: Map<string, string>,
  key: string,
  value: string,
  maxEntries: number
): void {
  cache.set(key, value);
  if (cache.size <= maxEntries) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
}
