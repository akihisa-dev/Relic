import { describe, expect, it } from "vitest";

import type { CardbookState, CardbookTreeNode } from "../../shared/ipc";
import { createTranslator } from "../i18n";
import type { Tab } from "../store/editorStore";
import {
  buildCardFolderTabPathUpdates,
  findCreatedMarkdownPath,
  getMovableTreeItems,
  matchesAnyTreeItemPath,
  matchesTreeItemPath,
  nextUniqueCardName,
  nextUniqueCardFolderName,
  removeCoveredItems
} from "./cardbookCardActionHelpers";

const t = createTranslator("ja");

function cardbookState(cardTree: CardbookTreeNode[]): CardbookState {
  return {
    activeCardbook: null,
    cardTree,
    pinnedPaths: [],
    cardbooks: []
  };
}

describe("cardbookCardActionHelpers", () => {
  it("カードフォルダ配下に含まれる項目を重複対象から除外する", () => {
    expect(removeCoveredItems([
      { path: "A", type: "cardFolder" },
      { path: "A/note.md", type: "card" },
      { path: "A/B", type: "cardFolder" },
      { path: "C.md", type: "card" }
    ])).toEqual([
      { path: "A", type: "cardFolder" },
      { path: "C.md", type: "card" }
    ]);
  });

  it("移動先自身と子孫カードフォルダへの移動を除外する", () => {
    expect(getMovableTreeItems([
      { path: "A", type: "cardFolder" },
      { path: "B", type: "cardFolder" },
      { path: "C.md", type: "card" }
    ], "A/Child")).toEqual([
      { path: "B", type: "cardFolder" },
      { path: "C.md", type: "card" }
    ]);

    expect(getMovableTreeItems([{ path: "A", type: "cardFolder" }], "A")).toEqual([]);
  });

  it("rootに存在する名前を避けて次の新規カード名とカードフォルダ名を返す", () => {
    const state = cardbookState([
      { name: "新規カード.md", path: "新規カード.md", type: "card" },
      { name: "新規カード 2.md", path: "新規カード 2.md", type: "card" },
      {
        children: [
          { name: "新規カードフォルダ", path: "Parent/新規カードフォルダ", type: "cardFolder", children: [] }
        ],
        name: "Parent",
        path: "Parent",
        type: "cardFolder"
      },
      { name: "新規カードフォルダ", path: "新規カードフォルダ", type: "cardFolder", children: [] }
    ]);

    expect(nextUniqueCardName(state, t)).toBe("新規カード 3");
    expect(nextUniqueCardFolderName(state, t)).toBe("新規カードフォルダ 2");
  });

  it("作成後のMarkdown pathを末尾一致で探す", () => {
    const tree: CardbookTreeNode[] = [
      {
        children: [
          { name: "Note.md", path: "CardFolder/Note.md", type: "card" }
        ],
        name: "CardFolder",
        path: "CardFolder",
        type: "cardFolder"
      }
    ];

    expect(findCreatedMarkdownPath(tree, "Note.md")).toBe("CardFolder/Note.md");
    expect(findCreatedMarkdownPath(tree, "Missing.md")).toBeNull();
  });

  it("カードフォルダ移動後の配下タブ更新を組み立てる", () => {
    const tabs: Record<string, Tab> = {
      "tab-a": { content: "", id: "tab-a", kind: "card", name: "One", path: "A/One.md" },
      "tab-b": { content: "", id: "tab-b", kind: "card", name: "Two", path: "A/Nested/Two.md" },
      "tab-c": { content: "", id: "tab-c", kind: "card", name: "Other", path: "Other.md" },
      "panel-tools": { id: "panel-tools", kind: "panel", name: "Tools", panel: "tools" }
    };

    expect(buildCardFolderTabPathUpdates(tabs, "A", "Dest/A")).toEqual([
      { name: "One", path: "Dest/A/One.md", tabId: "tab-a" },
      { name: "Two", path: "Dest/A/Nested/Two.md", tabId: "tab-b" }
    ]);
  });

  it("削除対象のcard/cardFolder pathにタブpathが含まれるか判定する", () => {
    expect(matchesTreeItemPath("A.md", { path: "A.md", type: "card" })).toBe(true);
    expect(matchesTreeItemPath("A/Note.md", { path: "A", type: "cardFolder" })).toBe(true);
    expect(matchesTreeItemPath("A-Other/Note.md", { path: "A", type: "cardFolder" })).toBe(false);
    expect(matchesAnyTreeItemPath("B/Note.md", [
      { path: "A.md", type: "card" },
      { path: "B", type: "cardFolder" }
    ])).toBe(true);
  });
});
