import { describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn().mockReturnValue([])
}));

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: electronMock.getAllWindows }
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
  workspaceChangeNotificationDelay,
  workspaceChangeNotifyDelayMs,
  workspaceChangeMaxNotifyDelayMs
} from "./workspaceWatcher";

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
