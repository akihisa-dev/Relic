import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";

import { defaultEditorSettings } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { useEditorStore, type PaneState, type Tab } from "../store/editorStore";
import { PaneView, type PaneViewProps } from "./PaneView";

const emptyPane = (): PaneState => ({ activeTabId: null, history: [], tabIds: [] });

const cardTab: Tab = {
  content: "hello world",
  id: "tab-card",
  kind: "card",
  name: "Note",
  path: "CardFolder/Note.md"
};

const secondCardTab: Tab = {
  content: "second",
  id: "tab-second",
  kind: "card",
  name: "Second",
  path: "Second.md"
};

const panelTab: Tab = {
  id: "panel-frontmatter",
  kind: "panel",
  name: "Frontmatter",
  panel: "frontmatter"
};

const timelineTab: Tab = {
  chartId: "timeline",
  id: "timeline-timeline",
  kind: "timeline",
  name: "Timeline"
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
    allCardPaths: [],
    closingTabIds: new Set(),
    editorActionPulse: 0,
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    frontmatterCandidates: {},
    isSplitView: false,
    pane: "left",
    renderTimelineTab: (chartId) => <div>Timeline {chartId}</div>,
    renderPanelTab: (panel) => <div>Panel {panel}</div>,
    renderPanelTabIcon: () => <svg data-testid="panel-tab-icon" />,
    sourceMode: false,
    typewriterMode: false,
    userDefinedFields: [],
    viewRef: { current: null } as MutableRefObject<EditorView | null>,
    cardbookPath: "/cardbook",
    onCloseAllTabs: vi.fn(),
    onCloseOtherTabs: vi.fn(),
    onCloseTabsToRight: vi.fn(),
    onCreateCard: vi.fn(),
    onDuplicateTabCard: vi.fn(),
    onCardSaved: vi.fn(),
    onFocus: vi.fn(),
    onOpenInOtherPane: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenWikiLink: vi.fn(),
    onRenameCard: vi.fn(),
    onRevealTabCard: vi.fn(),
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
      { [cardTab.id]: { ...cardTab, isPinned: true }, [secondCardTab.id]: secondCardTab },
      { activeTabId: cardTab.id, history: [cardTab.id], tabIds: [cardTab.id, secondCardTab.id] }
    );
    const props = renderPaneView();

    expect(within(tabElement("Note")).getByTestId("pane-tab-pin-icon")).toBeInTheDocument();
    expect(tabElement("Note").firstElementChild).toBe(within(tabElement("Note")).getByTestId("pane-tab-pin-icon"));
    expect(within(tabElement("Second")).queryByTestId("pane-tab-pin-icon")).toBeNull();

    fireEvent.click(tabElement("Second"));
    expect(props.onTabSelect).toHaveBeenCalledWith(secondCardTab.id);

    fireEvent.click(screen.getAllByTitle("Close tab")[1]);
    expect(props.onTabClose).toHaveBeenCalledWith(secondCardTab.id);
  });

  it("runs card tab context menu actions without changing menu labels or clipboard text", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    setPaneState(
      { [cardTab.id]: cardTab },
      { activeTabId: cardTab.id, history: [cardTab.id], tabIds: [cardTab.id] }
    );
    const props = renderPaneView({ isSplitView: true });

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(props.onTogglePinTab).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(props.onDuplicateTabCard).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Copy path" }));
    expect(writeText).toHaveBeenCalledWith(cardTab.path);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown link" }));
    expect(writeText).toHaveBeenCalledWith("[[CardFolder/Note]]");

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Show card location" }));
    expect(props.onRevealTabCard).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Open in Other Pane" }));
    expect(props.onOpenInOtherPane).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Other Tabs" }));
    expect(props.onCloseOtherTabs).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close Tabs to the Right" }));
    expect(props.onCloseTabsToRight).toHaveBeenCalledWith(cardTab.id);

    fireEvent.contextMenu(tabElement("Note"), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Close All Tabs" }));
    expect(props.onCloseAllTabs).toHaveBeenCalled();
  });

  it("renders card, panel, Timeline, and empty pane surfaces", () => {
    setPaneState(
      { [cardTab.id]: cardTab },
      { activeTabId: cardTab.id, history: [cardTab.id], tabIds: [cardTab.id] }
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
      { [timelineTab.id]: timelineTab },
      { activeTabId: timelineTab.id, history: [timelineTab.id], tabIds: [timelineTab.id] }
    );
    renderPaneView();
    expect(screen.getByText("Timeline timeline")).toBeInTheDocument();

    cleanup();
    setPaneState({}, emptyPane());
    const props = renderPaneView();
    expect(screen.getByText("No cards")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create New Card" }));
    expect(props.onCreateCard).toHaveBeenCalledWith("");
  });
});
