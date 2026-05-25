import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";

import { defaultEditorSettings } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { useEditorStore, type PaneState, type Tab } from "../store/editorStore";
import { PaneView, type PaneViewProps } from "./PaneView";

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

const panelTab: Tab = {
  id: "panel-frontmatter",
  kind: "panel",
  name: "Frontmatter",
  panel: "frontmatter"
};

const ganttTab: Tab = {
  chartId: "chronicle",
  id: "gantt-chronicle",
  kind: "gantt",
  name: "Chronicle"
};

function resetStore(): void {
  useEditorStore.setState({
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: emptyPane(),
    rightPane: emptyPane(),
    tabs: {}
  });
}

function setPaneState(tabs: Record<string, Tab>, leftPane: PaneState, rightPane: PaneState = emptyPane()): void {
  useEditorStore.setState({
    focusedPane: "left",
    leftPane,
    rightPane,
    tabs
  });
}

function renderPaneView(overrides: Partial<PaneViewProps> = {}): PaneViewProps {
  const props: PaneViewProps = {
    allFilePaths: [],
    closingTabIds: new Set(),
    editorActionPulse: 0,
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    frontmatterCandidates: {},
    isSplitView: false,
    pane: "left",
    renderGanttChartTab: (chartId) => <div>Gantt {chartId}</div>,
    renderPanelTab: (panel) => <div>Panel {panel}</div>,
    renderPanelTabIcon: () => <svg data-testid="panel-tab-icon" />,
    sourceMode: false,
    typewriterMode: false,
    userDefinedFields: [],
    viewRef: { current: null } as MutableRefObject<EditorView | null>,
    workspacePath: "/workspace",
    onCloseAllTabs: vi.fn(),
    onCloseOtherTabs: vi.fn(),
    onCloseTabsToRight: vi.fn(),
    onCreateFile: vi.fn(),
    onDuplicateTabFile: vi.fn(),
    onFileSaved: vi.fn(),
    onFocus: vi.fn(),
    onOpenInOtherPane: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenWikiLink: vi.fn(),
    onRenameFile: vi.fn(),
    onRevealTabFile: vi.fn(),
    onScrollTargetHandled: vi.fn(),
    onTabClose: vi.fn(),
    onTabMove: vi.fn(),
    onTabSelect: vi.fn(),
    onTogglePinTab: vi.fn(),
    scrollTargetHeading: undefined,
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <PaneView {...props} />
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
  resetStore();
  vi.restoreAllMocks();
});

describe("PaneView", () => {
  it("selects and closes tabs from the tab bar", () => {
    setPaneState(
      { [fileTab.id]: { ...fileTab, isPinned: true }, [secondFileTab.id]: secondFileTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id, secondFileTab.id] }
    );
    const props = renderPaneView();

    expect(within(tabElement("Note")).getByTestId("pane-tab-pin-icon")).toBeInTheDocument();
    expect(tabElement("Note").firstElementChild).toBe(within(tabElement("Note")).getByTestId("pane-tab-pin-icon"));
    expect(within(tabElement("Second")).queryByTestId("pane-tab-pin-icon")).toBeNull();

    fireEvent.click(tabElement("Second"));
    expect(props.onTabSelect).toHaveBeenCalledWith(secondFileTab.id);

    fireEvent.click(screen.getAllByTitle("Close tab")[1]);
    expect(props.onTabClose).toHaveBeenCalledWith(secondFileTab.id);
  });

  it("runs file tab context menu actions without changing menu labels or clipboard text", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    setPaneState(
      { [fileTab.id]: fileTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );
    const props = renderPaneView({ isSplitView: true });

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
    expect(props.onOpenInOtherPane).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Other Tabs" }));
    expect(props.onCloseOtherTabs).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Tabs to the Right" }));
    expect(props.onCloseTabsToRight).toHaveBeenCalledWith(fileTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close All Tabs" }));
    expect(props.onCloseAllTabs).toHaveBeenCalled();
  });

  it("renders file, panel, gantt, and empty pane surfaces", () => {
    setPaneState(
      { [fileTab.id]: fileTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );
    renderPaneView();
    expect(screen.getByText("11 characters / 2 words")).toBeInTheDocument();

    cleanup();
    setPaneState(
      { [panelTab.id]: panelTab },
      { activeTabId: panelTab.id, history: [panelTab.id], tabIds: [panelTab.id] }
    );
    renderPaneView();
    expect(screen.getByText("Panel frontmatter")).toBeInTheDocument();
    expect(screen.getByTestId("panel-tab-icon")).toBeInTheDocument();

    cleanup();
    setPaneState(
      { [ganttTab.id]: ganttTab },
      { activeTabId: ganttTab.id, history: [ganttTab.id], tabIds: [ganttTab.id] }
    );
    renderPaneView();
    expect(screen.getByText("Gantt chronicle")).toBeInTheDocument();

    cleanup();
    setPaneState({}, emptyPane());
    const props = renderPaneView();
    expect(screen.getByText("No files")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create New File" }));
    expect(props.onCreateFile).toHaveBeenCalledWith("");
  });

  it("shows a warning for unreadable frontmatter while keeping the editor editable", () => {
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content: "---\ntitle: [broken\n---\nEditable body",
          savedContent: "---\ntitle: [broken\n---\nEditable body"
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    renderPaneView();

    expect(screen.getByText("Frontmatter cannot be read. Editing and saving can continue.")).toBeInTheDocument();
    expect(screen.getByText("Editable body")).toBeInTheDocument();
  });
});
