import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, type WorkspaceState } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { useEditorStore, type PaneState } from "../store/editorStore";
import { DiagramSidebar } from "./DiagramSidebar";

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
      kind: "diagram",
      mtimeMs: 2,
      name: "World.md",
      path: "diagrams/World.md",
      readStatus: "ok",
      size: 20
    },
    {
      kind: "diagram",
      mtimeMs: 3,
      name: "Broken.md",
      path: "diagrams/Broken.md",
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

function renderDiagramSidebar(overrides: Partial<Parameters<typeof DiagramSidebar>[0]> = {}) {
  const props = {
    isCreatingWorkspace: false,
    isCreatingFile: false,
    isOpeningWorkspace: false,
    onCreateDiagramFile: vi.fn(),
    onCreateWorkspace: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenWorkspace: vi.fn(),
    workspaceState,
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <DiagramSidebar {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  resetStore();
  vi.restoreAllMocks();
});

describe("DiagramSidebar", () => {
  it("separates Diagram files from placeable Markdown files", () => {
    renderDiagramSidebar();

    expect(screen.getByText("Diagram files")).toBeInTheDocument();
    expect(screen.getByText("World.md")).toBeInTheDocument();
    expect(screen.queryByText("Broken.md")).not.toBeInTheDocument();
    expect(screen.getByText("Markdown files")).toBeInTheDocument();
    expect(screen.getByText("Alice.md")).toBeInTheDocument();
  });

  it("opens a Diagram file from the Diagram file list", () => {
    const props = renderDiagramSidebar();

    fireEvent.click(screen.getByRole("button", { name: /World\.md/ }));

    expect(props.onOpenFile).toHaveBeenCalledWith("diagrams/World.md", expect.any(Object));
  });

  it("moves a Diagram file to trash from the Diagram file context menu", () => {
    const onDeleteItem = vi.fn();
    renderDiagramSidebar({ onDeleteItem });

    fireEvent.contextMenu(screen.getByRole("button", { name: /World\.md/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Trash" }));

    expect(onDeleteItem).toHaveBeenCalledWith("diagrams/World.md", "file");
  });

  it("creates relationship and why-tree files from the Diagram sidebar", () => {
    const props = renderDiagramSidebar();

    fireEvent.click(screen.getByRole("button", { name: "New relationship" }));
    fireEvent.click(screen.getByRole("button", { name: "New structure tree" }));

    expect(props.onCreateDiagramFile).toHaveBeenNthCalledWith(1, "relationship");
    expect(props.onCreateDiagramFile).toHaveBeenNthCalledWith(2, "why-tree");
  });

  it("adds a placeable Markdown file to the active Diagram tab", () => {
    const content = "---\ntype: relationship\n---\n\nnodes: []\nlines: []\n";
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
          path: "diagrams/World.md",
          savedContent: content
        }
      }
    });
    renderDiagramSidebar();

    fireEvent.click(screen.getByRole("button", { name: /Alice\.md/ }));

    const tab = useEditorStore.getState().tabs["map-tab"];
    expect(tab?.kind === "file" ? tab.content : "").toContain("file: characters/Alice.md");
  });

  it("does not place Markdown files into an active why-tree Diagram", () => {
    const content = [
      "---",
      "type: why-tree",
      "---",
      "",
      "labels:",
      "  root: ルート",
      "  node: ノード",
      "  fact: メモ",
      "  solution: 関連項目",
      "  action: アクション",
      "phenomenon:",
      "  title: 問題",
      "  facts: []",
      "  solutions: []",
      "  actions: []",
      ""
    ].join("\n");
    useEditorStore.setState({
      focusedPane: "left",
      leftPane: { activeTabId: "why-tab", history: ["why-tab"], tabIds: ["why-tab"] },
      rightPane: emptyPane(),
      tabs: {
        "why-tab": {
          content,
          id: "why-tab",
          kind: "file",
          name: "Why",
          path: "diagrams/Why.md",
          savedContent: content
        }
      }
    });
    renderDiagramSidebar();

    const placeButton = screen.getByRole("button", { name: /Alice\.md/ });
    expect(placeButton).toBeDisabled();
    fireEvent.click(placeButton);

    const tab = useEditorStore.getState().tabs["why-tab"];
    expect(tab?.kind === "file" ? tab.content : "").toBe(content);
  });
});
