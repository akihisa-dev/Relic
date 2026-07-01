import {
  fireEvent,
  screen,
  waitFor
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  allRailFeatureToggles,
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import {
  graphWheelZoomPoint,
  graphNodePrimaryAction,
  isGraphNodePrimaryPointerButton,
  zoomGraphAtPoint
} from "./components/GraphView";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

function kamakuraEntry() {
  return {
    chronicleCalendarName: "メイン暦",
    chronicleEntryIndex: 0,
    endLabel: "メイン暦 1333",
    endPoint: { month: null, year: 1333 },
    endValue: 15984,
    fileName: "鎌倉時代",
    path: "history/kamakura.md",
    startLabel: "メイン暦 1185",
    startPoint: { month: null, year: 1185 },
    startValue: 14208
  };
}

describe("App charts", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("レールのグラフビューボタンからワークスペースグラフを表示できる", async () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        links: [
          { count: 1, source: "A.md", target: "B.md", type: "link" },
          { count: 1, source: "A.md", target: "#project", type: "tag" }
        ],
        nodes: [
          { backlinkCount: 0, exists: true, id: "A.md", label: "A", linkCount: 1, path: "A.md", type: "file" },
          { backlinkCount: 1, exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file" },
          { backlinkCount: 1, exists: true, id: "#project", label: "#project", linkCount: 0, path: null, type: "tag" }
        ]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceGraph,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");
    fireEvent.click(screen.getByRole("button", { name: "グラフビュー" }));

    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledTimes(1));
    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("chart-graph");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "graph",
      kind: "chart"
    });
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    const graphCanvas = container.querySelector(".graph-view-canvas") as HTMLCanvasElement;
    expect(graphCanvas).toBeInTheDocument();
    expect(graphCanvas).toHaveAttribute("tabindex", "0");
    expect(fireEvent.keyDown(graphCanvas, { key: "ArrowRight" })).toBe(false);
    expect(fireEvent.keyDown(graphCanvas, { key: "=", shiftKey: true })).toBe(false);
    expect(container.querySelector(".graph-controls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グラフ設定を閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グラフ設定をリセット" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グラフのタイムラプスを再生" })).toBeInTheDocument();
    const filtersHeader = screen.getByRole("button", { name: "Filters" });
    expect(filtersHeader).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(filtersHeader);
    expect(filtersHeader).toHaveAttribute("aria-expanded", "true");
    const filterInput = screen.getByRole("searchbox", { name: "ノードをフィルタ" });
    fireEvent.change(filterInput, { target: { value: "tag:project" } });
    expect(screen.getByText("1 nodes")).toBeInTheDocument();
    fireEvent.change(filterInput, { target: { value: "" } });
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    const groupsHeader = screen.getByRole("button", { name: "Groups" });
    fireEvent.click(groupsHeader);
    fireEvent.click(screen.getByRole("button", { name: "New group" }));
    fireEvent.click(screen.getByRole("button", { name: "New group" }));

    const groupQueries = screen.getAllByLabelText("グループ検索") as HTMLInputElement[];
    fireEvent.change(groupQueries[0]!, { target: { value: "first" } });
    fireEvent.change(groupQueries[1]!, { target: { value: "second" } });

    const dragHandles = screen.getAllByRole("button", { name: "グループを並べ替え" });
    const dataTransfer = {
      effectAllowed: "move",
      setData: vi.fn()
    };
    fireEvent.dragStart(dragHandles[0]!, { dataTransfer });
    fireEvent.dragOver(dragHandles[1]!.closest(".graph-color-group")!);
    fireEvent.dragEnd(dragHandles[0]!);

    expect((screen.getAllByLabelText("グループ検索") as HTMLInputElement[]).map((input) => input.value)).toEqual([
      "second",
      "first"
    ]);
  });

  it("グラフビューのタグノードクリックはタグ検索アクションになる", () => {
    expect(graphNodePrimaryAction({
      backlinkCount: 0,
      exists: true,
      id: "#project",
      label: "#project",
      linkCount: 0,
      path: null,
      type: "tag"
    })).toStrictEqual({ tag: "project", type: "tagSearch" });
    expect(isGraphNodePrimaryPointerButton(0)).toBe(true);
    expect(isGraphNodePrimaryPointerButton(1)).toBe(true);
    expect(isGraphNodePrimaryPointerButton(2)).toBe(false);
  });

  it("グラフビューのズームはカーソル下の位置を保つ", () => {
    const view = { panX: 0, panY: 0, scale: 1 };

    zoomGraphAtPoint(view, 100, 150, 900, 600, 2);

    expect(view).toStrictEqual({ panX: 350, panY: 150, scale: 2 });
  });

  it("グラフビューのホイール縮小は表示中央を基準にする", () => {
    expect(graphWheelZoomPoint(2, 1, 100, 150, 900, 600)).toStrictEqual({ x: 450, y: 300 });
    expect(graphWheelZoomPoint(1, 2, 100, 150, 900, 600)).toStrictEqual({ x: 100, y: 150 });
  });

  it("レールのチャートボタンからchronicleを持つファイルを表示できる", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });
    const getWorkspaceCharts = vi.fn().mockResolvedValue({
      ok: true,
      value: [{
        entries: [kamakuraEntry()],
        filePaths: ["history/kamakura.md"],
        id: "chronicle",
        name: "年表",
        source: "chronicle"
      }]
    });

    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle:\n  - [メイン暦, [[1186, null], [1334, null]]]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const renderResult = await renderApp();

    await screen.findByText("Notes");
    expect(getWorkspaceCharts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    await waitFor(() => expect(getWorkspaceCharts).toHaveBeenCalledTimes(1));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("chart-chronicle");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "chronicle",
      kind: "chart"
    });
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    await screen.findByText("1185 〜 1333");
    expect(renderResult.container.querySelector(".chronicle-sidebar")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-name-column")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-year-summary")).toBeNull();
    expect(screen.queryByText("年代")).not.toBeInTheDocument();
    expect(screen.queryByText("1185-1333")).not.toBeInTheDocument();
    expect(renderResult.container.querySelector(".chronicle-tracks")).toHaveStyle({ height: "386px" });
    expect(renderResult.container.querySelector(".chronicle-tracks-svg")).toHaveAttribute("height", "386");
    expect(renderResult.container.querySelector(".chronicle-fill-shape")).toHaveAttribute("d");
    expect(renderResult.container.querySelector(".chronicle-toolbar")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-minimap")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-minimap-item")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-vertical-panel")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-vertical-minimap")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-actions")).toBeNull();
    expect(screen.queryByText("計画")).not.toBeInTheDocument();
    expect(screen.queryByText("実行")).not.toBeInTheDocument();
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".chronicle-guide-line--major").length
    );
    const oneYearAxisLabels = Array.from(renderResult.container.querySelectorAll(".chronicle-axis--chronicle .chronicle-axis-cell"))
      .map((element) => Number(element.textContent?.replace("−", "-") ?? Number.NaN));
    expect(oneYearAxisLabels.length).toBeGreaterThan(0);
    expect(oneYearAxisLabels.every(Number.isFinite)).toBe(true);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".chronicle-guide-line--major").length
    );
    expect(renderResult.container.querySelectorAll(".chronicle-guide-row-line")).toHaveLength(0);

    const fill = renderResult.container.querySelector(".chronicle-fill") as SVGElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 20 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      chronicleEntryIndex: 0,
      endValue: 15987,
      kind: "move",
      originalEndValue: 15984,
      originalStartValue: 14208,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 14211
    }));
  });

  it("chronicleチャートのバー編集は低速ドラッグで1年単位の細かな変更にする", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [kamakuraEntry()],
          filePaths: ["history/kamakura.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle:\n  - [メイン暦, [[1210, null], [1358, null]]]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    await waitFor(() => expect(container.querySelector(".chronicle-fill")).not.toBeNull());
    expect(container.querySelector(".chronicle-actions")).toBeNull();

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    for (let clientX = 1; clientX <= 72; clientX += 1) {
      const pointerMove = new Event("pointermove") as PointerEvent;
      Object.defineProperty(pointerMove, "clientX", { value: clientX });
      Object.defineProperty(pointerMove, "pointerId", { value: 1 });
      window.dispatchEvent(pointerMove);
    }
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      chronicleEntryIndex: 0,
      endValue: 15990,
      kind: "move",
      originalEndValue: 15984,
      originalStartValue: 14208,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 14214
    }));
  });

  it("chronicleチャートのバー編集は高速ドラッグで大きく移動する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [kamakuraEntry()],
          filePaths: ["history/kamakura.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle:\n  - [メイン暦, [[1210, null], [1358, null]]]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    await waitFor(() => expect(container.querySelector(".chronicle-fill")).not.toBeNull());
    expect(container.querySelector(".chronicle-actions")).toBeNull();

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      chronicleEntryIndex: 0,
      endValue: 15996,
      kind: "move",
      originalEndValue: 15984,
      originalStartValue: 14208,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 14220
    }));
  });

});
