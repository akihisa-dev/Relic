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
  workspaceChangeNotifyDelayMs,
  workspaceWatcherMaxPendingEvents,
  workspaceWatcherRecoveryStabilityDelayMs,
  workspaceWatcherRetryBaseDelayMs,
  workspaceWatcherRetryMaxDelayMs
} from "./workspaceWatcherRuntime";

class FakeWatcher {
  readonly close = vi.fn();
  private errorListener: (() => void) | null = null;

  on(event: string, listener: () => void): this {
    if (event === "error") this.errorListener = listener;
    return this;
  }

  emitError(): void {
    this.errorListener?.();
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

  it("同一パスの変更を束ね、イベント上限超過時は全再走査へ倒す", () => {
    const watcher = new FakeWatcher();
    let listener: WorkspaceWatchListener | undefined;
    const notifyChanged = vi.fn();
    const runtime = new WorkspaceWatcherRuntime({
      notifyWorkspaceChanged: notifyChanged,
      notifyWorkspaceWatcherStatus: vi.fn(),
      watchWorkspace: vi.fn((_path, _options, nextListener) => {
        listener = nextListener;
        return watcher as unknown as FSWatcher;
      })
    });
    runtimes.push(runtime);
    runtime.sync(appSettings("ws-1"));

    listener?.("change", "notes\\a.md");
    listener?.("change", "notes/a.md");
    vi.advanceTimersByTime(workspaceChangeNotifyDelayMs);
    expect(notifyChanged).toHaveBeenCalledWith(
      { id: "ws-1", path: "/tmp/notes" },
      [{ eventType: "change", filename: "notes\\a.md" }]
    );

    notifyChanged.mockClear();
    for (let index = 0; index <= workspaceWatcherMaxPendingEvents; index += 1) {
      listener?.("change", `notes/${index}.md`);
    }
    vi.advanceTimersByTime(workspaceChangeNotifyDelayMs);
    expect(notifyChanged).toHaveBeenCalledWith(
      { id: "ws-1", path: "/tmp/notes" },
      []
    );
  });

  it("再試行直後の非同期errorではbackoffを維持し、安定後だけ全再走査する", () => {
    const watchers: FakeWatcher[] = [];
    const notifyChanged = vi.fn();
    const notifyStatus = vi.fn();
    const watchWorkspace = vi.fn((): FSWatcher => {
      const watcher = new FakeWatcher();
      watchers.push(watcher);
      return watcher as unknown as FSWatcher;
    });
    const runtime = new WorkspaceWatcherRuntime({
      notifyWorkspaceChanged: notifyChanged,
      notifyWorkspaceWatcherStatus: notifyStatus,
      watchWorkspace
    });
    runtimes.push(runtime);

    runtime.sync(appSettings("ws-1"));
    watchers.at(-1)?.emitError();

    const retryDelays = [
      workspaceWatcherRetryBaseDelayMs,
      workspaceWatcherRetryBaseDelayMs * 2,
      workspaceWatcherRetryBaseDelayMs * 4,
      workspaceWatcherRetryBaseDelayMs * 8,
      workspaceWatcherRetryBaseDelayMs * 16,
      workspaceWatcherRetryMaxDelayMs
    ];
    for (const [index, delay] of retryDelays.entries()) {
      vi.advanceTimersByTime(delay - 1);
      expect(watchWorkspace).toHaveBeenCalledTimes(index + 1);
      vi.advanceTimersByTime(1);
      expect(watchWorkspace).toHaveBeenCalledTimes(index + 2);
      expect(notifyChanged).not.toHaveBeenCalled();
      watchers.at(-1)?.emitError();
    }

    expect(notifyStatus).toHaveBeenCalledTimes(1);
    expect(notifyStatus).toHaveBeenCalledWith({ id: "ws-1", path: "/tmp/notes" });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    vi.advanceTimersByTime(workspaceWatcherRetryMaxDelayMs);
    expect(watchWorkspace).toHaveBeenCalledTimes(retryDelays.length + 2);
    vi.advanceTimersByTime(workspaceWatcherRecoveryStabilityDelayMs - 1);
    expect(notifyChanged).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(notifyChanged).toHaveBeenCalledTimes(1);
    expect(notifyChanged).toHaveBeenCalledWith({ id: "ws-1", path: "/tmp/notes" });
    expect(notifyStatus).toHaveBeenCalledTimes(1);

    watchers.at(-1)?.emitError();
    vi.advanceTimersByTime(workspaceWatcherRetryBaseDelayMs - 1);
    expect(watchWorkspace).toHaveBeenCalledTimes(retryDelays.length + 2);
    vi.advanceTimersByTime(1);
    expect(watchWorkspace).toHaveBeenCalledTimes(retryDelays.length + 3);
  });

  it("復旧安定待ちをstopとワークスペース切替で破棄する", () => {
    const watchers: FakeWatcher[] = [];
    const notifyChanged = vi.fn();
    const runtime = new WorkspaceWatcherRuntime({
      notifyWorkspaceChanged: notifyChanged,
      notifyWorkspaceWatcherStatus: vi.fn(),
      watchWorkspace: vi.fn((): FSWatcher => {
        const watcher = new FakeWatcher();
        watchers.push(watcher);
        return watcher as unknown as FSWatcher;
      })
    });
    runtimes.push(runtime);

    runtime.sync(appSettings("ws-1"));
    watchers.at(-1)?.emitError();
    vi.advanceTimersByTime(workspaceWatcherRetryBaseDelayMs);
    runtime.sync(appSettings("ws-2"));
    vi.advanceTimersByTime(workspaceWatcherRecoveryStabilityDelayMs);
    expect(notifyChanged).not.toHaveBeenCalled();

    watchers.at(-1)?.emitError();
    vi.advanceTimersByTime(workspaceWatcherRetryBaseDelayMs);
    runtime.stop();
    vi.advanceTimersByTime(workspaceWatcherRecoveryStabilityDelayMs);
    expect(notifyChanged).not.toHaveBeenCalled();
  });
});
