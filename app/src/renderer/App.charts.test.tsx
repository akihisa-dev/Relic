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
  applyGraphKeyboardNavigation,
  applyGraphKeyboardZoom,
  applyGraphPanInertia,
  applyGraphZoomTransition,
  graphHoveredNodeContainsPoint,
  graphLabelOpacity,
  graphLinkEndpoints,
  graphLinkScaleOpacity,
  graphNodeAtCanvasPoint,
  graphNodeBaseRadius,
  graphNodeScale,
  graphPointerMovedBeyondClickThreshold,
  graphWheelZoomPoint,
  graphHighlightPulse,
  graphNodePrimaryAction,
  isGraphNodePrimaryPointerButton,
  finishGraphPanVelocity,
  graphHighlightAlpha,
  nextGraphPanVelocity,
  nextGraphPanSampleMs,
  resolveGraphHoverFocusId,
  stepGraphHighlightState,
  zoomGraphAtPoint
} from "./graph/graphViewModel";
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

const graphTestOptions = {
  centerStrength: 0.1,
  hideUnresolved: false,
  lineSizeMultiplier: 1,
  linkDistance: 250,
  linkStrength: 1,
  nodeSizeMultiplier: 1,
  repelStrength: 10,
  search: "",
  showArrows: false,
  showAttachments: false,
  showOrphans: true,
  showTags: false,
  textFadeMultiplier: 0
};

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
    const filtersHeader = screen.getByRole("button", { name: "フィルタ" });
    expect(filtersHeader).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(filtersHeader);
    expect(filtersHeader).toHaveAttribute("aria-expanded", "true");
    const filterInput = screen.getByRole("searchbox", { name: "ノードをフィルタ" });
    fireEvent.change(filterInput, { target: { value: "tag:project" } });
    expect(screen.getByText("1件のノード")).toBeInTheDocument();
    fireEvent.change(filterInput, { target: { value: "" } });
    expect(screen.getByText("2件のノード")).toBeInTheDocument();
    const groupsHeader = screen.getByRole("button", { name: "グループ" });
    fireEvent.click(groupsHeader);
    fireEvent.click(screen.getByRole("button", { name: "新規グループ" }));
    fireEvent.click(screen.getByRole("button", { name: "新規グループ" }));

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

  it("グラフビューのノードクリックは5px超過でドラッグ扱いになる", () => {
    expect(graphPointerMovedBeyondClickThreshold(3, 4)).toBe(false);
    expect(graphPointerMovedBeyondClickThreshold(4, 4)).toBe(true);
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

  it("グラフビューのキーボード移動は押下状態から継続移動する", () => {
    const view = { panX: 0, panY: 0, scale: 1 };

    applyGraphKeyboardNavigation(view, {
      down: false,
      left: false,
      right: true,
      shift: false,
      up: true,
      zoomIn: false,
      zoomOut: false
    });
    expect(view.panX).toBeCloseTo(-1000 / 60);
    expect(view.panY).toBeCloseTo(1000 / 60);
    expect(view.scale).toBe(1);

    applyGraphKeyboardNavigation(view, {
      down: false,
      left: true,
      right: false,
      shift: true,
      up: false,
      zoomIn: false,
      zoomOut: false
    });
    expect(view.panX).toBeCloseTo(2000 / 60);
    expect(view.panY).toBeCloseTo(1000 / 60);
    expect(view.scale).toBe(1);
  });

  it("グラフビューのズームキーは押下状態から継続ズームする", () => {
    const view = { panX: 0, panY: 0, scale: 1, targetScale: 1, zoomCenterX: 0, zoomCenterY: 0 };

    applyGraphKeyboardZoom(view, {
      down: false,
      left: false,
      right: false,
      shift: false,
      up: false,
      zoomIn: true,
      zoomOut: false
    }, 900, 600);
    expect(view.scale).toBe(1);
    expect(view.targetScale).toBeCloseTo(1.03);
    expect(view.zoomCenterX).toBe(450);
    expect(view.zoomCenterY).toBe(300);

    applyGraphZoomTransition(view, 900, 600);
    expect(view.scale).toBeCloseTo(1.0045);

    applyGraphKeyboardZoom(view, {
      down: false,
      left: false,
      right: false,
      shift: true,
      up: false,
      zoomIn: false,
      zoomOut: true
    }, 900, 600);
    expect(view.targetScale).toBeCloseTo(1.03 / 1.1);
    expect(view.scale).toBeCloseTo(1.0045);
  });

  it("グラフビューの背景パンは離したあと慣性で減速する", () => {
    const view = { panX: 0, panY: 0, scale: 1 };
    const velocity = nextGraphPanVelocity({ x: 0, y: 0 }, 20, -10);
    const sampleMs = nextGraphPanSampleMs(0, 20);

    expect(velocity).toStrictEqual({ x: 4, y: -2 });
    expect(sampleMs).toBe(4);

    const releasedVelocity = finishGraphPanVelocity(velocity, sampleMs, 20);
    expect(releasedVelocity).toStrictEqual({ x: 1, y: -0.5 });

    applyGraphPanInertia(view, releasedVelocity);
    expect(view).toStrictEqual({ panX: 1000 / 60, panY: -500 / 60, scale: 1 });
    expect(releasedVelocity).toStrictEqual({ x: 0.9, y: -0.45 });

    expect(finishGraphPanVelocity(velocity, sampleMs, 101)).toStrictEqual({ x: 0, y: 0 });
  });

  it("グラフビューのホバー強調はノードがマウス下から外れたら解除対象になる", () => {
    const node = {
      backlinkCount: 0,
      linkCount: 0,
      type: "file" as const,
      x: 0,
      y: 0
    };
    const view = { panX: 0, panY: 0, scale: 1 };

    expect(graphHoveredNodeContainsPoint(node, { x: 450, y: 300 }, view, graphTestOptions, 900, 600)).toBe(true);
    expect(graphHoveredNodeContainsPoint(node, { x: 500, y: 300 }, view, graphTestOptions, 900, 600)).toBe(false);
  });

  it("グラフビューのノード取得はキャンバス座標から判定する", () => {
    const node = {
      backlinkCount: 0,
      linkCount: 0,
      x: 0,
      y: 0
    };
    const view = { panX: 0, panY: 0, scale: 1 };

    expect(graphNodeAtCanvasPoint([node], { x: 450, y: 300 }, view, graphTestOptions, 900, 600)).toBe(node);
    expect(graphNodeAtCanvasPoint([node], { x: 520, y: 300 }, view, graphTestOptions, 900, 600)).toBeNull();
  });

  it("グラフビューのホバー強調は一瞬外れても短時間保持する", () => {
    const node = {
      backlinkCount: 0,
      exists: true,
      fx: null,
      fy: null,
      id: "A.md",
      label: "A",
      linkCount: 0,
      path: "A.md",
      type: "file" as const,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0
    };
    const state = { id: null, releaseAt: 0 };
    const view = { panX: 0, panY: 0, scale: 1 };

    expect(resolveGraphHoverFocusId([node], { x: 450, y: 300 }, view, graphTestOptions, 900, 600, state, 0)).toBe("A.md");
    expect(resolveGraphHoverFocusId([node], { x: 520, y: 300 }, view, graphTestOptions, 900, 600, state, 20)).toBe("A.md");
    expect(state.releaseAt).toBe(160);
    expect(resolveGraphHoverFocusId([node], { x: 520, y: 300 }, view, graphTestOptions, 900, 600, state, 200)).toBeNull();
  });

  it("グラフビューのハイライト透明度は段階的に収束する", () => {
    const state = { id: null, strength: 0 };

    expect(stepGraphHighlightState(state, "A.md")).toStrictEqual({ id: "A.md", strength: 0.2 });
    expect(stepGraphHighlightState(state, "A.md").strength).toBeCloseTo(0.36);
    expect(stepGraphHighlightState(state, null)).toStrictEqual({ id: "A.md", strength: 0.28800000000000003 });
    expect(graphHighlightAlpha(false, 0, 1, 0.34)).toBe(1);
    expect(graphHighlightAlpha(false, 0.5, 1, 0.34)).toBeCloseTo(0.67);
    expect(graphHighlightAlpha(false, 1, 1, 0.34)).toBeCloseTo(0.34);

    for (let index = 0; index < 20; index += 1) {
      stepGraphHighlightState(state, null);
    }
    expect(state).toStrictEqual({ id: null, strength: 0 });
  });

  it("グラフビューのホバー発光は周期的に穏やかに変化する", () => {
    expect(graphHighlightPulse(0)).toBeCloseTo(0.5);
    expect(graphHighlightPulse(425)).toBeGreaterThan(0.9);
    expect(graphHighlightPulse(850)).toBeCloseTo(0.5);
    expect(graphHighlightPulse(1_700)).toBeCloseTo(0.5);
  });

  it("グラフビューのノードと文字はズーム係数で描画する", () => {
    const node = {
      backlinkCount: 8,
      linkCount: 8
    };

    expect(graphNodeBaseRadius({ backlinkCount: 0, linkCount: 0 }, graphTestOptions)).toBe(8);
    expect(graphNodeBaseRadius(node, graphTestOptions)).toBeCloseTo(3 * Math.sqrt(17));
    expect(graphNodeBaseRadius({ backlinkCount: 200, linkCount: 200 }, graphTestOptions)).toBe(30);
    expect(graphNodeBaseRadius(node, { ...graphTestOptions, nodeSizeMultiplier: 2 })).toBeCloseTo(6 * Math.sqrt(17));

    expect(graphNodeScale(1)).toBe(1);
    expect(graphNodeScale(4)).toBe(0.5);
    expect(graphNodeScale(0.25)).toBe(2);

    expect(graphLabelOpacity(0.5, 0)).toBe(0);
    expect(graphLabelOpacity(1, 0)).toBe(1);
    expect(graphLabelOpacity(2, 1)).toBe(1);

    expect(graphLinkScaleOpacity(0.04)).toBe(0);
    expect(graphLinkScaleOpacity(0.12)).toBeCloseTo(0.2222);
    expect(graphLinkScaleOpacity(0.3)).toBeCloseTo(0.7222);
    expect(graphLinkScaleOpacity(0.4)).toBe(1);
  });

  it("グラフビューのリンク線はノード外周で止める", () => {
    expect(graphLinkEndpoints(
      { backlinkCount: 0, linkCount: 0, x: 0, y: 0 },
      { backlinkCount: 0, linkCount: 0, x: 100, y: 0 },
      graphTestOptions,
      1
    )).toStrictEqual({
      sourceX: 8,
      sourceY: 0,
      targetX: 92,
      targetY: 0,
      visible: true
    });

    expect(graphLinkEndpoints(
      { backlinkCount: 0, linkCount: 0, x: 0, y: 0 },
      { backlinkCount: 0, linkCount: 0, x: 10, y: 0 },
      graphTestOptions,
      1
    )).toStrictEqual({
      sourceX: 0,
      sourceY: 0,
      targetX: 10,
      targetY: 0,
      visible: false
    });
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
    await waitFor(() => expect(renderResult.container.querySelector(".chronicle-canvas")).not.toBeNull());
    expect(renderResult.container.querySelector(".chronicle-sidebar")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-name-column")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-year-summary")).toBeNull();
    expect(screen.queryByText("年代")).not.toBeInTheDocument();
    expect(screen.queryByText("1185-1333")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "年表ビュー切り替え" })).not.toBeInTheDocument();
    expect(renderResult.container.querySelector(".chronicle-bubble-item")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-tracks")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-tracks-svg")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-fill-shape")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-toolbar")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-minimap")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-minimap-item")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-vertical-panel")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-vertical-minimap")).toBeNull();
    expect(renderResult.container.querySelector(".chronicle-actions")).toBeNull();
    expect(screen.queryByText("計画")).not.toBeInTheDocument();
    expect(screen.queryByText("実行")).not.toBeInTheDocument();
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line")).toHaveLength(0);
    expect(renderResult.container.querySelectorAll(".chronicle-axis--chronicle .chronicle-axis-year")).toHaveLength(0);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-row-line")).toHaveLength(0);
    expect(updateChartEntry).not.toHaveBeenCalled();
  });

  it("chronicleのCanvas操作はMarkdownを書き換えない", async () => {
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
    await waitFor(() => expect(container.querySelector(".chronicle-canvas")).not.toBeNull());
    expect(container.querySelector(".chronicle-actions")).toBeNull();
    expect(updateChartEntry).not.toHaveBeenCalled();
  });

});
