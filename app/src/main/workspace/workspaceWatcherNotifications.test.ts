import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
  invalidateWatcherEvents: vi.fn().mockReturnValue({ kind: "paths", paths: ["folder/note.md"] })
}));

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: mocks.getAllWindows }
}));

vi.mock("../files/workspaceDataInvalidation", () => ({
  workspaceMutationCoordinator: {
    invalidateWatcherEvents: mocks.invalidateWatcherEvents
  }
}));

import {
  notifyWorkspaceChanged,
  notifyWorkspaceWatcherStatus
} from "./workspaceWatcherNotifications";

describe("workspaceWatcherNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllWindows.mockReturnValue([]);
  });

  it("変更を無効化して破棄されていないウィンドウだけへ通知する", () => {
    const activeSend = vi.fn();
    const destroyedSend = vi.fn();
    mocks.getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { send: activeSend }
      },
      {
        isDestroyed: () => true,
        webContents: { send: destroyedSend }
      }
    ]);
    const events = [{ eventType: "change", filename: "folder/note.md" }];

    notifyWorkspaceChanged({ id: "ws-1", path: "/tmp/notes" }, events);

    expect(mocks.invalidateWatcherEvents).toHaveBeenCalledWith("ws-1", events);
    expect(activeSend).toHaveBeenCalledWith("workspace:changed", {
      changedAt: expect.any(String),
      kind: "paths",
      paths: ["folder/note.md"],
      revision: expect.any(Number),
      workspaceId: "ws-1"
    });
    expect(activeSend.mock.calls[0][1]).not.toHaveProperty("workspacePath");
    expect(destroyedSend).not.toHaveBeenCalled();
  });

  it("監視不能状態を無効化なしで通知する", () => {
    const send = vi.fn();
    mocks.getAllWindows.mockReturnValue([{
      isDestroyed: () => false,
      webContents: { send }
    }]);

    notifyWorkspaceWatcherStatus({ id: "ws-1", path: "/tmp/notes" });

    expect(mocks.invalidateWatcherEvents).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("workspace:watcherStatus", {
      changedAt: expect.any(String),
      status: "unavailable",
      workspaceId: "ws-1"
    });
  });

  it("ローカル保存に一致する監視イベントはRendererへ通知しない", () => {
    mocks.invalidateWatcherEvents.mockReturnValue({ kind: "none" });
    const send = vi.fn();
    mocks.getAllWindows.mockReturnValue([{ isDestroyed: () => false, webContents: { send } }]);

    notifyWorkspaceChanged({ id: "ws-1", path: "/tmp/notes" }, [{ eventType: "change", filename: "note.md" }]);

    expect(send).not.toHaveBeenCalled();
  });
});
