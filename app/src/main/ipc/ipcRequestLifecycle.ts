export type IpcRequestRunResult<T> =
  | { accepted: true; value: T }
  | { accepted: false };

/**
 * Owns the process-wide lifetime of invoke-style IPC work.
 *
 * A quit attempt reaches `will-quit` only after every window has accepted the
 * close request.  At that point no new renderer work should start, but work
 * already running in Main must finish before the process exits.
 */
export class IpcRequestLifecycle {
  private accepting = true;
  private readonly activeRequests = new Set<Promise<void>>();

  async runIfAccepting<T>(run: () => Promise<T> | T): Promise<IpcRequestRunResult<T>> {
    if (!this.accepting) return { accepted: false };

    const request = Promise.resolve().then(run);
    const completion = request.then(() => undefined, () => undefined);
    this.activeRequests.add(completion);

    try {
      return { accepted: true, value: await request };
    } finally {
      this.activeRequests.delete(completion);
    }
  }

  async stopAcceptingAndWait(): Promise<void> {
    this.accepting = false;

    while (this.activeRequests.size > 0) {
      await Promise.all([...this.activeRequests]);
    }
  }
}

const mainIpcRequestLifecycle = new IpcRequestLifecycle();

export function runMainIpcRequest<T>(
  run: () => Promise<T> | T
): Promise<IpcRequestRunResult<T>> {
  return mainIpcRequestLifecycle.runIfAccepting(run);
}

export function stopAcceptingMainIpcRequestsAndWait(): Promise<void> {
  return mainIpcRequestLifecycle.stopAcceptingAndWait();
}
