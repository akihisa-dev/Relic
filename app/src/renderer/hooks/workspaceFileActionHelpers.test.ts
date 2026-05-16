import { describe, expect, it } from "vitest";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import type { Tab } from "../store/editorStore";
import {
  buildFolderTabPathUpdates,
  findCreatedMarkdownPath,
  getMovableTreeItems,
  matchesAnyTreeItemPath,
  matchesTreeItemPath,
  nextUniqueFileName,
  nextUniqueFolderName,
  removeCoveredItems
} from "./workspaceFileActionHelpers";

function workspaceState(fileTree: WorkspaceTreeNode[]): WorkspaceState {
  return {
    activeWorkspace: null,
    fileTree,
    pinnedPaths: [],
    workspaces: []
  };
}

describe("workspaceFileActionHelpers", () => {
  it("フォルダ配下に含まれる項目を重複対象から除外する", () => {
    expect(removeCoveredItems([
      { path: "A", type: "folder" },
      { path: "A/note.md", type: "file" },
      { path: "A/B", type: "folder" },
      { path: "C.md", type: "file" }
    ])).toEqual([
      { path: "A", type: "folder" },
      { path: "C.md", type: "file" }
    ]);
  });

  it("移動先自身と子孫フォルダへの移動を除外する", () => {
    expect(getMovableTreeItems([
      { path: "A", type: "folder" },
      { path: "B", type: "folder" },
      { path: "C.md", type: "file" }
    ], "A/Child")).toEqual([
      { path: "B", type: "folder" },
      { path: "C.md", type: "file" }
    ]);

    expect(getMovableTreeItems([{ path: "A", type: "folder" }], "A")).toEqual([]);
  });

  it("rootに存在する名前を避けて次の新規ファイル名とフォルダ名を返す", () => {
    const state = workspaceState([
      { name: "新規ファイル.md", path: "新規ファイル.md", type: "file" },
      { name: "新規ファイル 2.md", path: "新規ファイル 2.md", type: "file" },
      {
        children: [
          { name: "新規フォルダ", path: "Parent/新規フォルダ", type: "folder", children: [] }
        ],
        name: "Parent",
        path: "Parent",
        type: "folder"
      },
      { name: "新規フォルダ", path: "新規フォルダ", type: "folder", children: [] }
    ]);

    expect(nextUniqueFileName(state)).toBe("新規ファイル 3");
    expect(nextUniqueFolderName(state)).toBe("新規フォルダ 2");
  });

  it("作成後のMarkdown pathを末尾一致で探す", () => {
    const tree: WorkspaceTreeNode[] = [
      {
        children: [
          { name: "Note.md", path: "Folder/Note.md", type: "file" }
        ],
        name: "Folder",
        path: "Folder",
        type: "folder"
      }
    ];

    expect(findCreatedMarkdownPath(tree, "Note.md")).toBe("Folder/Note.md");
    expect(findCreatedMarkdownPath(tree, "Missing.md")).toBeNull();
  });

  it("フォルダ移動後の配下タブ更新を組み立てる", () => {
    const tabs: Record<string, Tab> = {
      "tab-a": { content: "", id: "tab-a", kind: "file", name: "One", path: "A/One.md" },
      "tab-b": { content: "", id: "tab-b", kind: "file", name: "Two", path: "A/Nested/Two.md" },
      "tab-c": { content: "", id: "tab-c", kind: "file", name: "Other", path: "Other.md" },
      "panel-tools": { id: "panel-tools", kind: "panel", name: "Tools", panel: "tools" }
    };

    expect(buildFolderTabPathUpdates(tabs, "A", "Dest/A")).toEqual([
      { name: "One", path: "Dest/A/One.md", tabId: "tab-a" },
      { name: "Two", path: "Dest/A/Nested/Two.md", tabId: "tab-b" }
    ]);
  });

  it("削除対象のfile/folder pathにタブpathが含まれるか判定する", () => {
    expect(matchesTreeItemPath("A.md", { path: "A.md", type: "file" })).toBe(true);
    expect(matchesTreeItemPath("A/Note.md", { path: "A", type: "folder" })).toBe(true);
    expect(matchesTreeItemPath("A-Other/Note.md", { path: "A", type: "folder" })).toBe(false);
    expect(matchesAnyTreeItemPath("B/Note.md", [
      { path: "A.md", type: "file" },
      { path: "B", type: "folder" }
    ])).toBe(true);
  });
});
