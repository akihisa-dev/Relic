import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { clearOutboundFileTreeDrag, FILE_TREE_OUTBOUND_FILE_DRAG_EVENT } from "../fileTreeModel";
import { I18nProvider } from "../i18n";
import { FileTree, FileTreeItem, type FileTreeProps } from "./FileTree";

const tree: WorkspaceTreeNode[] = [
  {
    children: [
      { name: "Child", path: "Folder/Child.md", type: "file" },
      {
        children: [{ name: "Nested Note", path: "Folder/Nested/Nested Note.md", type: "file" }],
        name: "Nested",
        path: "Folder/Nested",
        type: "folder"
      }
    ],
    name: "Folder",
    path: "Folder",
    type: "folder"
  },
  { name: "Root", path: "Root.md", type: "file" }
];

function renderFileTree(overrides: Partial<FileTreeProps> = {}): Required<Pick<FileTreeProps, "onOpenFile" | "onSelectFolder">> & Partial<FileTreeProps> {
  const props = {
    nodes: tree,
    onOpenFile: vi.fn(),
    onSelectFolder: vi.fn(),
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <FileTree {...props} />
    </I18nProvider>
  );

  return props;
}

function rowButton(name: string): HTMLButtonElement {
  const button = screen.getByText(name).closest("button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

function openContextMenu(name: string): void {
  fireEvent.contextMenu(rowButton(name), { clientX: 40, clientY: 50 });
}

function makeDataTransfer(files: File[] = []): DataTransfer {
  const data = new Map<string, string>();
  const types: string[] = files.length > 0 ? ["Files"] : [];
  const dataTransfer = {
    dropEffect: "none",
    effectAllowed: "all",
    files,
    getData: (type: string) => data.get(type) ?? "",
    items: [],
    setData: (type: string, value: string) => {
      data.set(type, value);
      if (!types.includes(type)) types.push(type);
    },
    types
  };

  return dataTransfer as unknown as DataTransfer;
}

function makeLargeFileTree(rowCount = 1000): WorkspaceTreeNode[] {
  const files = Array.from({ length: rowCount }, (_, index) => ({
    name: `ノート${index + 1}`,
    path: `notes/ノート${index + 1}.md`,
    type: "file" as const
  }));

  return [
    ...files,
    {
      children: [{ name: "nested", path: "LargeFolder/詳細.md", type: "file" }],
      name: "LargeFolder",
      path: "LargeFolder",
      type: "folder"
    }
  ];
}

function makeProgressiveFolder(): WorkspaceTreeNode[] {
  return [{
    children: [
      ...Array.from({ length: 12 }, (_, index) => ({
        name: `Note ${index + 1}`,
        path: `Folder/Note ${index + 1}.md`,
        type: "file" as const
      })),
      {
        children: [{ name: "Nested note", path: "Folder/Nested/Nested note.md", type: "file" as const }],
        name: "Nested",
        path: "Folder/Nested",
        type: "folder" as const
      }
    ],
    name: "Folder",
    path: "Folder",
    type: "folder" as const
  }];
}

afterEach(() => {
  clearOutboundFileTreeDrag();
  cleanup();
  vi.restoreAllMocks();
});

describe("FileTree", () => {
  it("rootに表示行数を保持する", () => {
    const { container } = render(
      <I18nProvider language="en">
        <FileTree
          isRoot
          nodes={tree}
          onOpenFile={vi.fn()}
          onSelectFolder={vi.fn()}
        />
      </I18nProvider>
    );

    expect(container.querySelector(":scope > .file-tree")).toHaveAttribute("data-visible-row-count", "5");
  });

  it("opens files and toggles folders from rows", () => {
    const props = renderFileTree();

    fireEvent.click(rowButton("Root"));
    expect(props.onOpenFile).toHaveBeenCalledWith("Root.md", expect.any(Object));

    expect(screen.getByText("Child")).toBeInTheDocument();
    fireEvent.click(rowButton("Folder"));
    expect(props.onSelectFolder).toHaveBeenCalledWith(tree[0]);
    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    fireEvent.click(rowButton("Folder"));
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("フォルダ直下のファイルを10件に制限し、子フォルダと件数を常に表示する", () => {
    renderFileTree({ nodes: makeProgressiveFolder() });

    expect(screen.getByText("12 files")).toBeInTheDocument();
    expect(screen.getByText("Note 10")).toBeInTheDocument();
    expect(screen.queryByText("Note 11")).not.toBeInTheDocument();
    expect(screen.getByText("Nested")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 remaining" })).toBeInTheDocument();
  });

  it("続きを表示しても選択を変えず、フォルダを閉じると段階表示へ戻す", () => {
    const onSelectItem = vi.fn(() => true);
    renderFileTree({
      nodes: makeProgressiveFolder(),
      onSelectItem,
      selectedItems: [{ path: "Folder/Note 1.md", type: "file" }],
      selectedPaths: new Set(["Folder/Note 1.md"])
    });

    fireEvent.click(screen.getByRole("button", { name: "Show 2 remaining" }));
    expect(screen.getByText("Note 12")).toBeInTheDocument();
    expect(rowButton("Note 1")).toHaveClass("selected");
    expect(onSelectItem).not.toHaveBeenCalled();

    fireEvent.click(rowButton("Folder"));
    fireEvent.click(rowButton("Folder"));
    expect(screen.queryByText("Note 12")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 remaining" })).toBeInTheDocument();
  });

  it.each([
    ["選択中", { selectedPaths: new Set(["Folder/Note 12.md"]) }],
    ["開いている", { openFilePaths: new Set(["Folder/Note 12.md"]) }],
    ["作成直後", { openingFilePath: "Folder/Note 12.md" }]
  ])("初期範囲外の%sファイルがあれば自動的に全件表示する", (_label, overrides) => {
    renderFileTree({ nodes: makeProgressiveFolder(), ...overrides });

    expect(screen.getByText("Note 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show 2 remaining" })).not.toBeInTheDocument();
  });

  it("例外表示を開始した後は対象状態が消えてもフォルダを閉じるまで全件表示を維持する", () => {
    const nodes = makeProgressiveFolder();
    const { rerender } = render(
      <I18nProvider language="en">
        <FileTree
          nodes={nodes}
          onOpenFile={vi.fn()}
          onSelectFolder={vi.fn()}
          selectedPaths={new Set(["Folder/Note 12.md"])}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Note 12")).toBeInTheDocument();
    rerender(
      <I18nProvider language="en">
        <FileTree
          nodes={nodes}
          onOpenFile={vi.fn()}
          onSelectFolder={vi.fn()}
          selectedPaths={new Set()}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Note 12")).toBeInTheDocument();
  });

  it("does not keep a visual open highlight for already-open files", () => {
    renderFileTree({ openFilePaths: new Set(["Root.md"]) });

    expect(rowButton("Root")).not.toHaveClass("open");
  });

  it("大規模rootツリーではopening演出を抑制し、子ツリーへopeningFilePathを伝播しない", () => {
    const largeTreeNodes = makeLargeFileTree();

    const { container } = render(
      <I18nProvider language="en">
        <FileTree
          isRoot
          nodes={largeTreeNodes}
          onOpenFile={vi.fn()}
          onSelectFolder={vi.fn()}
          openingFilePath="LargeFolder/詳細.md"
        />
      </I18nProvider>
    );

    const rootTree = container.querySelector(".file-tree");
    expect(rootTree).not.toBeNull();
    expect(rootTree).toHaveAttribute("data-visible-row-count", "1002");
    expect(rootTree).toHaveClass("file-tree--large");
    expect(screen.getByText("ノート1000").closest("button")).not.toHaveClass("file-tree-row--opening");
    expect(screen.getByText("nested").closest("button")).not.toHaveClass("file-tree-row--opening");
  });

  it("commits and cancels rename from the row", () => {
    const onRenameItem = vi.fn();
    renderFileTree({ onRenameItem });

    fireEvent.doubleClick(rowButton("Root"));
    const input = screen.getByLabelText("Rename");
    expect(input.closest("button")).toBeNull();
    fireEvent.change(input, { target: { value: " Renamed " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameItem).toHaveBeenCalledWith("Root.md", "file", "Renamed");

    cleanup();
    onRenameItem.mockClear();
    renderFileTree({ onRenameItem });

    fireEvent.doubleClick(rowButton("Root"));
    const cancelInput = screen.getByLabelText("Rename");
    fireEvent.change(cancelInput, { target: { value: "Canceled" } });
    fireEvent.keyDown(cancelInput, { key: "Escape" });

    expect(onRenameItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rename")).not.toBeInTheDocument();
  });

  it("runs file context menu actions", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const onDuplicateFile = vi.fn();
    const onMoveFile = vi.fn();
    const onOpenInOtherPane = vi.fn();
    const onRevealItem = vi.fn();
    const onTogglePin = vi.fn();
    const onDeleteItem = vi.fn();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Archive");
    const props = renderFileTree({
      onDeleteItem,
      onDuplicateFile,
      onMoveFile,
      onOpenInOtherPane,
      onRevealItem,
      onTogglePin
    });

    openContextMenu("Root");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(props.onOpenFile).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Open in Other Pane" }));
    expect(onOpenInOtherPane).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
    expect(onTogglePin).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy path" }));
    expect(writeText).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy Markdown link" }));
    expect(writeText).toHaveBeenCalledWith("[[Root]]");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Show in folder" }));
    expect(onRevealItem).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicateFile).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move..." }));
    expect(promptSpy).toHaveBeenCalledWith("Destination folder", "");
    expect(onMoveFile).toHaveBeenCalledWith("Root.md", "Archive");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Trash" }));
    expect(onDeleteItem).toHaveBeenCalledWith("Root.md", "file");
  });

  it("runs folder context menu actions", () => {
    const onCreateFileInFolder = vi.fn();
    const onCreateFolderInFolder = vi.fn();
    const onRequestExpansion = vi.fn();

    renderFileTree({
      onCreateFileInFolder,
      onCreateFolderInFolder,
      onRequestExpansion
    });

    openContextMenu("Folder");
    fireEvent.click(screen.getByRole("menuitem", { name: "New file here" }));
    expect(onCreateFileInFolder).toHaveBeenCalledWith("Folder");

    openContextMenu("Folder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Create folder here" }));
    expect(onCreateFolderInFolder).toHaveBeenCalledWith("Folder");

    openContextMenu("Folder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Expand this folder" }));
    expect(onRequestExpansion).toHaveBeenCalledWith("expand", "Folder");

    openContextMenu("Folder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Collapse all folders" }));
    expect(onRequestExpansion).toHaveBeenCalledWith("collapse");
  });

  it("uses selected item menu labels and handlers for multi-select", () => {
    const selectedItems = [
      { path: "Root.md", type: "file" as const },
      { path: "Folder", type: "folder" as const }
    ];
    const onDeleteSelectedItems = vi.fn();
    const onMoveItems = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Archive");

    render(
      <I18nProvider language="en">
        <FileTreeItem
          node={tree[1]!}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onMoveItems={onMoveItems}
          onOpenFile={vi.fn()}
          onSelectFolder={vi.fn()}
          selectedItems={selectedItems}
          selectedPaths={new Set(["Root.md"])}
        />
      </I18nProvider>
    );

    openContextMenu("Root");
    expect(screen.queryByRole("menuitem", { name: "Open" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move Selected Items..." })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move Selected Items to Trash" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Move Selected Items..." }));
    expect(onMoveItems).toHaveBeenCalledWith(selectedItems, "Archive");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move Selected Items to Trash" }));
    expect(onDeleteSelectedItems).toHaveBeenCalled();
  });

  it("drags a file into a folder when external attachment drag is unavailable", () => {
    const onMoveFile = vi.fn();
    renderFileTree({ onMoveFile });
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(rowButton("Root"), { dataTransfer });
    fireEvent.dragOver(rowButton("Folder"), { dataTransfer });
    fireEvent.drop(rowButton("Folder"), { dataTransfer });

    expect(onMoveFile).toHaveBeenCalledWith("Root.md", "Folder");
  });

  it("starts only an external attachment drag with selected files", () => {
    const startWorkspaceFileDrag = vi.fn();
    Object.defineProperty(window, "relic", {
      configurable: true,
      value: { startWorkspaceFileDrag }
    });
    renderFileTree({
      selectedItems: [
        { path: "Root.md", type: "file" },
        { path: "Folder", type: "folder" },
        { path: "Folder/Child.md", type: "file" }
      ],
      selectedPaths: new Set(["Root.md"])
    });
    const dataTransfer = makeDataTransfer();
    const dragStartEvent = createEvent.dragStart(rowButton("Root"), { dataTransfer });

    fireEvent(rowButton("Root"), dragStartEvent);

    expect(dragStartEvent.defaultPrevented).toBe(true);
    expect(startWorkspaceFileDrag).toHaveBeenCalledWith({ paths: ["Root.md", "Folder/Child.md"] });
  });

  it("moves a file from an attachment drag when it is dropped inside the file tree", () => {
    const startWorkspaceFileDrag = vi.fn();
    const onImportMarkdownFiles = vi.fn();
    const onMoveFile = vi.fn();
    Object.defineProperty(window, "relic", {
      configurable: true,
      value: { startWorkspaceFileDrag }
    });
    renderFileTree({ onImportMarkdownFiles, onMoveFile });

    fireEvent.dragStart(rowButton("Root"), { dataTransfer: makeDataTransfer() });
    const dataTransfer = makeDataTransfer([new File(["# Root"], "Root.md", { type: "text/markdown" })]);
    fireEvent.dragOver(rowButton("Folder"), { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("move");
    fireEvent.drop(rowButton("Folder"), { dataTransfer });

    expect(onMoveFile).toHaveBeenCalledWith("Root.md", "Folder");
    expect(onImportMarkdownFiles).not.toHaveBeenCalled();
  });

  it("does not start an attachment drag for folders without selected files", () => {
    const startWorkspaceFileDrag = vi.fn();
    Object.defineProperty(window, "relic", {
      configurable: true,
      value: { startWorkspaceFileDrag }
    });
    renderFileTree();

    fireEvent.dragStart(rowButton("Folder"), { dataTransfer: makeDataTransfer() });

    expect(startWorkspaceFileDrag).not.toHaveBeenCalled();
  });

  it("drops external files into a folder for import", () => {
    const onImportMarkdownFiles = vi.fn();
    const file = new File(["# Dropped"], "Dropped.md", { type: "text/markdown" });
    Object.defineProperty(window, "relic", {
      configurable: true,
      value: {
        getDroppedFilePath: vi.fn().mockReturnValue("/tmp/Dropped.md")
      }
    });

    renderFileTree({ onImportMarkdownFiles });
    const dataTransfer = makeDataTransfer([file]);

    fireEvent.dragOver(rowButton("Folder"), { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");
    fireEvent.drop(rowButton("Folder"), { dataTransfer });

    expect(onImportMarkdownFiles).toHaveBeenCalledWith(["/tmp/Dropped.md"], "Folder");
  });

  it("drops external files onto the root file list for import", () => {
    const onImportMarkdownFiles = vi.fn();
    const file = new File(["# Root"], "Root Import.md", { type: "text/markdown" });
    Object.defineProperty(window, "relic", {
      configurable: true,
      value: {
        getDroppedFilePath: vi.fn().mockReturnValue("/tmp/Root Import.md")
      }
    });

    renderFileTree({ isRoot: true, onImportMarkdownFiles });
    const dataTransfer = makeDataTransfer([file]);
    const fileTree = document.querySelector(".file-tree");
    expect(fileTree).toBeInstanceOf(HTMLUListElement);

    fireEvent.dragOver(fileTree as HTMLUListElement, { dataTransfer });
    expect(fileTree).toHaveClass("file-tree--external-drag-over");
    fireEvent.drop(fileTree as HTMLUListElement, { dataTransfer });

    expect(onImportMarkdownFiles).toHaveBeenCalledWith(["/tmp/Root Import.md"], "");
  });

  it("does not keep the root import highlight during outbound attachment drags", () => {
    const onImportMarkdownFiles = vi.fn();
    const file = new File(["# Root"], "Root Import.md", { type: "text/markdown" });
    renderFileTree({ isRoot: true, onImportMarkdownFiles });
    const dataTransfer = makeDataTransfer([file]);
    const fileTree = document.querySelector(".file-tree");
    expect(fileTree).toBeInstanceOf(HTMLUListElement);

    window.dispatchEvent(new Event(FILE_TREE_OUTBOUND_FILE_DRAG_EVENT));
    fireEvent.dragOver(fileTree as HTMLUListElement, { dataTransfer });

    expect(fileTree).not.toHaveClass("file-tree--external-drag-over");
  });
});
