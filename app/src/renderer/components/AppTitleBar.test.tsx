import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import type { PaneState, Tab } from "../store/editorStore";
import { AppTitleBar } from "./AppTitleBar";

const emptyPane = (): PaneState => ({ activeTabId: null, history: [], tabIds: [] });

const fileTab: Tab = {
  content: "hello world",
  id: "tab-file",
  kind: "file",
  name: "Note",
  path: "Folder/Note.md",
  savedContent: "hello world"
};

function renderTitleBar(overrides: Partial<Parameters<typeof AppTitleBar>[0]> = {}): Parameters<typeof AppTitleBar>[0] {
  const tabs: Record<string, Tab> = {
    [fileTab.id]: { ...fileTab, isPinned: true }
  };
  const props: Parameters<typeof AppTitleBar>[0] = {
    isRightPanelOpen: false,
    isSourceMode: false,
    isSplit: false,
    leftClosingTabIds: new Set(),
    leftOffsetWidth: 88,
    leftPane: { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
    onCloseAllTabsInPane: vi.fn(),
    onCloseOtherTabs: vi.fn(),
    onCloseTabsToRight: vi.fn(),
    onDuplicateTabFile: vi.fn(),
    onOpenInOtherPane: vi.fn(),
    onPrintPreview: vi.fn(),
    onRevealTabFile: vi.fn(),
    onRightPanelViewButton: vi.fn(),
    onSavePreviewAsPdf: vi.fn(),
    onSourceModeToggle: vi.fn(),
    onSplitToggle: vi.fn(),
    onTabClose: vi.fn(),
    onTabMove: vi.fn(),
    onTabSelect: vi.fn(),
    onTogglePinTab: vi.fn(),
    renderPanelTabIcon: () => <svg data-testid="panel-tab-icon" />,
    rightClosingTabIds: new Set(),
    rightPane: emptyPane(),
    rightPanelView: "outline",
    rightPanelWidth: 240,
    showRightPanelLinksControl: true,
    showRightPanelOutlineControl: true,
    tabs,
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <AppTitleBar {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppTitleBar", () => {
  it("keeps tabs out of the title bar so panes own the tab strip", () => {
    renderTitleBar();

    expect(document.querySelector(".title-bar .pane-tab-bar")).toBeNull();
    expect(document.querySelector(".title-bar .pane-tab")).toBeNull();
  });

  it("keeps preview output actions out of the title bar buttons", () => {
    renderTitleBar();

    expect(screen.queryByRole("button", { name: "Print" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as PDF" })).toBeNull();
  });

  it("keeps gaps around title bar action buttons draggable", () => {
    const css = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");

    expect(css).toMatch(/\.title-bar-actions\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(css).toMatch(/\.title-bar \.main-area-actions\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(css).toMatch(/\.title-bar \.main-area-actions \.toolbar-btn\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
  });

  it("lets title bar action tooltips render above the workspace layer", () => {
    const css = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");

    expect(css).toMatch(/\.title-bar\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*position:\s*relative;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*z-index:\s*40;/s);
  });

});
