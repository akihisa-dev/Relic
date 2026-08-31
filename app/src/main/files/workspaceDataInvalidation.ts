import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { normalizeWorkspaceRelativeInputPath } from "./paths";
import { hasHiddenPathSegment } from "./names";
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

export type WorkspaceWatcherInvalidationResult =
  | { kind: "none" }
  | { kind: "paths"; paths: string[] }
  | { kind: "full" };

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

  invalidateWatcherEvents(
    workspaceId: string,
    events: WorkspaceWatchEvent[]
  ): WorkspaceWatcherInvalidationResult {
    this.pruneExpiredMutations();
    if (events.length === 0) {
      this.invalidateTargets(workspaceId);
      return { kind: "full" };
    }

    const changedPaths = new Set<string>();
    for (const event of events) {
      const normalizedPath = normalizeWatchedPath(event.filename);
      if (normalizedPath && this.matchesRecentMutation(workspaceId, normalizedPath)) continue;

      const eventPaths = workspaceWatchEventChangedPaths(event);
      if (!eventPaths) {
        this.invalidateTargets(workspaceId);
        return { kind: "full" };
      }
      for (const changedPath of eventPaths) changedPaths.add(changedPath);
    }

    if (changedPaths.size > 0) {
      const paths = [...changedPaths].toSorted();
      this.invalidateTargets(workspaceId, paths);
      return { kind: "paths", paths };
    }

    return { kind: "none" };
  }

  private matchesRecentMutation(workspaceId: string, changedPath: string): boolean {
    const key = mutationKey(workspaceId, changedPath);
    return this.recentMutations.has(key);
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
  if (event.eventType !== "change" || !normalizedPath || hasHiddenPathSegment(normalizedPath) || !hasMarkdownExtension(normalizedPath)) {
    return undefined;
  }
  return [normalizedPath];
}

function normalizeWatchedPath(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const slashNormalized = filename.replaceAll("\\", "/");
  if (/^[A-Za-z]:/.test(slashNormalized)) return null;
  const normalized = normalizeWorkspaceRelativeInputPath(slashNormalized);

  // Watcher filenames are untrusted OS input. Requiring the exact normalized
  // form rejects absolute paths, traversal, NUL, and ambiguous separators
  // before any value can cross the main/renderer boundary.
  return normalized === slashNormalized ? normalized : null;
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
