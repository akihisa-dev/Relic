import { describe, expect, it } from "vitest";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { createTranslator } from "../i18nModel";
import type { Tab } from "../store/editorStore";
import {
  buildFolderTabPathUpdates,
  findCreatedMarkdownPath,
  getMovableTreeItems,
  matchesAnyTreeItemPath,
  matchesTreeItemPath,
  nextUniqueFileName,
  nextUniqueDiagramFileName,
  nextUniqueFolderName,
  removeCoveredItems
} from "./workspaceFileActionHelpers";

const t = createTranslator("ja");

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

    expect(nextUniqueFileName(state, t)).toBe("新規ファイル 3");
    expect(nextUniqueFolderName(state, t)).toBe("新規フォルダ 2");
  });

  it("rootに存在する図解名を避けて次のDiagramファイル名を返す", () => {
    const state = workspaceState([
      { name: "関係図.md", path: "関係図.md", type: "file" },
      { name: "関係図 2.md", path: "関係図 2.md", type: "file" },
      { name: "原因分析.md", path: "原因分析.md", type: "file" },
      {
        children: [
          { name: "関係図.md", path: "Nested/関係図.md", type: "file" }
        ],
        name: "Nested",
        path: "Nested",
        type: "folder"
      }
    ]);

    expect(nextUniqueDiagramFileName(state, t, "relationship")).toBe("関係図 3");
    expect(nextUniqueDiagramFileName(state, t, "why-tree")).toBe("原因分析 2");
    expect(nextUniqueDiagramFileName(state, t, "why-tree", "トラブル振り返り")).toBe("トラブル振り返り");
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
      "tab-a": { content: "", id: "tab-a", kind: "file", name: "One", path: "A/One.md", savedContent: "" },
      "tab-b": { content: "", id: "tab-b", kind: "file", name: "Two", path: "A/Nested/Two.md", savedContent: "" },
      "tab-c": { content: "", id: "tab-c", kind: "file", name: "Other", path: "Other.md", savedContent: "" },
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
