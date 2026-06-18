import {
  fireEvent,
  screen,
  within,
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

const day = (value: string): number =>
  Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);

describe("App date charts", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("dateチャートは表示対象が空でも日付チャートを表示する", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "2026",
            endValue: 2025,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026",
            startValue: 2025
          }],
          filePaths: ["tasks/implementation.md"],
          id: "chronicle",
          name: "chronicle",
          source: "chronicle"
        }, {
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }, {
            dateKind: "actual",
            endLabel: "2026-05-06",
            endValue: 20579,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-03",
            startValue: 20576
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    expect(useEditorStore.getState().leftPane.activeTabId).toBe("chart-date");
    expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1);
    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    expect(screen.queryByText("2026-05-01 〜 2026-05-05")).not.toBeInTheDocument();
    expect(screen.getByText("01 〜 05")).toBeInTheDocument();
    expect(screen.getByText("03 〜 06")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-axis--date .chronicle-axis-row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(container.querySelector(".chronicle-chart")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-fill")).toHaveLength(2);
    expect(container.querySelector('.chronicle-fill[data-date-kind="planned"]')).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
    expect(container.querySelector(".chronicle-minimap")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-minimap-item")).toHaveLength(2);
    expect(container.querySelector(".chronicle-today-line")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-row-line").length).toBeGreaterThan(0);

    const rail = container.querySelector(".rail");
    if (!(rail instanceof HTMLElement)) throw new Error("rail was not rendered");
    fireEvent.click(within(rail).getByRole("button", { name: "フロントマター" }));
    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    expect(screen.getByRole("button", { name: "カレンダー" })).toHaveClass("active");
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
  });

  it("チャート面を掴んで横スクロールできる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "2026-06-20",
            endValue: 20624,
            fileName: "長い予定",
            path: "tasks/long.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const chart = container.querySelector(".chronicle-chart") as HTMLDivElement;
    Object.defineProperty(chart, "scrollLeft", { configurable: true, value: 120, writable: true });

    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 200 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    chart.dispatchEvent(pointerDown);

    const pointerMove = new Event("pointermove") as PointerEvent;
    Object.defineProperty(pointerMove, "clientX", { value: 150 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    window.dispatchEvent(pointerMove);

    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(chart.scrollLeft).toBe(170);
  });

  it("main側のdate行をそのまま採用し、Markdown再読込をしない", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "---\nstatus: [進行中]\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# 実装タスク",
        name: "実装タスク",
        path: "tasks/implementation.md"
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "actual",
            endLabel: "2026-05-06",
            endValue: day("2026-05-06"),
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-03",
            startValue: day("2026-05-03"),
            statuses: ["進行中"]
          }, {
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: day("2026-05-05"),
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: day("2026-05-01")
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(container.querySelectorAll('.chronicle-fill[data-date-kind="planned"]').length).toBe(1));
    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    const plannedFill = container.querySelector('.chronicle-fill[data-date-kind="planned"]') as HTMLElement;
    const actualFill = container.querySelector('.chronicle-fill[data-date-kind="actual"]') as HTMLElement;
    expect(plannedFill.querySelector(".chronicle-fill-status")).toBeNull();
    expect(actualFill.querySelector(".chronicle-fill-status")).toHaveTextContent("進行中");
    expect(readMarkdownFile).not.toHaveBeenCalled();
  });

  it("main側にdate行が空でもrenderer側でMarkdown再読込せず空表示のままにする", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "---\nstatus: [進行中]\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# 実装タスク",
        name: "実装タスク",
        path: "tasks/implementation.md"
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "計画だけ", path: "tasks/planned-only.md", type: "file" },
            { name: "実行だけ", path: "tasks/actual-only.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "カレンダー" })).toHaveClass("active"));
    expect(container.querySelectorAll(".chronicle-fill")).toHaveLength(0);
    expect(container.querySelector(".chronicle-file-name--empty")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-file-name:not(.chronicle-file-name--empty)")).toHaveLength(0);
    expect(readMarkdownFile).not.toHaveBeenCalled();
  });

  it("チャートバーはクリックでファイルを開かずドラッグで日付範囲を更新する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({
      ok: true,
      value: [{
        entries: [{
          dateKind: "planned",
          endLabel: "2026-05-06",
          endValue: 20579,
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-02",
          startValue: 20575
        }],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      }]
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "---\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク", name: "実装タスク", path: "tasks/implementation.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    fireEvent.click(fill);

    expect(readMarkdownFile).not.toHaveBeenCalled();

    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerMove = new Event("pointermove") as PointerEvent;
    Object.defineProperty(pointerMove, "clientX", { value: 15 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    window.dispatchEvent(pointerMove);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      endValue: 20579,
      kind: "move",
      originalEndValue: 20578,
      originalStartValue: 20574,
      path: "tasks/implementation.md",
      dateKind: "planned",
      source: "date",
      startValue: 20575
    }));
  });

  it("チャートバーの保存に失敗した場合はエラーを表示する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({
      error: { code: "CHART_ENTRY_UPDATE_FAILED", message: "チャートの変更を保存できませんでした。" },
      ok: false
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(await screen.findByText("チャートの変更を保存できませんでした。")).toHaveClass("toast--error");
  });

  it("チャート更新専用IPCが使えない場合はファイル読み書きfallbackへ切り替えない", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "---\nchronicle0: [2026]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# 実装タスク",
        name: "実装タスク",
        path: "tasks/implementation.md"
      }
    });
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      updateChartEntry: undefined,
      writeMarkdownFile
    } as Partial<typeof window.relic>);

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(await screen.findByText("チャート更新APIでエラーが発生しました。Relicを再起動してからもう一度お試しください。")).toHaveClass("toast--error");
    expect(writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("旧形式の年表データは表示せず空として扱う", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "---\nchronicle0: [1333]\nchronicle1: [1220, 1333]\n---\n# 鎌倉時代",
        name: "鎌倉時代",
        path: "history/kamakura.md"
      }
    });

    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "年表" })).toHaveClass("active"));
    expect(container.querySelectorAll(".chronicle-fill")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "鎌倉時代" })).not.toBeInTheDocument();
    expect(screen.queryByText("鎌倉時代")).not.toBeInTheDocument();
    expect(screen.queryByText("1185 〜 1333")).not.toBeInTheDocument();
    expect(readMarkdownFile).not.toHaveBeenCalled();
  });
});
