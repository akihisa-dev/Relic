import type { WorkspaceState } from "../shared/ipc";

export type IsCurrentWorkspaceRequest = () => boolean;

export interface WorkspaceRequestGuard {
  beginWorkspaceRequest: () => IsCurrentWorkspaceRequest;
  beginWorkspaceRequestFor: (workspaceId: string | null) => IsCurrentWorkspaceRequest;
  invalidateWorkspaceRequests: (nextWorkspaceId?: string | null) => void;
}

export interface WorkspaceSessionSnapshot {
  workspaceState: WorkspaceState | null;
  workspaceDataRevision: number;
  workspaceStructureRevision: number;
}

/** Owns the workspace snapshot and the lifetime of operations that may update it. */
export class WorkspaceSession {
  private snapshot: WorkspaceSessionSnapshot;
  private requestGeneration = 0;
  private requestWorkspaceId: string | null;
  private hasEstablishedWorkspace: boolean;
  private readonly listeners = new Set<() => void>();

  constructor(initialState: WorkspaceState | null = null) {
    this.snapshot = {
      workspaceState: initialState,
      workspaceDataRevision: 0,
      workspaceStructureRevision: 0
    };
    this.requestWorkspaceId = initialState?.activeWorkspace?.id ?? null;
    this.hasEstablishedWorkspace = this.requestWorkspaceId !== null;
  }

  getSnapshot = (): WorkspaceSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  beginWorkspaceRequestFor = (workspaceId: string | null): IsCurrentWorkspaceRequest => {
    const generation = this.requestGeneration;
    return () => generation === this.requestGeneration && workspaceId === this.requestWorkspaceId;
  };

  invalidateWorkspaceRequests = (nextWorkspaceId?: string | null): void => {
    this.requestGeneration += 1;
    if (nextWorkspaceId !== undefined) this.requestWorkspaceId = nextWorkspaceId;
  };

  setWorkspaceState = (workspaceState: WorkspaceState): void => {
    const workspaceId = workspaceState.activeWorkspace?.id ?? null;
    const previousId = this.snapshot.workspaceState?.activeWorkspace?.id ?? null;
    const changedWorkspace = previousId !== workspaceId;
    const activationRevision = changedWorkspace && (this.hasEstablishedWorkspace || workspaceId === null) ? 1 : 0;

    // Activation can reserve the new owner before React renders. Do not invalidate
    // requests already started for that owner when its snapshot arrives.
    if (workspaceId !== this.requestWorkspaceId) this.invalidateWorkspaceRequests(workspaceId);
    this.hasEstablishedWorkspace ||= workspaceId !== null;
    this.publish({
      workspaceState,
      workspaceDataRevision: this.snapshot.workspaceDataRevision + activationRevision,
      workspaceStructureRevision: this.snapshot.workspaceStructureRevision + activationRevision
    });
  };

  markWorkspaceDataChanged = (kind: "full" | "paths" = "full"): void => {
    this.publish({
      ...this.snapshot,
      workspaceDataRevision: this.snapshot.workspaceDataRevision + 1,
      workspaceStructureRevision: this.snapshot.workspaceStructureRevision + (kind === "full" ? 1 : 0)
    });
  };

  private publish(snapshot: WorkspaceSessionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}
