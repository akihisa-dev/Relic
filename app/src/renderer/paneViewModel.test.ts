import { describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import {
  dataTransferHasPaneTab,
  markdownLinkForPaneTabPath,
  paneTabDropPosition,
  paneTabLabel,
  panelTabLabel,
  parsePaneTabDragPayload,
  PANE_TAB_DRAG_MIME,
  readPaneTabDragPayload,
  serializePaneTabDragPayload,
  textCount
} from "./paneViewModel";
import type { Tab } from "./store/editorStore";

const t = createTranslator("en");

describe("paneViewModel", () => {
  it("labels panel tabs through translations and other tabs by name", () => {
    const panelTab: Tab = { id: "panel-frontmatter", kind: "panel", name: "ignored", panel: "frontmatter" };
    const fileTab: Tab = { content: "", id: "tab-file", kind: "file", name: "Note", path: "Note.md", savedContent: "" };
    const chartTab: Tab = { chartId: "chronicle", id: "chart-chronicle", kind: "chart", name: "Chronicle" };

    expect(panelTabLabel("frontmatter", t)).toBe("Frontmatter");
    expect(panelTabLabel("settings", t)).toBe("Settings");
    expect(panelTabLabel("tools", t)).toBe("Tools");
    expect(paneTabLabel(panelTab, t)).toBe("Frontmatter");
    expect(paneTabLabel(fileTab, t)).toBe("Note");
    expect(paneTabLabel(chartTab, t)).toBe("Chronicle");
    expect(paneTabLabel(null, t)).toBe("");
  });

  it("counts characters and whitespace-delimited words", () => {
    expect(textCount("one two\nthree")).toEqual({ chars: 13, words: 3 });
    expect(textCount("  ")).toEqual({ chars: 2, words: 0 });
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
