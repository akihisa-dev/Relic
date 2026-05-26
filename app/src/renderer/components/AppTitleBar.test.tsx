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
    onRevealTabFile: vi.fn(),
    onRightPanelViewButton: vi.fn(),
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
    showRightPanelControls: true,
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
