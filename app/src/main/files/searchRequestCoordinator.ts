export interface SearchRequestContext {
  shouldContinue: () => boolean;
}

interface InFlightSearch<T> {
  promise: Promise<T>;
}

export class WorkspaceSearchRequestCoordinator {
  private readonly latestRequestByWorkspace = new Map<string, number>();
  private readonly inFlightByKey = new Map<string, InFlightSearch<unknown>>();

  run<T>(
    workspaceId: string,
    searchKey: string,
    execute: (context: SearchRequestContext) => Promise<T>
  ): Promise<T> {
    const inFlightKey = `${workspaceId}\0${searchKey}`;
    const existing = this.inFlightByKey.get(inFlightKey);

    if (existing) {
      return existing.promise as Promise<T>;
    }

    const requestId = (this.latestRequestByWorkspace.get(workspaceId) ?? 0) + 1;
    this.latestRequestByWorkspace.set(workspaceId, requestId);

    const promise = execute({
      shouldContinue: () => this.latestRequestByWorkspace.get(workspaceId) === requestId
    }).finally(() => {
      const current = this.inFlightByKey.get(inFlightKey);
      if (current?.promise === promise) {
        this.inFlightByKey.delete(inFlightKey);
      }
    });

    this.inFlightByKey.set(inFlightKey, { promise });
    return promise;
  }

  invalidate(workspaceId?: string): void {
    if (!workspaceId) {
      this.latestRequestByWorkspace.clear();
      this.inFlightByKey.clear();
      return;
    }

    this.latestRequestByWorkspace.set(
      workspaceId,
      (this.latestRequestByWorkspace.get(workspaceId) ?? 0) + 1
    );

    for (const key of this.inFlightByKey.keys()) {
      if (key.startsWith(`${workspaceId}\0`)) {
        this.inFlightByKey.delete(key);
      }
    }
  }
}

export const workspaceSearchRequestCoordinator = new WorkspaceSearchRequestCoordinator();
