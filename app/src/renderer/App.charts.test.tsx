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

  it("レールのチャートボタンからchronicleを持つファイルを表示できる", async () => {
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
          content: "---\nchronicle:\n  - [メイン暦, [[1186, null], [1334, null]]]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const renderResult = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("chart-chronicle");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "chronicle",
      kind: "chart"
    });
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(renderResult.container.querySelector(".chronicle-sidebar")).toBeNull();
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
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
