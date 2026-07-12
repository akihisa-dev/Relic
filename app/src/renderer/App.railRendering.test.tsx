import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const railWorkspaceSwitcherRender = vi.hoisted(() => vi.fn());

vi.mock("./components/RailWorkspaceSwitcher", () => ({
  RailWorkspaceSwitcher: (props: unknown) => {
    railWorkspaceSwitcherRender(props);
    return <div data-testid="rail-workspace-switcher" />;
  }
}));

import { renderApp } from "./appTestHelpers";
import { useEditorStore } from "./store/editorStore";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState
} from "../test/rendererTestUtils";

describe("App rail rendering", () => {
  beforeAll(installMatchMediaMock);

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    resetRendererStores();
  });

  it("本文更新ではRailを再描画せず、タブ構成変更では再描画する", async () => {
    useEditorStore.setState({
      leftPane: { activeTabId: "tab-note", history: [], tabIds: ["tab-note"] },
      tabs: {
        "tab-note": {
          content: "本文",
          id: "tab-note",
          kind: "file",
          name: "Note.md",
          path: "Note.md",
          savedContent: "本文"
        }
      }
    });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...testWorkspaceState,
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      })
    });

    renderApp();
    await screen.findByTestId("rail-workspace-switcher");
    railWorkspaceSwitcherRender.mockClear();

    act(() => useEditorStore.getState().updateTabContent("tab-note", "改稿"));

    expect(railWorkspaceSwitcherRender).not.toHaveBeenCalled();

    act(() => useEditorStore.getState().openPanelInPane("left", "settings", "Settings"));

    expect(railWorkspaceSwitcherRender).toHaveBeenCalledTimes(1);
  });
});
