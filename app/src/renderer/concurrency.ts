export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number
): Promise<T[]> {
  const limit = Math.max(1, Math.floor(maxConcurrent));
  const results = new Array<T>(tasks.length);

  if (tasks.length === 0) {
    return results;
  }

  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= tasks.length) {
        return;
      }

      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => runWorker())
  );

  return results;
}
