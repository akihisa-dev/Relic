import { describe, expect, it, vi } from "vitest";

import type { WorkspaceTreeNode } from "../shared/ipc";
import {
  addedNodePaths,
  childMotionPathsForAppearingFolder,
  contextMenuPosition,
  expansionRequestAppliesTo,
  fileTreeMarkdownLinkForPath,
  fileTreeOperationItems,
  findNodeByPath,
  movableItemsForDestination,
  moveItemsToDestination,
  normalizeDestinationFolder,
  resolveRenameCommit,
  shouldUseSelectedFileTreeItems
} from "./fileTreeModel";

const tree: WorkspaceTreeNode[] = [
  {
    children: [
      { name: "Child", path: "Folder/Child.md", type: "file" },
      {
        children: [{ name: "Nested", path: "Folder/Nested/Nested.md", type: "file" }],
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

describe("fileTreeModel", () => {
  it("finds nested nodes by workspace path", () => {
    expect(findNodeByPath(tree, "Folder/Nested/Nested.md")?.name).toBe("Nested");
    expect(findNodeByPath(tree, "Missing.md")).toBeNull();
  });

  it("normalizes destination folders from prompt input", () => {
    expect(normalizeDestinationFolder(" /Drafts\\Ideas/ ")).toBe("Drafts/Ideas");
  });

  it("formats Markdown links from tree paths", () => {
    expect(fileTreeMarkdownLinkForPath("Folder/Note.md")).toBe("[[Folder/Note]]");
    expect(fileTreeMarkdownLinkForPath("Folder/Note.markdown")).toBe("[[Folder/Note.markdown]]");
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
      { path: "Root.md", type: "file" as const },
      { path: "Folder", type: "folder" as const }
    ];

    expect(shouldUseSelectedFileTreeItems(true, selectedItems)).toBe(true);
    expect(shouldUseSelectedFileTreeItems(false, selectedItems)).toBe(false);
    expect(fileTreeOperationItems(node, selectedItems, true)).toEqual(selectedItems);
    expect(fileTreeOperationItems(node, selectedItems, false)).toEqual([{ path: "Root.md", type: "file" }]);
  });

  it("calculates added and child motion paths", () => {
    const previousPaths = new Set(["Folder", "Folder/Child.md"]);
    const added = addedNodePaths(previousPaths, tree);

    expect(added).toEqual(new Set(["Folder/Nested", "Folder/Nested/Nested.md", "Root.md"]));
    expect(childMotionPathsForAppearingFolder(tree[0]!, true)).toEqual(new Set(["Folder", "Folder/Child.md", "Folder/Nested"]));
    expect(childMotionPathsForAppearingFolder(tree[1]!, true)).toBeUndefined();
    expect(childMotionPathsForAppearingFolder(tree[0]!, false)).toBeUndefined();
  });

  it("filters no-op and invalid folder moves", () => {
    expect(movableItemsForDestination([
      { path: "Folder/Child.md", type: "file" },
      { path: "Folder", type: "folder" },
      { path: "Root.md", type: "file" }
    ], "Folder")).toEqual([{ path: "Root.md", type: "file" }]);

    expect(movableItemsForDestination([{ path: "Folder", type: "folder" }], "Folder/Nested")).toEqual([]);
  });

  it("dispatches single and multi item moves through the matching handlers", () => {
    const onMoveFile = vi.fn();
    const onMoveFolder = vi.fn();
    const onMoveItems = vi.fn();

    moveItemsToDestination([{ path: "Root.md", type: "file" }], "Archive", {
      onMoveFile,
      onMoveFolder,
      onMoveItems
    });
    expect(onMoveFile).toHaveBeenCalledWith("Root.md", "Archive");

    moveItemsToDestination([
      { path: "Root.md", type: "file" },
      { path: "Folder", type: "folder" }
    ], "Archive", {
      onMoveFile,
      onMoveFolder,
      onMoveItems
    });
    expect(onMoveItems).toHaveBeenCalledWith([
      { path: "Root.md", type: "file" },
      { path: "Folder", type: "folder" }
    ], "Archive");
  });

  it("clamps context menus to the viewport", () => {
    vi.stubGlobal("innerWidth", 240);
    vi.stubGlobal("innerHeight", 200);

    expect(contextMenuPosition(-10, 999)).toEqual({ x: 8, y: 8 });

    vi.unstubAllGlobals();
  });

  it("matches scoped expansion requests", () => {
    expect(expansionRequestAppliesTo("Folder/Nested", { action: "expand", id: 1, scopePath: "Folder" })).toBe(true);
    expect(expansionRequestAppliesTo("Other", { action: "expand", id: 1, scopePath: "Folder" })).toBe(false);
    expect(expansionRequestAppliesTo("Other", { action: "collapse", id: 2 })).toBe(true);
  });
});
