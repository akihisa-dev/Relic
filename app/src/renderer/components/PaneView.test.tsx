import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";

import { defaultEditorSettings } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { largeMarkdownMaxContentBytes, largeMarkdownMaxLineLength } from "../largeMarkdown";
import { useEditorStore, type PaneState, type Tab } from "../store/editorStore";
import { PANE_TAB_DRAG_MIME, serializePaneTabDragPayload } from "../paneViewModel";
import {
  __getPaneViewRenderCountsForTests,
  __resetPaneViewRenderCountsForTests,
  PaneView,
  type PaneViewProps
} from "./PaneView";

const emptyPane = (): PaneState => ({ activeTabId: null, history: [], tabIds: [] });

const fileTab: Tab = {
  content: "hello world",
  id: "tab-file",
  kind: "file",
  name: "Note",
  path: "Folder/Note.md",
  savedContent: "hello world"
};

const panelTab: Tab = {
  id: "panel-frontmatter",
  kind: "panel",
  name: "Frontmatter",
  panel: "frontmatter"
};

const chartTab: Tab = {
  chartId: "chronicle",
  id: "chart-chronicle",
  kind: "chart",
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
    canReopenClosedTab: false,
    editorActionPulse: 0,
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    frontmatterCandidates: {},
    closingTabIds: new Set(),
    isSplitView: false,
    pane: "left",
    renderChartTab: (chartId) => <div>Chart {chartId}</div>,
    renderPanelTab: (panel) => <div>Panel {panel}</div>,
    renderPanelTabIcon: () => null,
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
    onLargeMarkdownFallback: vi.fn(),
    onFocus: vi.fn(),
    onOpenInOtherPane: vi.fn(),
    onReopenClosedTab: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenWikiLink: vi.fn(),
    onRenameFile: vi.fn(),
    onRevealTabFile: vi.fn(),
    onSavePreviewAsPdf: vi.fn(),
    onScrollTargetHandled: vi.fn(),
    onSourceModeToggle: vi.fn(),
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

afterEach(() => {
  cleanup();
  resetStore();
  vi.restoreAllMocks();
  __resetPaneViewRenderCountsForTests();
});

describe("PaneView", () => {
  it("左ペインの本文更新で右ペインと無関係なタブ表示を再描画しない", () => {
    const rightTab = { ...fileTab, id: "tab-right", name: "Right", path: "Right.md" };
    setPaneState(
      { [fileTab.id]: fileTab, [rightTab.id]: rightTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
      { activeTabId: rightTab.id, history: [rightTab.id], tabIds: [rightTab.id] }
    );
    renderPaneView({ pane: "left" });
    renderPaneView({ pane: "right" });
    const before = __getPaneViewRenderCountsForTests();

    act(() => useEditorStore.getState().updateTabContent(fileTab.id, "left changed"));

    const after = __getPaneViewRenderCountsForTests();
    expect(after.left).toBeGreaterThan(before.left);
    expect(after.right).toBe(before.right);
  });

  it("renders file, panel, chart, and empty pane surfaces", () => {
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

    cleanup();
    setPaneState(
      { [chartTab.id]: chartTab },
      { activeTabId: chartTab.id, history: [chartTab.id], tabIds: [chartTab.id] }
    );
    renderPaneView();
    expect(screen.getByText("Chart chronicle")).toBeInTheDocument();

    cleanup();
    setPaneState({}, emptyPane());
    const props = renderPaneView();
    expect(screen.getByText("No files")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create New File" }));
    expect(props.onCreateFile).toHaveBeenCalledWith("");
  });

  it("renders editor tabs inside the owning pane", () => {
    const secondFileTab: Tab = {
      content: "second",
      id: "tab-second",
      kind: "file",
      name: "Second.md",
      path: "Second.md",
      savedContent: "saved"
    };
    setPaneState(
      {
        [fileTab.id]: { ...fileTab, isPinned: true },
        [secondFileTab.id]: secondFileTab
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id, secondFileTab.id] }
    );

    renderPaneView();

    expect(document.querySelector(".title-bar .pane-tab-bar")).not.toBeInTheDocument();
    expect(document.querySelector(".pane .pane-tab-bar")).toBeInTheDocument();
    expect(document.querySelectorAll(".pane .pane-tab")).toHaveLength(2);
  });

  it("タブバーの空き領域へドロップして分割ペイン間でタブを移動できる", () => {
    setPaneState(
      { [fileTab.id]: fileTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
      emptyPane()
    );
    const onTabMove = vi.fn();

    renderPaneView({ onTabMove, pane: "right" });

    const tabBar = document.querySelector(".pane-tab-bar");
    expect(tabBar).toBeInstanceOf(HTMLElement);

    fireEvent.dragOver(tabBar as HTMLElement, {
      dataTransfer: { types: [PANE_TAB_DRAG_MIME] }
    });
    fireEvent.drop(tabBar as HTMLElement, {
      dataTransfer: {
        getData: (type: string) => type === PANE_TAB_DRAG_MIME
          ? serializePaneTabDragPayload({ fromPane: "left", tabId: fileTab.id })
          : "",
        types: [PANE_TAB_DRAG_MIME]
      }
    });

    expect(onTabMove).toHaveBeenCalledWith("left", "right", fileTab.id, null, "after");
  });

  it("タブドラッグ中は実幅の挿入空間を作り、中断時に元へ戻す", () => {
    const secondTab: Tab = {
      ...fileTab,
      id: "tab-second",
      name: "Second",
      path: "Second.md"
    };
    setPaneState(
      { [fileTab.id]: fileTab, [secondTab.id]: secondTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id, secondTab.id] }
    );
    renderPaneView();
    const draggedTab = document.querySelector(`[data-tab-id="${fileTab.id}"]`) as HTMLElement;
    const targetTab = document.querySelector(`[data-tab-id="${secondTab.id}"]`) as HTMLElement;
    Object.defineProperty(draggedTab, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 0, right: 132, top: 0, width: 132, x: 0, y: 0 })
    });
    Object.defineProperty(targetTab, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 132, right: 264, top: 0, width: 132, x: 132, y: 0 })
    });
    const dataTransfer = paneTabDataTransfer();

    fireEvent.dragStart(draggedTab, { dataTransfer });
    fireEvent.dragOver(targetTab, { clientX: 250, dataTransfer });

    expect(draggedTab).toHaveClass("pane-tab--dragging");
    expect(targetTab).toHaveClass("pane-tab--drop-after");
    expect(targetTab).toHaveStyle("--pane-tab-drop-gap: 132px");

    fireEvent.dragEnd(draggedTab, { dataTransfer });
    expect(draggedTab).not.toHaveClass("pane-tab--dragging");
    expect(targetTab).not.toHaveClass("pane-tab--drop-after");
  });

  it("左右ペイン間でも移動先に実幅の空間を作って一度だけ確定する", () => {
    const rightTab: Tab = {
      ...fileTab,
      id: "tab-right",
      name: "Right",
      path: "Right.md"
    };
    setPaneState(
      { [fileTab.id]: fileTab, [rightTab.id]: rightTab },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] },
      { activeTabId: rightTab.id, history: [rightTab.id], tabIds: [rightTab.id] }
    );
    const onTabMove = vi.fn();
    renderPaneView({ onTabMove, pane: "left" });
    renderPaneView({ onTabMove, pane: "right" });
    const draggedTab = document.querySelector(`[data-tab-id="${fileTab.id}"]`) as HTMLElement;
    const targetTab = document.querySelector(`[data-tab-id="${rightTab.id}"]`) as HTMLElement;
    Object.defineProperty(draggedTab, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 0, right: 104, top: 0, width: 104, x: 0, y: 0 })
    });
    Object.defineProperty(targetTab, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 100, right: 220, top: 0, width: 120, x: 100, y: 0 })
    });
    const dataTransfer = paneTabDataTransfer();

    fireEvent.dragStart(draggedTab, { dataTransfer });
    fireEvent.dragOver(targetTab, { clientX: 110, dataTransfer });
    expect(targetTab).toHaveClass("pane-tab--drop-after");
    expect(targetTab).toHaveStyle("--pane-tab-drop-gap: 104px");

    fireEvent.drop(targetTab, { clientX: 110, dataTransfer });
    expect(onTabMove).toHaveBeenCalledTimes(1);
    expect(onTabMove).toHaveBeenCalledWith("left", "right", fileTab.id, rightTab.id, "after");
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

  it("見出しジャンプではスクロール対象の見出しへカーソルも移す", async () => {
    const content = [
      "# Intro",
      "",
      "本文",
      "",
      "## Target",
      "",
      "続き"
    ].join("\n");
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content,
          savedContent: content
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({ scrollTargetHeading: "Target" });
    const targetFrom = content.indexOf("## Target");

    await waitFor(() => {
      expect(props.viewRef.current?.state.selection.main.from).toBe(targetFrom);
    });
    expect(props.onScrollTargetHandled).toHaveBeenCalledTimes(1);
  });

  it("同名見出しジャンプではアウトライン項目の位置へカーソルを移す", async () => {
    const content = [
      "# Scene",
      "",
      "先頭の章",
      "",
      "## Scene",
      "",
      "2つ目の章"
    ].join("\n");
    const secondHeadingFrom = content.indexOf("## Scene");
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content,
          savedContent: content
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({
      scrollTargetHeading: { from: secondHeadingFrom, level: 2, text: "Scene" }
    });

    await waitFor(() => {
      expect(props.viewRef.current?.state.selection.main.from).toBe(secondHeadingFrom);
    });
    expect(props.onScrollTargetHandled).toHaveBeenCalledTimes(1);
  });

  it("行番号ジャンプでは対象行へカーソルを移す", async () => {
    const content = [
      "1行目",
      "2行目",
      "検索一致行",
      "4行目"
    ].join("\n");
    const targetFrom = content.indexOf("検索一致行");
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content,
          savedContent: content
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({
      scrollTargetHeading: { lineNumber: 3, type: "line" }
    });

    await waitFor(() => {
      expect(props.viewRef.current?.state.selection.main.from).toBe(targetFrom);
    });
    expect(props.onScrollTargetHandled).toHaveBeenCalledTimes(1);
  });

  it("1MiBを超えるMarkdownは通知を出して一時的にソース表示で開く", async () => {
    const content = [
      "**large**",
      "```ts",
      "const value = 1;",
      "```",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "a".repeat(largeMarkdownMaxContentBytes)
    ].join("\n");
    const editorSettings = { ...defaultEditorSettings, showLineNumbers: false };

    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content,
          savedContent: content
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({
      editorSettings,
      sourceMode: false
    });

    expect(screen.getByText("Live preview is paused for this large Markdown file.")).toBeInTheDocument();
    await waitFor(() => expect(props.viewRef.current).not.toBeNull());
    expect(document.querySelector(".cm-live-bold")).toBeNull();
    expect(document.querySelector(".cm-live-code-block-panel")).toBeNull();
    expect(document.querySelector(".cm-live-table")).toBeNull();
    expect(props.sourceMode).toBe(false);
    expect(useEditorStore.getState().editorSettings).toEqual(defaultEditorSettings);
    expect(editorSettings.showLineNumbers).toBe(false);
    await waitFor(() => expect(props.onLargeMarkdownFallback).toHaveBeenCalledWith("Note", "Folder/Note.md"));
  });

  it("80,000文字を超える行のMarkdownも一時的にソース表示で開く", async () => {
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content: `**large**\n${"a".repeat(largeMarkdownMaxLineLength + 1)}`,
          savedContent: `**large**\n${"a".repeat(largeMarkdownMaxLineLength + 1)}`
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({
      editorSettings: { ...defaultEditorSettings, showLineNumbers: false },
      sourceMode: false
    });

    expect(screen.getByText("Live preview is paused for this large Markdown file.")).toBeInTheDocument();
    await waitFor(() => expect(props.viewRef.current).not.toBeNull());
    expect(document.querySelector(".cm-live-bold")).toBeNull();
    await waitFor(() => expect(props.onLargeMarkdownFallback).toHaveBeenCalledTimes(1));
  });

  it("通常サイズのMarkdownはライブプレビューのまま開き、fallback通知を出さない", async () => {
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content: "**normal**",
          savedContent: "**normal**"
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    const props = renderPaneView({ sourceMode: false });

    expect(screen.queryByText("Live preview is paused for this large Markdown file.")).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".cm-live-bold")).not.toBeNull());
    expect(props.sourceMode).toBe(false);
    expect(props.onLargeMarkdownFallback).not.toHaveBeenCalled();
  });

  it("通常Markdownをソースモードで通常エディタで開く", async () => {
    const content = "# World\n\n本文\n";
    setPaneState(
      {
        [fileTab.id]: {
          ...fileTab,
          content,
          name: "World",
          path: "diagrams/World.md",
          savedContent: content
        }
      },
      { activeTabId: fileTab.id, history: [fileTab.id], tabIds: [fileTab.id] }
    );

    renderPaneView({ sourceMode: true });

    await waitFor(() => expect(document.querySelector(".cm-content")).not.toBeNull());
    expect(screen.queryByRole("img", { name: "World" })).not.toBeInTheDocument();
  });
});

function paneTabDataTransfer(): {
  effectAllowed: string;
  getData: (type: string) => string;
  setData: (type: string, value: string) => void;
  types: string[];
} {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    getData: (type) => values.get(type) ?? "",
    setData: (type, value) => {
      values.set(type, value);
    },
    types: [PANE_TAB_DRAG_MIME]
  };
}
