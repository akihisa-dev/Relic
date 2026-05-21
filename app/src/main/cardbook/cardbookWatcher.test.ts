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
import { activeCardbookWatchTarget } from "./cardbookWatcher";

function appSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    editorSettings: defaultEditorSettings,
    featureToggles: defaultFeatureToggles,
    frontmatterTemplates: defaultFrontmatterTemplates,
    lastCardbookId: "ws-1",
    userDefinedFields: defaultUserDefinedFields,
    cardbooks: [
      { id: "ws-1", name: "Notes", path: "/tmp/notes" },
      { id: "ws-2", name: "Archive", path: "/tmp/archive" }
    ],
    ...overrides
  };
}

describe("cardbookWatcher", () => {
  it("監視対象としてアクティブカードブックのIDとパスを返す", () => {
    expect(activeCardbookWatchTarget(appSettings())).toEqual({
      id: "ws-1",
      path: "/tmp/notes"
    });
  });

  it("アクティブカードブックがない場合は監視対象を返さない", () => {
    expect(activeCardbookWatchTarget(appSettings({ lastCardbookId: null }))).toBeNull();
    expect(activeCardbookWatchTarget(appSettings({ lastCardbookId: "missing" }))).toBeNull();
  });
});
