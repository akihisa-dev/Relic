type QueuedTask = {
  run: () => Promise<unknown> | unknown;
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
};

const pendingTasks: QueuedTask[] = [];
let draining = false;

/**
 * Serializes registration changes with app and workspace settings mutations.
 * Registration IDs are derived from paths, so these operations must not write
 * a snapshot captured before an earlier queued rename or removal is persisted.
 */
export function runWorkspaceRegistrationTask<T>(
  run: () => Promise<T> | T
): Promise<T> {
  const queued = new Promise<T>((resolve, reject) => {
    pendingTasks.push({
      reject,
      resolve: (value) => resolve(value as T),
      run
    });
    void drainWorkspaceRegistrationTasks();
  });
  // Callers may intentionally fire-and-forget a main-process task. Keep the
  // public rejection for callers that await it while marking it handled so a
  // failed task cannot create an unhandled-rejection event in the process.
  void queued.catch(() => undefined);
  return queued;
}

async function drainWorkspaceRegistrationTasks(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    while (pendingTasks.length > 0) {
      const task = pendingTasks.shift()!;

      try {
        task.resolve(await task.run());
      } catch (error) {
        // Keep the queue alive after a task failure. The caller receives the
        // rejection through its own promise; this worker never rejects.
        task.reject(error);
      }
    }
  } finally {
    draining = false;
  }
}
