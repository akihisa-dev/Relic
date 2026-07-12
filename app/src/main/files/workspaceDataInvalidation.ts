import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { workspaceSearchRequestCoordinator } from "./searchRequestCoordinator";
import { workspaceDerivedDataSession } from "./workspaceDerivedDataSession";

export interface WorkspaceDataInvalidationTargets {
  derivedData: { invalidate: (workspaceId?: string, changedPaths?: string[]) => void };
  searchRequests: { invalidate: (workspaceId?: string) => void };
}

export interface WorkspaceWatchEvent {
  eventType: string;
  filename?: string | null;
}

const defaultRecentMutationTtlMs = 2500;

export class WorkspaceMutationCoordinator {
  private readonly recentMutations = new Map<string, number>();

  constructor(
    private readonly targets: WorkspaceDataInvalidationTargets,
    private readonly now: () => number = () => Date.now(),
    private readonly recentMutationTtlMs: number = defaultRecentMutationTtlMs
  ) {}

  invalidateAfterMutation(workspaceId?: string, changedPaths?: string[]): void {
    this.targets.derivedData.invalidate(workspaceId, changedPaths);
    this.targets.searchRequests.invalidate(workspaceId);

    if (!workspaceId || !changedPaths) return;
    const expiresAt = this.now() + this.recentMutationTtlMs;
    for (const changedPath of changedPaths) {
      this.recentMutations.set(mutationKey(workspaceId, changedPath), expiresAt);
    }
  }

  invalidateWatcherEvents(workspaceId: string, events: WorkspaceWatchEvent[]): void {
    this.pruneExpiredMutations();
    if (events.length === 0) {
      this.invalidateTargets(workspaceId);
      return;
    }

    const changedPaths = new Set<string>();
    for (const event of events) {
      const normalizedPath = normalizeWatchedPath(event.filename);
      if (normalizedPath && this.consumeRecentMutation(workspaceId, normalizedPath)) continue;

      const eventPaths = workspaceWatchEventChangedPaths(event);
      if (!eventPaths) {
        this.invalidateTargets(workspaceId);
        return;
      }
      for (const changedPath of eventPaths) changedPaths.add(changedPath);
    }

    if (changedPaths.size > 0) {
      this.invalidateTargets(workspaceId, [...changedPaths]);
    }
  }

  private consumeRecentMutation(workspaceId: string, changedPath: string): boolean {
    const key = mutationKey(workspaceId, changedPath);
    if (!this.recentMutations.has(key)) return false;
    this.recentMutations.delete(key);
    return true;
  }

  private invalidateTargets(workspaceId?: string, changedPaths?: string[]): void {
    this.targets.derivedData.invalidate(workspaceId, changedPaths);
    this.targets.searchRequests.invalidate(workspaceId);
  }

  private pruneExpiredMutations(): void {
    const now = this.now();
    for (const [key, expiresAt] of this.recentMutations) {
      if (expiresAt < now) this.recentMutations.delete(key);
    }
  }
}

export function workspaceWatchEventChangedPaths(event: WorkspaceWatchEvent): string[] | undefined {
  const normalizedPath = normalizeWatchedPath(event.filename);
  if (event.eventType !== "change" || !normalizedPath || !hasMarkdownExtension(normalizedPath)) {
    return undefined;
  }
  return [normalizedPath];
}

function normalizeWatchedPath(filename: string | null | undefined): string | null {
  if (!filename) return null;
  return filename.replaceAll("\\", "/");
}

function mutationKey(workspaceId: string, changedPath: string): string {
  return `${workspaceId}\0${changedPath.replaceAll("\\", "/")}`;
}

export const workspaceMutationCoordinator = new WorkspaceMutationCoordinator({
  derivedData: workspaceDerivedDataSession,
  searchRequests: workspaceSearchRequestCoordinator
});

export const invalidateWorkspaceData = (
  workspaceId?: string,
  changedPaths?: string[]
): void => workspaceMutationCoordinator.invalidateAfterMutation(workspaceId, changedPaths);
