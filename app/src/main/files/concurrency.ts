export async function mapWithConcurrency<T, TResult>(
  values: readonly T[],
  maxConcurrent: number,
  mapper: (value: T, index: number) => Promise<TResult> | TResult
): Promise<TResult[]> {
  const limit = Math.max(1, Math.floor(maxConcurrent));
  const results = new Array<TResult>(values.length);

  if (values.length === 0) {
    return results;
  }

  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= values.length) {
        return;
      }

      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => runWorker()));

  return results;
}

