import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  content: "second",
  id: "tab-second",
  kind: "file",
  name: "Second",
  path: "Second.md",
  savedContent: "second"
};

function makeFileTab(id: string, name: string): Tab {
  return {
    content: name,
    id,
    kind: "file",
    name,
    path: `${name}.md`,
    savedContent: name
  };
}

function renderTitleBar(overrides: Partial<Parameters<typeof AppTitleBar>[0]> = {}): Parameters<typeof AppTitleBar>[0] {
  const tabs: Record<string, Tab> = {
    [fileTab.id]: { ...fileTab, isPinned: true },
    [secondFileTab.id]: secondFileTab
  };
  const props: Parameters<typeof AppTitleBar>[0] = {
    isRightPanelOpen: false,
    isSourceMode: false,
    isSplit: false,
    leftClosingTabIds: new Set(),
    leftOffsetWidth: 88,
    leftPane: { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id, secondFileTab.id] },
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

function tabElement(name: string): HTMLElement {
  const tab = screen.getByText(name, { selector: ".pane-tab-name" }).closest(".pane-tab");
  expect(tab).toBeInstanceOf(HTMLElement);
  return tab as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppTitleBar", () => {
  it("selects and closes tabs from the title bar", () => {
    const props = renderTitleBar();

    expect(within(tabElement("Note")).getByTestId("pane-tab-pin-icon")).toBeInTheDocument();
    expect(tabElement("Note").firstElementChild).toBe(within(tabElement("Note")).getByTestId("pane-tab-pin-icon"));
    expect(within(tabElement("Second")).queryByTestId("pane-tab-pin-icon")).toBeNull();

    fireEvent.click(tabElement("Second"));
    expect(props.onTabSelect).toHaveBeenCalledWith("left", secondFileTab.id);

    fireEvent.click(screen.getAllByTitle("Close tab")[1]);
    expect(props.onTabClose).toHaveBeenCalledWith("left", secondFileTab.id);
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

  it("renders title bar tabs in a shrinking tab strip instead of requiring horizontal scrolling", () => {
    const manyTabs = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const tab = makeFileTab(`tab-${index}`, `Long note ${index}`);
        return [tab.id, tab];
      })
    );
    const tabIds = Object.keys(manyTabs);

    renderTitleBar({
      leftPane: { activeTabId: tabIds[0], history: [tabIds[0]], tabIds },
      tabs: manyTabs
    });

    const tabBar = document.querySelector(".title-bar .pane-tab-bar");
    const tabs = document.querySelectorAll(".title-bar .pane-tab");

    expect(tabBar).toBeInstanceOf(HTMLElement);
    expect(tabBar).toHaveClass("pane-tab-bar--fit");
    expect(tabs).toHaveLength(12);
  });

  it("runs file tab context menu actions without changing menu labels or clipboard text", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const props = renderTitleBar({
      isSplit: true,
      leftPane: { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
      tabs: { [fileTab.id]: fileTab }
    });

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    const contextMenu = screen.getByRole("button", { name: "Pin" }).closest(".tab-context-menu");
    expect(contextMenu?.parentElement).toBe(document.body);
    expect(contextMenu).toHaveStyle({ zIndex: "10000" });
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(props.onTogglePinTab).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(props.onDuplicateTabFile).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Copy path" }));
    expect(writeText).toHaveBeenCalledWith(fileTab.path);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown link" }));
    expect(writeText).toHaveBeenCalledWith("[[Folder/Note]]");

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(props.onPrintPreview).toHaveBeenCalledWith(fileTab);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
    expect(props.onSavePreviewAsPdf).toHaveBeenCalledWith(fileTab);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Show in folder" }));
    expect(props.onRevealTabFile).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Open in Other Pane" }));
    expect(props.onOpenInOtherPane).toHaveBeenCalledWith("left", fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Other Tabs" }));
    expect(props.onCloseOtherTabs).toHaveBeenCalledWith("left", fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Tabs to the Right" }));
    expect(props.onCloseTabsToRight).toHaveBeenCalledWith("left", fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close All Tabs" }));
    expect(props.onCloseAllTabsInPane).toHaveBeenCalledWith("left");
  });
});
