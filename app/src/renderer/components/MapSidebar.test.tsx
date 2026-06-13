import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, type WorkspaceState } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { useEditorStore, type PaneState } from "../store/editorStore";
import { MapSidebar } from "./MapSidebar";

const workspaceState: WorkspaceState = {
  activeWorkspace: { id: "ws-1", name: "Project", path: "/tmp/project" },
  fileIndex: [
    {
      kind: "markdown",
      mtimeMs: 1,
      name: "Alice.md",
      path: "characters/Alice.md",
      readStatus: "ok",
      size: 10
    },
    {
      kind: "map",
      mtimeMs: 2,
      name: "World.md",
      path: "maps/World.md",
      readStatus: "ok",
      size: 20
    },
    {
      kind: "map",
      mtimeMs: 3,
      name: "Broken.md",
      path: "maps/Broken.md",
      readStatus: "unreadable",
      size: 0
    }
  ],
  fileTree: [],
  pinnedPaths: [],
  workspaces: []
};

const emptyPane = (): PaneState => ({ activeTabId: null, history: [], tabIds: [] });

function resetStore(): void {
  useEditorStore.setState({
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: emptyPane(),
    rightPane: emptyPane(),
    tabs: {}
  });
}

function renderMapSidebar(overrides: Partial<Parameters<typeof MapSidebar>[0]> = {}) {
  const props = {
    isCreatingWorkspace: false,
    isCreatingFile: false,
    isOpeningWorkspace: false,
    onCreateMapFile: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenWorkspace: vi.fn(),
    workspaceState,
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <MapSidebar {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  resetStore();
  vi.restoreAllMocks();
});

describe("MapSidebar", () => {
  it("separates Map files from placeable Markdown files", () => {
    renderMapSidebar();

    expect(screen.getByText("Map files")).toBeInTheDocument();
    expect(screen.getByText("World.md")).toBeInTheDocument();
    expect(screen.queryByText("Broken.md")).not.toBeInTheDocument();
    expect(screen.getByText("Markdown files")).toBeInTheDocument();
    expect(screen.getByText("Alice.md")).toBeInTheDocument();
  });

  it("opens a Map file from the Map file list", () => {
    const props = renderMapSidebar();

    fireEvent.click(screen.getByRole("button", { name: /World\.md/ }));

    expect(props.onOpenFile).toHaveBeenCalledWith("maps/World.md", expect.any(Object));
  });

  it("creates a new Map file from the Map sidebar", () => {
    const props = renderMapSidebar();

    fireEvent.click(screen.getByRole("button", { name: "New Map" }));

    expect(props.onCreateMapFile).toHaveBeenCalledTimes(1);
  });

  it("adds a placeable Markdown file to the active Map tab", () => {
    const content = "type: map\n\nnodes: []\nlines: []\n";
    useEditorStore.setState({
      focusedPane: "left",
      leftPane: { activeTabId: "map-tab", history: ["map-tab"], tabIds: ["map-tab"] },
      rightPane: emptyPane(),
      tabs: {
        "map-tab": {
          content,
          id: "map-tab",
          kind: "file",
          name: "World",
          path: "maps/World.md",
          savedContent: content
        }
      }
    });
    renderMapSidebar();

    fireEvent.click(screen.getByRole("button", { name: /Alice\.md/ }));

    const tab = useEditorStore.getState().tabs["map-tab"];
    expect(tab?.kind === "file" ? tab.content : "").toContain("file: characters/Alice.md");
  });
});
