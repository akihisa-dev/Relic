import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  watch: vi.fn()
}));

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn().mockReturnValue([])
}));

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: electronMock.getAllWindows }
}));

vi.mock("node:fs", () => ({
  watch: fsMock.watch
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields
} from "../../shared/ipc";
import type { AppSettings } from "../settings/appSettings";
import {
  activeWorkspaceWatchTarget,
  notifyWorkspaceChanged,
  shouldNotifyWorkspaceChangeEvent,
  stopWorkspaceWatcher,
  syncWorkspaceWatcher,
  workspaceChangeInvalidationPaths,
  workspaceChangeNotificationDelay,
  workspaceChangeNotifyDelayMs,
  workspaceChangeMaxNotifyDelayMs,
  workspaceWatcherFailureNotifyDelayMs,
  workspaceWatcherRetryBaseDelayMs,
  workspaceWatcherRetryDelay,
  workspaceWatcherRetryMaxDelayMs
} from "./workspaceWatcher";

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

function appSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    editorSettings: defaultEditorSettings,
    featureToggles: defaultFeatureToggles,
    frontmatterTemplates: defaultFrontmatterTemplates,
    lastWorkspaceId: "ws-1",
    userDefinedFields: defaultUserDefinedFields,
    workspaces: [
      { id: "ws-1", name: "Notes", path: "/tmp/notes" },
      { id: "ws-2", name: "Archive", path: "/tmp/archive" }
    ],
    ...overrides
  };
}

