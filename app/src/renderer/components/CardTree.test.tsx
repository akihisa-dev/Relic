import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CardbookTreeNode } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { CardTree, CardTreeItem, type CardTreeProps } from "./CardTree";

const tree: CardbookTreeNode[] = [
  {
    children: [
      { name: "Child", path: "CardFolder/Child.md", type: "card" },
      {
        children: [{ name: "Nested Note", path: "CardFolder/Nested/Nested Note.md", type: "card" }],
        name: "Nested",
        path: "CardFolder/Nested",
        type: "cardFolder"
      }
    ],
    name: "CardFolder",
    path: "CardFolder",
    type: "cardFolder"
  },
  { name: "Root", path: "Root.md", type: "card" }
];

function renderCardTree(overrides: Partial<CardTreeProps> = {}): Required<Pick<CardTreeProps, "onOpenCard" | "onSelectCardFolder">> & Partial<CardTreeProps> {
  const props = {
    nodes: tree,
    onOpenCard: vi.fn(),
    onSelectCardFolder: vi.fn(),
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <CardTree {...props} />
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CardTree", () => {
  it("opens cards and toggles cardFolders from rows", () => {
    const props = renderCardTree();

    fireEvent.click(rowButton("Root"));
    expect(props.onOpenCard).toHaveBeenCalledWith("Root.md", expect.any(Object));

    expect(screen.getByText("Child")).toBeInTheDocument();
    fireEvent.click(rowButton("CardFolder"));
    expect(props.onSelectCardFolder).toHaveBeenCalledWith(tree[0]);
    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    fireEvent.click(rowButton("CardFolder"));
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("commits and cancels rename from the row", () => {
    const onRenameItem = vi.fn();
    renderCardTree({ onRenameItem });

    fireEvent.doubleClick(rowButton("Root"));
    const input = screen.getByLabelText("Rename");
    fireEvent.change(input, { target: { value: " Renamed " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameItem).toHaveBeenCalledWith("Root.md", "card", "Renamed");

    cleanup();
    onRenameItem.mockClear();
    renderCardTree({ onRenameItem });

    fireEvent.doubleClick(rowButton("Root"));
    const cancelInput = screen.getByLabelText("Rename");
    fireEvent.change(cancelInput, { target: { value: "Canceled" } });
    fireEvent.keyDown(cancelInput, { key: "Escape" });

    expect(onRenameItem).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rename")).not.toBeInTheDocument();
  });

  it("runs card context menu actions", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const onDuplicateCard = vi.fn();
    const onMoveCard = vi.fn();
    const onOpenInOtherPane = vi.fn();
    const onRevealItem = vi.fn();
    const onTogglePin = vi.fn();
    const onDeleteItem = vi.fn();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Archive");
    const props = renderCardTree({
      onDeleteItem,
      onDuplicateCard,
      onMoveCard,
      onOpenInOtherPane,
      onRevealItem,
      onTogglePin
    });

    openContextMenu("Root");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(props.onOpenCard).toHaveBeenCalledWith("Root.md");

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
    fireEvent.click(screen.getByRole("menuitem", { name: "Show card location" }));
    expect(onRevealItem).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicateCard).toHaveBeenCalledWith("Root.md");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move..." }));
    expect(promptSpy).toHaveBeenCalledWith("Destination card folder", "");
    expect(onMoveCard).toHaveBeenCalledWith("Root.md", "Archive");

    openContextMenu("Root");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to Trash" }));
    expect(onDeleteItem).toHaveBeenCalledWith("Root.md", "card");
  });

  it("runs cardFolder context menu actions", () => {
    const onCreateCardInCardFolder = vi.fn();
    const onCreateCardFolderInCardFolder = vi.fn();
    const onRequestExpansion = vi.fn();

    renderCardTree({
      onCreateCardInCardFolder,
      onCreateCardFolderInCardFolder,
      onRequestExpansion
    });

    openContextMenu("CardFolder");
    fireEvent.click(screen.getByRole("menuitem", { name: "New card here" }));
    expect(onCreateCardInCardFolder).toHaveBeenCalledWith("CardFolder");

    openContextMenu("CardFolder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Create card folder here" }));
    expect(onCreateCardFolderInCardFolder).toHaveBeenCalledWith("CardFolder");

    openContextMenu("CardFolder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Expand this card folder" }));
    expect(onRequestExpansion).toHaveBeenCalledWith("expand", "CardFolder");

    openContextMenu("CardFolder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Collapse all card folders" }));
    expect(onRequestExpansion).toHaveBeenCalledWith("collapse");
  });

  it("uses selected item menu labels and handlers for multi-select", () => {
    const selectedItems = [
      { path: "Root.md", type: "card" as const },
      { path: "CardFolder", type: "cardFolder" as const }
    ];
    const onDeleteSelectedItems = vi.fn();
    const onMoveItems = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Archive");

    render(
      <I18nProvider language="en">
        <CardTreeItem
          node={tree[1]!}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onMoveItems={onMoveItems}
          onOpenCard={vi.fn()}
          onSelectCardFolder={vi.fn()}
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
});
