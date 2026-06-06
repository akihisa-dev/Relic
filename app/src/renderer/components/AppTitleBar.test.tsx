import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const secondFileTab: Tab = {
  content: "second note",
  id: "tab-second-file",
  kind: "file",
  name: "Second",
  path: "Folder/Second.md",
  savedContent: "second note"
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
  it("renders tabs in the title bar and keeps extra tab buttons hidden", () => {
    const props = renderTitleBar();
    const tab = screen.getByText("Note", { selector: ".pane-tab-name" }).closest(".pane-tab");

    expect(document.querySelector(".title-bar .pane-tab-bar")).toBeInTheDocument();
    expect(tab).toBeInstanceOf(HTMLElement);
    expect(screen.getByText("Note", { selector: ".pane-tab-name" })).toHaveAttribute("data-extension", ".md");
    expect(screen.queryByTitle("Scroll tabs left")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Scroll tabs right")).not.toBeInTheDocument();
    expect(screen.queryByTitle("New empty tab")).not.toBeInTheDocument();

    fireEvent.click(tab as HTMLElement);
    expect(props.onTabSelect).toHaveBeenCalledWith("left", fileTab.id);

    fireEvent.click(screen.getByTitle("Close tab"));
    expect(props.onTabClose).toHaveBeenCalledWith("left", fileTab.id);
  });

  it("renders multiple title bar tabs as selectable controls", () => {
    const props = renderTitleBar({
      leftPane: {
        activeTabId: fileTab.id,
        history: [fileTab.id],
        tabIds: [fileTab.id, secondFileTab.id]
      },
      tabs: {
        [fileTab.id]: { ...fileTab, isPinned: true },
        [secondFileTab.id]: secondFileTab
      }
    });

    const secondTab = screen.getByText("Second", { selector: ".pane-tab-name" }).closest(".pane-tab");

    expect(document.querySelectorAll(".title-bar .pane-tab")).toHaveLength(2);
    expect(secondTab).toBeInstanceOf(HTMLElement);

    fireEvent.click(secondTab as HTMLElement);
    expect(props.onTabSelect).toHaveBeenCalledWith("left", secondFileTab.id);
  });

  it("分割表示では左右ペインのタブ領域を別レーンとして表示する", () => {
    renderTitleBar({
      isSplit: true,
      leftPane: { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
      rightPane: { activeTabId: secondFileTab.id, history: [secondFileTab.id], tabIds: [secondFileTab.id] },
      tabs: {
        [fileTab.id]: fileTab,
        [secondFileTab.id]: secondFileTab
      }
    });

    const titleBarTabs = document.querySelector(".title-bar-tabs");
    const leftLane = document.querySelector(".title-bar-tabs .pane-tabs--left");
    const rightLane = document.querySelector(".title-bar-tabs .pane-tabs--right");

    expect(titleBarTabs).toHaveClass("title-bar-tabs--split");
    expect(leftLane?.querySelectorAll(".pane-tab")).toHaveLength(1);
    expect(rightLane?.querySelectorAll(".pane-tab")).toHaveLength(1);
    expect(leftLane).toHaveTextContent("Note");
    expect(rightLane).toHaveTextContent("Second");
  });

  it("keeps preview output actions out of the title bar buttons", () => {
    renderTitleBar();

    expect(screen.queryByRole("button", { name: "Print" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as PDF" })).toBeNull();
  });

  it("keeps the title bar background when no tabs are open", () => {
    renderTitleBar({
      leftPane: emptyPane(),
      tabs: {}
    });

    expect(document.querySelector(".title-bar-tabs")).toHaveClass("title-bar-tabs--empty");
    expect(document.querySelector(".title-bar-tabs .pane-tabs")).toHaveClass("pane-tabs--empty");
    expect(document.querySelector(".title-bar-tabs .pane-tab-bar-shell")).toHaveClass("pane-tab-bar-shell--empty");
    expect(document.querySelector(".title-bar .pane-tab")).toBeNull();
  });

  it("keeps gaps around title bar action buttons draggable", () => {
    const shellCss = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(shellCss).toMatch(/\.title-bar-tabs\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(shellCss).toMatch(/\.title-bar-actions\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(shellCss).toMatch(/\.title-bar \.main-area-actions\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(shellCss).toMatch(/\.title-bar \.main-area-actions \.toolbar-btn\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
    expect(editorCss).toMatch(/\.pane-tab-close\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar\s*\{[^}]*scrollbar-width:\s*none;/s);
  });

  it("keeps title bar tabs compact and shrinkable inside the available tab lane", () => {
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(editorCss).toMatch(/\.pane-tab-bar\s*\{[^}]*gap:\s*4px;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar\s*\{[^}]*width:\s*100%;/s);
    expect(editorCss).toMatch(/\.pane-tabs\s*\{[^}]*overflow:\s*hidden;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*flex:\s*1 1 132px;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*max-width:\s*220px;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*min-width:\s*64px;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*padding:\s*0 8px;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar--fit \.pane-tab\s*\{[^}]*flex-basis:\s*104px;/s);
    expect(editorCss).toMatch(/\.pane-tab-name\s*\{[^}]*min-width:\s*0;/s);
  });

  it("分割表示のタブレーンを境界線と内側余白で管理する", () => {
    const shellCss = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(shellCss).toMatch(/\.title-bar-tabs\s*\{[^}]*overflow:\s*hidden;/s);
    expect(editorCss).toMatch(/\.title-bar-tabs--split \.pane-tabs--left\.pane-tabs--has-tabs\s*\{[^}]*inset -1px 0 0 var\(--border\)/s);
    expect(editorCss).toMatch(/\.title-bar-tabs--split \.pane-tabs--right\.pane-tabs--has-tabs\s*\{[^}]*inset 1px 0 0 var\(--border\)/s);
    expect(editorCss).toMatch(/\.title-bar-tabs--split \.pane-tab-bar-shell\s*\{[^}]*padding-inline:\s*8px;/s);
  });

  it("keeps title bar tabs on the editor surface without moving them below the title bar", () => {
    const shellCss = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(shellCss).toMatch(/\.app-shell\s*\{[^}]*grid-template-rows:\s*52px minmax\(0, 1fr\) 34px;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar-shell\s*\{[^}]*height:\s*52px;/s);
    expect(shellCss).toMatch(/\.title-bar-tabs\s*\{[^}]*background:\s*var\(--title-bar-bg\);/s);
    expect(shellCss).toMatch(/\.title-bar-tabs--has-tabs\s*\{[^}]*background:\s*var\(--surface\);/s);
    expect(shellCss).toMatch(/\.title-bar-tabs--has-tabs\s*\{[^}]*box-shadow:\s*inset 0 -1px 0 var\(--border\);/s);
    expect(editorCss).toMatch(/\.pane-tabs\s*\{[^}]*background:\s*transparent;/s);
    expect(editorCss).toMatch(/\.pane-tabs--has-tabs\s*\{[^}]*background:\s*var\(--surface\);/s);
    expect(editorCss).toMatch(/\.pane-tab-bar-shell\s*\{[^}]*background:\s*transparent;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar-shell--has-tabs\s*\{[^}]*background:\s*var\(--surface\);/s);
    expect(designCss).toMatch(/\.title-bar-tabs--has-tabs,\s*\.title-bar \.pane-tabs--has-tabs,\s*\.title-bar \.pane-tabs--has-tabs \.pane-tab-bar,\s*\.title-bar \.pane-tab-bar-shell--has-tabs\s*\{[^}]*background:\s*var\(--color-surface-elevated\);/s);
  });

  it("lets title bar action tooltips render above the workspace layer", () => {
    const css = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");

    expect(css).toMatch(/\.title-bar\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*position:\s*relative;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*z-index:\s*40;/s);
  });

  it("keeps the title bar background separate from the document surface", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(designCss).toMatch(/--title-bar-bg:\s*var\(--color-surface-alt\);/);
    expect(designCss).toMatch(/--surface:\s*var\(--color-surface-elevated\);/);
    expect(designCss).toMatch(/\.title-bar,\s*\.title-bar \.main-area-actions\s*\{[^}]*background:\s*var\(--title-bar-bg\);/s);
    expect(designCss).toMatch(/\.main-area-actions \.toolbar-btn\.active\s*\{[^}]*box-shadow:\s*none;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--surface-subtle\) 82%, var\(--surface\) 18%\);/s);
    expect(editorCss).toMatch(/\.pane-tab--active\s*\{[^}]*background:\s*var\(--surface\);/s);
  });

  it("does not render diagonal blue panel decorations", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(designCss).not.toMatch(/clip-path:\s*polygon/);
    expect(designCss).not.toMatch(/\.workspace::before/);
    expect(designCss).not.toMatch(/\.workspace::after/);
    expect(designCss).not.toMatch(/\.sidebar::after/);
    expect(designCss).not.toMatch(/\.secondary-sidebar::after/);
    expect(designCss).not.toMatch(/\.right-panel::before/);
  });

});
