import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, type WorkspaceState } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { useEditorStore, type PaneState } from "../store/editorStore";
import { diagramShapeDragType } from "./diagram/diagramShapeDrag";
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
  it("shows Diagram files and hides unreadable entries", () => {
    renderDiagramSidebar();

    expect(screen.getByText("Diagram files")).toBeInTheDocument();
    expect(screen.getByText("World.md")).toBeInTheDocument();
    expect(screen.queryByText("Broken.md")).not.toBeInTheDocument();
    expect(screen.queryByText("Markdown files")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice.md")).not.toBeInTheDocument();
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

  it("creates a Diagram file from the Diagram sidebar", () => {
    const props = renderDiagramSidebar();

    fireEvent.click(screen.getByRole("button", { name: "New Diagram file" }));

    expect(props.onCreateDiagramFile).toHaveBeenCalledWith("diagram");
  });

  it("shows grouped Diagram shapes above Diagram files for an active Diagram file", () => {
    const content = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    useEditorStore.setState({
      focusedPane: "left",
      leftPane: { activeTabId: "free-tab", history: ["free-tab"], tabIds: ["free-tab"] },
      rightPane: emptyPane(),
      tabs: {
        "free-tab": {
          content,
          id: "free-tab",
          kind: "file",
          name: "Free",
          path: "diagrams/Free.md",
          savedContent: content
        }
      }
    });
    renderDiagramSidebar();

    expect(screen.getByText("Shape palette")).toBeInTheDocument();
    expect(screen.getByText("Basic flow")).toBeInTheDocument();
    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getByText("Shape palette").compareDocumentPosition(screen.getByText("Diagram files"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("button", { name: "Start / End" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Process" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Input / Output" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Label" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Area" })).toBeInTheDocument();
    expect(screen.queryByText("Markdown files")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alice\.md/ })).not.toBeInTheDocument();
  });

  it("adds a Diagram shape from the sidebar by click when no canvas handles the request", () => {
    const content = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    useEditorStore.setState({
      focusedPane: "left",
      leftPane: { activeTabId: "free-tab", history: ["free-tab"], tabIds: ["free-tab"] },
      rightPane: emptyPane(),
      tabs: {
        "free-tab": {
          content,
          id: "free-tab",
          kind: "file",
          name: "Free",
          path: "diagrams/Free.md",
          savedContent: content
        }
      }
    });
    renderDiagramSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Decision" }));

    const tab = useEditorStore.getState().tabs["free-tab"];
    expect(tab?.kind === "file" ? tab.content : "").toContain("shape: decision");
  });

  it("starts dragging a flowchart shape from the sidebar", () => {
    const content = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    const setData = vi.fn();
    useEditorStore.setState({
      focusedPane: "left",
      leftPane: { activeTabId: "free-tab", history: ["free-tab"], tabIds: ["free-tab"] },
      rightPane: emptyPane(),
      tabs: {
        "free-tab": {
          content,
          id: "free-tab",
          kind: "file",
          name: "Free",
          path: "diagrams/Free.md",
          savedContent: content
        }
      }
    });
    renderDiagramSidebar();

    fireEvent.dragStart(screen.getByRole("button", { name: "Decision" }), {
      dataTransfer: {
        effectAllowed: "",
        setData
      }
    });

    expect(setData).toHaveBeenCalledWith(diagramShapeDragType, "decision");
  });

});
