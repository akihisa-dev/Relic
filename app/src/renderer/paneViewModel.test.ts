import { describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import {
  dataTransferHasPaneTab,
  markdownLinkForPaneTabPath,
  paneTabsPresentationKey,
  paneTabDropPosition,
  paneTabLabel,
  panelTabLabel,
  parsePaneTabDragPayload,
  PANE_TAB_DRAG_MIME,
  readPaneTabDragPayload,
  serializePaneTabDragPayload,
  textCount,
  updateTextCount
} from "./paneViewModel";
import type { Tab } from "./store/editorStore";
import {
  __getTextChangeRangeScannedCharactersForTests,
  __resetTextChangeRangeScannedCharactersForTests
} from "./textChangeRange";

const t = createTranslator("en");

describe("paneViewModel", () => {
  it("タブ表示キーは本文変更を無視し、名前や固定状態の変更だけを検出する", () => {
    const tab = { content: "before", id: "tab", kind: "file" as const, name: "Note", path: "Note.md", savedContent: "saved" };
    const initial = paneTabsPresentationKey([tab.id], { [tab.id]: tab });

    expect(paneTabsPresentationKey([tab.id], { [tab.id]: { ...tab, content: "after" } })).toBe(initial);
    expect(paneTabsPresentationKey([tab.id], { [tab.id]: { ...tab, name: "Renamed" } })).not.toBe(initial);
    expect(paneTabsPresentationKey([tab.id], { [tab.id]: { ...tab, isPinned: true } })).not.toBe(initial);
  });

  it("labels panel tabs through translations and file tabs by name", () => {
    const panelTab: Tab = { id: "panel-frontmatter", kind: "panel", name: "ignored", panel: "frontmatter" };
    const fileTab: Tab = { content: "", id: "tab-file", kind: "file", name: "Note", path: "Note.md", savedContent: "" };

    expect(panelTabLabel("frontmatter", t)).toBe("Frontmatter");
    expect(panelTabLabel("settings", t)).toBe("Settings");
    expect(paneTabLabel(panelTab, t)).toBe("Frontmatter");
    expect(paneTabLabel(fileTab, t)).toBe("Note");
    expect(paneTabLabel(null, t)).toBe("");
  });

  it("labels built-in chart tabs using the current display language", () => {
    const ja = createTranslator("ja");
    const chartTabs: Tab[] = [
      { chartId: "cards", id: "chart-cards", kind: "chart", name: "stale" },
      { chartId: "table", id: "chart-table", kind: "chart", name: "stale" },
      { chartId: "graph", id: "chart-graph", kind: "chart", name: "stale" },
      { chartId: "sphere", id: "chart-sphere", kind: "chart", name: "stale" },
      { chartId: "chronicle", id: "chart-chronicle", kind: "chart", name: "stale" }
    ];

    expect(chartTabs.map((tab) => paneTabLabel(tab, ja))).toEqual([
      "カード",
      "テーブル",
      "グラフ",
      "スフィア",
      "クロニクル"
    ]);
    expect(chartTabs.map((tab) => paneTabLabel(tab, t))).toEqual([
      "Cards",
      "Table",
      "Graph",
      "Sphere",
      "Chronicle"
    ]);
  });

  it("preserves the stored name for unknown chart tabs", () => {
    const chartTab: Tab = { chartId: "custom", id: "chart-custom", kind: "chart", name: "Custom chart" };

    expect(paneTabLabel(chartTab, createTranslator("ja"))).toBe("Custom chart");
  });

  it("counts characters and whitespace-delimited words", () => {
    expect(textCount("one two\nthree")).toEqual({ chars: 13, words: 3 });
    expect(textCount("  ")).toEqual({ chars: 2, words: 0 });
  });

  it("updates counts across changed word boundaries", () => {
    const initial = updateTextCount(null, "one two\n三");

    expect(updateTextCount(initial, "one merged word\n三四")).toMatchObject({
      chars: "one merged word\n三四".length,
      words: 4
    });
    expect(updateTextCount(initial, "onetwo\n三")).toMatchObject({ words: 2 });
  });

  it("CodeMirror由来の変更範囲がある通常入力では本文比較走査を行わない", () => {
    const original = "one two\n三";
    const initial = updateTextCount(null, original, 1);
    const content = "one two!\n三";
    __resetTextChangeRangeScannedCharactersForTests();

    const updated = updateTextCount(initial, content, 2, {
      change: { from: 7, newTo: 8, oldTo: 7 },
      generation: 1,
      previousRevision: 1,
      revision: 2
    });

    expect(updated).toMatchObject({ chars: content.length, words: 3 });
    expect(__getTextChangeRangeScannedCharactersForTests()).toBe(0);
  });

  it("formats Markdown links from file tab paths", () => {
    expect(markdownLinkForPaneTabPath("Folder/Note.md")).toBe("[[Folder/Note]]");
    expect(markdownLinkForPaneTabPath("Folder/Note.markdown")).toBe("[[Folder/Note.markdown]]");
  });

  it("serializes and parses tab drag payloads", () => {
    const serialized = serializePaneTabDragPayload({ fromPane: "left", tabId: "tab-a" });

    expect(parsePaneTabDragPayload(serialized)).toEqual({ fromPane: "left", tabId: "tab-a" });
    expect(parsePaneTabDragPayload("")).toBeNull();
    expect(parsePaneTabDragPayload("{bad")).toBeNull();
    expect(parsePaneTabDragPayload(JSON.stringify({ fromPane: "left" }))).toBeNull();
  });

  it("reads drag payloads and detects the tab MIME type", () => {
    const dataTransfer = {
      getData: (type: string) => type === PANE_TAB_DRAG_MIME
        ? serializePaneTabDragPayload({ fromPane: "right", tabId: "tab-b" })
        : ""
    };

    expect(readPaneTabDragPayload(dataTransfer)).toEqual({ fromPane: "right", tabId: "tab-b" });
    expect(dataTransferHasPaneTab(["text/plain", PANE_TAB_DRAG_MIME])).toBe(true);
    expect(dataTransferHasPaneTab(["text/plain"])).toBe(false);
  });

  it("detects before/after drop positions from the tab midpoint", () => {
    const rect = { left: 100, width: 80 };

    expect(paneTabDropPosition(120, rect)).toBe("before");
    expect(paneTabDropPosition(140, rect)).toBe("after");
    expect(paneTabDropPosition(180, rect)).toBe("after");
  });
});
