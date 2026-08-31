import { act, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const railWorkspaceSwitcherRender = vi.hoisted(() => vi.fn());

vi.mock("./components/RailWorkspaceSwitcher", () => ({
  RailWorkspaceSwitcher: (props: unknown) => {
    railWorkspaceSwitcherRender(props);
    return <div data-testid="rail-workspace-switcher" />;
  }
}));

vi.mock("./components/SphereView", () => ({
  SphereView: () => null
}));

import { renderApp } from "./appTestHelpers";
import {
  __getPaneViewRenderCountsForTests,
  __resetPaneViewRenderCountsForTests
} from "./components/PaneView";
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

    await renderApp();
    await screen.findByTestId("rail-workspace-switcher");
    railWorkspaceSwitcherRender.mockClear();

    act(() => useEditorStore.getState().updateTabContent("tab-note", "改稿"));

    expect(railWorkspaceSwitcherRender).not.toHaveBeenCalled();

    act(() => useEditorStore.getState().openPanelInPane("left", "settings", "Settings"));

    expect(railWorkspaceSwitcherRender).toHaveBeenCalledTimes(1);
  });

  it("左ペインの本文更新ではApp経由の右ペインpropsを変えない", async () => {
    useEditorStore.setState({
      focusedPane: "left",
      isSplit: true,
      leftPane: { activeTabId: "tab-left", history: [], tabIds: ["tab-left"] },
      rightPane: { activeTabId: "tab-right", history: [], tabIds: ["tab-right"] },
      tabs: {
        "tab-left": {
          content: "左本文",
          id: "tab-left",
          kind: "file",
          name: "Left.md",
          path: "Left.md",
          savedContent: "左本文"
        },
        "tab-right": {
          content: "右本文",
          id: "tab-right",
          kind: "file",
          name: "Right.md",
          path: "Right.md",
          savedContent: "右本文"
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

    await renderApp();
    await screen.findByText("右本文");
    __resetPaneViewRenderCountsForTests();

    act(() => useEditorStore.getState().updateTabContent("tab-left", "左の改稿"));

    const renderCounts = __getPaneViewRenderCountsForTests();
    expect(renderCounts.left).toBeGreaterThan(0);
    expect(renderCounts.right).toBe(0);
  });
});
