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
import { activeWorkspaceWatchTarget } from "./workspaceWatcher";

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
});
