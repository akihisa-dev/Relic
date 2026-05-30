import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) }
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
  shouldNotifyWorkspaceChangeEvent,
  workspaceChangeNotificationDelay,
  workspaceChangeNotifyDelayMs,
  workspaceChangeMaxNotifyDelayMs
} from "./workspaceWatcher";

function appSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    aiSettings: { aiProvider: "codex-app-server", openAIModel: "gpt-5.4-mini" },
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

  it("連続イベントは静かな時間を待ちつつ最大待ち時間を超えない", () => {
    expect(workspaceChangeNotificationDelay(1000, 1000)).toBe(workspaceChangeNotifyDelayMs);
    expect(workspaceChangeNotificationDelay(1000, 2600)).toBe(400);
    expect(workspaceChangeNotificationDelay(1000, 1000 + workspaceChangeMaxNotifyDelayMs)).toBe(0);
  });
});
