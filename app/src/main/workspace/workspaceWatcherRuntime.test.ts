import type { FSWatcher } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields
} from "../../shared/ipc";
import type { AppSettings } from "../settings/appSettings";
import {
  WorkspaceWatcherRuntime,
  type WorkspaceWatchListener,
  workspaceChangeNotifyDelayMs
} from "./workspaceWatcherRuntime";

class FakeWatcher {
  readonly close = vi.fn();

  on(): this {
    return this;
  }
}

function appSettings(lastWorkspaceId: string): AppSettings {
  return {
    editorSettings: defaultEditorSettings,
    frontmatterTemplates: defaultFrontmatterTemplates,
    lastWorkspaceId,
    userDefinedFields: defaultUserDefinedFields,
    workspaces: [
      { id: "ws-1", name: "Notes", path: "/tmp/notes" },
      { id: "ws-2", name: "Archive", path: "/tmp/archive" }
    ]
  };
}

describe("WorkspaceWatcherRuntime", () => {
  const runtimes: WorkspaceWatcherRuntime[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    runtimes.length = 0;
  });

  afterEach(() => {
    for (const runtime of runtimes) runtime.stop();
    vi.useRealTimers();
  });

  it("instanceごとに監視対象と遅延通知を分離する", () => {
    const notesWatcher = new FakeWatcher();
    const archiveWatcher = new FakeWatcher();
    const listeners: {
      archive?: WorkspaceWatchListener;
      notes?: WorkspaceWatchListener;
    } = {};
    const notifyNotesChanged = vi.fn();
    const notifyArchiveChanged = vi.fn();
    const watchNotes = vi.fn((
      _targetPath: string,
      _options: { recursive: true },
      listener: WorkspaceWatchListener
    ): FSWatcher => {
      listeners.notes = listener;
      return notesWatcher as unknown as FSWatcher;
    });
    const watchArchive = vi.fn((
      _targetPath: string,
      _options: { recursive: true },
      listener: WorkspaceWatchListener
    ): FSWatcher => {
      listeners.archive = listener;
      return archiveWatcher as unknown as FSWatcher;
    });
    const notesRuntime = new WorkspaceWatcherRuntime({
      notifyWorkspaceChanged: notifyNotesChanged,
      notifyWorkspaceWatcherStatus: vi.fn(),
      watchWorkspace: watchNotes
    });
    const archiveRuntime = new WorkspaceWatcherRuntime({
      notifyWorkspaceChanged: notifyArchiveChanged,
      notifyWorkspaceWatcherStatus: vi.fn(),
      watchWorkspace: watchArchive
    });
    runtimes.push(notesRuntime, archiveRuntime);

    notesRuntime.sync(appSettings("ws-1"));
    archiveRuntime.sync(appSettings("ws-2"));
    notesRuntime.stop();

    listeners.notes?.("change", "stopped.md");
    listeners.archive?.("change", "active.md");
    vi.advanceTimersByTime(workspaceChangeNotifyDelayMs);

    expect(notesWatcher.close).toHaveBeenCalledOnce();
    expect(archiveWatcher.close).not.toHaveBeenCalled();
    expect(notifyNotesChanged).not.toHaveBeenCalled();
    expect(notifyArchiveChanged).toHaveBeenCalledWith(
      { id: "ws-2", path: "/tmp/archive" },
      [{ eventType: "change", filename: "active.md" }]
    );
  });
});
