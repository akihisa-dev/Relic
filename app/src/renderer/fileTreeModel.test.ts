import { describe, expect, it, vi } from "vitest";

import type { WorkspaceTreeNode } from "../shared/ipc";
import {
  contextMenuPosition,
  expansionRequestAppliesTo,
  findNodeByPath,
  movableItemsForDestination,
  moveItemsToDestination,
  normalizeDestinationFolder
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
