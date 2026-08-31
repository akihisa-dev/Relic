import { isSafeWorkspaceChangedPath, type WorkspaceChangedEvent } from "../shared/ipc";
import { hasMarkdownExtension } from "../shared/markdownExtension";

export type WorkspaceChangeAction =
  | { kind: "paths"; paths: string[]; revision: number; workspaceId: string }
  | { kind: "full"; revision: number; workspaceId: string };

/**
 * Owns the ordering and active-workspace guard for watcher notifications.
 * Async refresh work is intentionally kept outside this pure coordinator so
 * one place remains responsible for deciding whether an event is current.
 */
export class WorkspaceChangeCoordinator {
  private readonly latestRevisionByWorkspace = new Map<string, number>();

  accept(event: WorkspaceChangedEvent, activeWorkspaceId: string | null): WorkspaceChangeAction | null {
    const latestRevision = this.latestRevisionByWorkspace.get(event.workspaceId) ?? 0;
    if (event.revision <= latestRevision) return null;
    this.latestRevisionByWorkspace.set(event.workspaceId, event.revision);
    if (event.workspaceId !== activeWorkspaceId) return null;

    return event.kind === "paths" &&
      event.paths.length > 0 &&
      event.paths.every((path) => isSafeWorkspaceChangedPath(path) && hasMarkdownExtension(path))
      ? {
        kind: "paths",
        paths: event.paths,
        revision: event.revision,
        workspaceId: event.workspaceId
      }
      : {
        kind: "full",
        revision: event.revision,
        workspaceId: event.workspaceId
      };
  }
}