describe("workspaceWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopWorkspaceWatcher();
    vi.clearAllMocks();
    electronMock.getAllWindows.mockReturnValue([]);
  });

  afterEach(() => {
    stopWorkspaceWatcher();
    vi.useRealTimers();
  });

  it("監視対象としてアクティブワークスペースのIDとパスを返す", () => {
    expect(activeWorkspaceWatchTarget(appSettings())).toEqual({
      id: "ws-1",
      path: "/tmp/notes"
    });
  });

  it("アクティブワークスペースがない場合は監視対象を返さない", () => {
    expect(activeWorkspaceWatchTarget(appSettings({ lastWorkspaceId: null }))).toBeNull();
    expect(activeWorkspaceWatchTarget(appSettings({ lastWorkspaceId: "missing" }))).toBeNull();
  });

  it("ファイル作成削除と本文変更をワークスペース変更通知の対象にする", () => {
    expect(shouldNotifyWorkspaceChangeEvent("rename")).toBe(true);
    expect(shouldNotifyWorkspaceChangeEvent("change")).toBe(true);
    expect(shouldNotifyWorkspaceChangeEvent("unknown")).toBe(false);
  });

  it("内部atomic writeの一時ファイルは通知対象外にする", () => {
    expect(shouldNotifyWorkspaceChangeEvent("rename", ".note.md.1234.1700000000000.xyz.tmp")).toBe(false);
    expect(shouldNotifyWorkspaceChangeEvent("change", ".note.md.1234.1700000000000.xyz.tmp")).toBe(false);
  });

  it("通常のMarkdownファイル変更は通知対象を維持する", () => {
    expect(shouldNotifyWorkspaceChangeEvent("rename", "note.md")).toBe(true);
    expect(shouldNotifyWorkspaceChangeEvent("change", ".note.md")).toBe(true);
  });

  it("連続イベントは静かな時間を待ちつつ最大待ち時間を超えない", () => {
    expect(workspaceChangeNotificationDelay(1000, 1000)).toBe(workspaceChangeNotifyDelayMs);
    expect(workspaceChangeNotificationDelay(1000, 2600)).toBe(400);
    expect(workspaceChangeNotificationDelay(1000, 1000 + workspaceChangeMaxNotifyDelayMs)).toBe(0);
  });

  it("監視再試行の間隔を段階的に延ばし上限を超えない", () => {
    expect(workspaceWatcherRetryDelay(0)).toBe(workspaceWatcherRetryBaseDelayMs);
    expect(workspaceWatcherRetryDelay(1)).toBe(workspaceWatcherRetryBaseDelayMs * 2);
    expect(workspaceWatcherRetryDelay(10)).toBe(workspaceWatcherRetryMaxDelayMs);
  });

  it("監視開始の失敗を再試行し長時間続いた場合だけ一度通知する", () => {
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch.mockImplementation(() => {
      throw new Error("watch failed");
    });

    syncWorkspaceWatcher(appSettings());
    expect(fsMock.watch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(workspaceWatcherFailureNotifyDelayMs);

    expect(fsMock.watch.mock.calls.length).toBeGreaterThan(1);
    expect(send).toHaveBeenCalledWith("workspace:watcherStatus", {
      changedAt: expect.any(String),
      status: "unavailable",
      workspaceId: "ws-1"
    });

    vi.advanceTimersByTime(120_000);
    expect(send.mock.calls.filter(([channel]) => channel === "workspace:watcherStatus")).toHaveLength(1);
  });

  it("監視開始に失敗しても再試行で復旧し全体再確認を通知する", () => {
    const recoveredWatcher = new FakeWatcher();
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch
      .mockImplementationOnce(() => {
        throw new Error("watch failed");
      })
      .mockReturnValueOnce(recoveredWatcher);

    syncWorkspaceWatcher(appSettings());
    vi.advanceTimersByTime(workspaceWatcherRetryBaseDelayMs);

    expect(fsMock.watch).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith("workspace:changed", {
      changedAt: expect.any(String),
      workspaceId: "ws-1"
    });
    expect(send).not.toHaveBeenCalledWith("workspace:watcherStatus", expect.anything());
  });

  it("監視中のエラー後に同じワークスペースを再監視する", () => {
    const firstWatcher = new FakeWatcher();
    const recoveredWatcher = new FakeWatcher();
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch
      .mockReturnValueOnce(firstWatcher)
      .mockReturnValueOnce(recoveredWatcher);

    syncWorkspaceWatcher(appSettings());
    firstWatcher.emitError();
    vi.advanceTimersByTime(workspaceWatcherRetryBaseDelayMs);

    expect(firstWatcher.close).toHaveBeenCalledOnce();
    expect(fsMock.watch).toHaveBeenNthCalledWith(2, "/tmp/notes", { recursive: true }, expect.any(Function));
    expect(send).toHaveBeenCalledWith("workspace:changed", {
      changedAt: expect.any(String),
      workspaceId: "ws-1"
    });
  });

  it("ワークスペース切替時に以前の再試行と失敗通知を破棄する", () => {
    const archiveWatcher = new FakeWatcher();
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch
      .mockImplementationOnce(() => {
        throw new Error("watch failed");
      })
      .mockReturnValueOnce(archiveWatcher);

    syncWorkspaceWatcher(appSettings());
    syncWorkspaceWatcher(appSettings({ lastWorkspaceId: "ws-2" }));
    vi.advanceTimersByTime(120_000);

    expect(fsMock.watch).toHaveBeenCalledTimes(2);
    expect(fsMock.watch).toHaveBeenNthCalledWith(2, "/tmp/archive", { recursive: true }, expect.any(Function));
    expect(send).not.toHaveBeenCalledWith("workspace:watcherStatus", expect.objectContaining({ workspaceId: "ws-1" }));
  });

  it("ワークスペース切替後に以前の監視イベントを反映しない", () => {
    const notesWatcher = new FakeWatcher();
    const archiveWatcher = new FakeWatcher();
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch
      .mockReturnValueOnce(notesWatcher)
      .mockReturnValueOnce(archiveWatcher);

    syncWorkspaceWatcher(appSettings());
    const oldCallback = fsMock.watch.mock.calls[0][2];
    syncWorkspaceWatcher(appSettings({ lastWorkspaceId: "ws-2" }));
    oldCallback("change", "note.md");
    vi.advanceTimersByTime(workspaceChangeNotifyDelayMs);

    expect(notesWatcher.close).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalledWith("workspace:changed", expect.objectContaining({ workspaceId: "ws-1" }));
  });

  it("停止時に再試行と失敗通知を破棄する", () => {
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);
    fsMock.watch.mockImplementation(() => {
      throw new Error("watch failed");
    });

    syncWorkspaceWatcher(appSettings());
    stopWorkspaceWatcher();
    vi.advanceTimersByTime(120_000);

    expect(fsMock.watch).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("Markdown本文のchangeだけを部分無効化の対象にする", () => {
    expect(workspaceChangeInvalidationPaths("change", "folder/note.md")).toEqual(["folder/note.md"]);
    expect(workspaceChangeInvalidationPaths("change", "folder\\note.md")).toEqual(["folder/note.md"]);
    expect(workspaceChangeInvalidationPaths("rename", "note.md")).toBeUndefined();
    expect(workspaceChangeInvalidationPaths("change", "image.png")).toBeUndefined();
    expect(workspaceChangeInvalidationPaths("change", null)).toBeUndefined();
  });

  it("ワークスペース変更通知に絶対パスを含めない", () => {
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { send }
      }
    ]);

    notifyWorkspaceChanged({ id: "ws-1", path: "/Users/alice/private notes" });

    expect(send).toHaveBeenCalledWith("workspace:changed", {
      changedAt: expect.any(String),
      workspaceId: "ws-1"
    });
    expect(send.mock.calls[0][1]).not.toHaveProperty("workspacePath");
  });
});
