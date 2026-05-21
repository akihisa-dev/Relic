import { describe, expect, it, vi } from "vitest";

import type { CardbookTreeNode } from "../shared/ipc";
import {
  addedNodePaths,
  childMotionPathsForAppearingCardFolder,
  contextMenuPosition,
  expansionRequestAppliesTo,
  cardTreeMarkdownLinkForPath,
  cardTreeOperationItems,
  findNodeByPath,
  movableItemsForDestination,
  moveItemsToDestination,
  normalizeDestinationCardFolder,
  parseCardTreeDragPayload,
  resolveRenameCommit,
  serializeCardTreeDragPayload,
  shouldUseSelectedCardTreeItems
} from "./cardTreeModel";

const tree: CardbookTreeNode[] = [
  {
    children: [
      { name: "Child", path: "CardFolder/Child.md", type: "card" },
      {
        children: [{ name: "Nested", path: "CardFolder/Nested/Nested.md", type: "card" }],
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

describe("cardTreeModel", () => {
  it("finds nested nodes by cardbook path", () => {
    expect(findNodeByPath(tree, "CardFolder/Nested/Nested.md")?.name).toBe("Nested");
    expect(findNodeByPath(tree, "Missing.md")).toBeNull();
  });

  it("normalizes destination cardFolders from prompt input", () => {
    expect(normalizeDestinationCardFolder(" /Drafts\\Ideas/ ")).toBe("Drafts/Ideas");
  });

  it("formats Markdown links from tree paths", () => {
    expect(cardTreeMarkdownLinkForPath("CardFolder/Note.md")).toBe("[[CardFolder/Note]]");
    expect(cardTreeMarkdownLinkForPath("CardFolder/Note.markdown")).toBe("[[CardFolder/Note.markdown]]");
  });

  it("resolves rename commits from drafts", () => {
    expect(resolveRenameCommit("Note", "  New Note  ")).toEqual({
      nextName: "New Note",
      shouldCommit: true
    });
    expect(resolveRenameCommit("Note", " Note ")).toEqual({
      nextName: "Note",
      shouldCommit: false
    });
    expect(resolveRenameCommit("Note", "   ")).toEqual({
      nextName: "",
      shouldCommit: false
    });
  });

  it("selects single or multi operation items", () => {
    const node = tree[1]!;
    const selectedItems = [
      { path: "Root.md", type: "card" as const },
      { path: "CardFolder", type: "cardFolder" as const }
    ];

    expect(shouldUseSelectedCardTreeItems(true, selectedItems)).toBe(true);
    expect(shouldUseSelectedCardTreeItems(false, selectedItems)).toBe(false);
    expect(cardTreeOperationItems(node, selectedItems, true)).toEqual(selectedItems);
    expect(cardTreeOperationItems(node, selectedItems, false)).toEqual([{ path: "Root.md", type: "card" }]);
  });

  it("serializes and parses card tree drag payloads", () => {
    const items = [
      { path: "Root.md", type: "card" as const },
      { path: "CardFolder", type: "cardFolder" as const }
    ];

    expect(parseCardTreeDragPayload(serializeCardTreeDragPayload(items))).toEqual(items);
    expect(parseCardTreeDragPayload(JSON.stringify({ path: "Root.md", type: "card" }))).toEqual([{ path: "Root.md", type: "card" }]);
    expect(parseCardTreeDragPayload("")).toEqual([]);
    expect(parseCardTreeDragPayload("{")).toEqual([]);
  });

  it("calculates added and child motion paths", () => {
    const previousPaths = new Set(["CardFolder", "CardFolder/Child.md"]);
    const added = addedNodePaths(previousPaths, tree);

    expect(added).toEqual(new Set(["CardFolder/Nested", "CardFolder/Nested/Nested.md", "Root.md"]));
    expect(childMotionPathsForAppearingCardFolder(tree[0]!, true)).toEqual(new Set(["CardFolder", "CardFolder/Child.md", "CardFolder/Nested"]));
    expect(childMotionPathsForAppearingCardFolder(tree[1]!, true)).toBeUndefined();
    expect(childMotionPathsForAppearingCardFolder(tree[0]!, false)).toBeUndefined();
  });

  it("filters no-op and invalid cardFolder moves", () => {
    expect(movableItemsForDestination([
      { path: "CardFolder/Child.md", type: "card" },
      { path: "CardFolder", type: "cardFolder" },
      { path: "Root.md", type: "card" }
    ], "CardFolder")).toEqual([{ path: "Root.md", type: "card" }]);

    expect(movableItemsForDestination([{ path: "CardFolder", type: "cardFolder" }], "CardFolder/Nested")).toEqual([]);
  });

  it("dispatches single and multi item moves through the matching handlers", () => {
    const onMoveCard = vi.fn();
    const onMoveCardFolder = vi.fn();
    const onMoveItems = vi.fn();

    moveItemsToDestination([{ path: "Root.md", type: "card" }], "Archive", {
      onMoveCard,
      onMoveCardFolder,
      onMoveItems
    });
    expect(onMoveCard).toHaveBeenCalledWith("Root.md", "Archive");

    moveItemsToDestination([
      { path: "Root.md", type: "card" },
      { path: "CardFolder", type: "cardFolder" }
    ], "Archive", {
      onMoveCard,
      onMoveCardFolder,
      onMoveItems
    });
    expect(onMoveItems).toHaveBeenCalledWith([
      { path: "Root.md", type: "card" },
      { path: "CardFolder", type: "cardFolder" }
    ], "Archive");
  });

  it("clamps context menus to the viewport", () => {
    vi.stubGlobal("innerWidth", 240);
    vi.stubGlobal("innerHeight", 200);

    expect(contextMenuPosition(-10, 999)).toEqual({ x: 8, y: 8 });

    vi.unstubAllGlobals();
  });

  it("matches scoped expansion requests", () => {
    expect(expansionRequestAppliesTo("CardFolder/Nested", { action: "expand", id: 1, scopePath: "CardFolder" })).toBe(true);
    expect(expansionRequestAppliesTo("Other", { action: "expand", id: 1, scopePath: "CardFolder" })).toBe(false);
    expect(expansionRequestAppliesTo("Other", { action: "collapse", id: 2 })).toBe(true);
  });
});
