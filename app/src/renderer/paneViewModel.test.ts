import { describe, expect, it } from "vitest";

import { createTranslator } from "./i18n";
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
    const cardTab: Tab = { content: "", id: "tab-card", kind: "card", name: "Note", path: "Note.md" };
    const timelineTab: Tab = { chartId: "timeline", id: "timeline-timeline", kind: "timeline", name: "Timeline" };

    expect(panelTabLabel("frontmatter", t)).toBe("Properties");
    expect(panelTabLabel("timeline-settings", t)).toBe("Timeline Settings");
    expect(panelTabLabel("settings", t)).toBe("Settings");
    expect(panelTabLabel("tools", t)).toBe("Tools");
    expect(paneTabLabel(panelTab, t)).toBe("Properties");
    expect(paneTabLabel(cardTab, t)).toBe("Note");
    expect(paneTabLabel(timelineTab, t)).toBe("Timeline");
    expect(paneTabLabel(null, t)).toBe("");
  });

  it("counts characters and whitespace-delimited words", () => {
    expect(textCount("one two\nthree")).toEqual({ chars: 13, words: 3 });
    expect(textCount("  ")).toEqual({ chars: 2, words: 0 });
  });

  it("formats Markdown links from card tab paths", () => {
    expect(markdownLinkForPaneTabPath("CardFolder/Note.md")).toBe("[[CardFolder/Note]]");
    expect(markdownLinkForPaneTabPath("CardFolder/Note.markdown")).toBe("[[CardFolder/Note.markdown]]");
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
