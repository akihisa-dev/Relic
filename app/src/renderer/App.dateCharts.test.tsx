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

  it("main側がdate行を返さない場合もMarkdownからplannedDateとactualDateを補完する", async () => {
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
          fileTree: [{ name: "実装タスク", path: "tasks/implementation.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nstatus: [進行中]\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# 実装タスク",
          name: "実装タスク",
          path: "tasks/implementation.md"
        }
      })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1));
    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="planned"]')).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
    const plannedFill = container.querySelector('.chronicle-fill[data-date-kind="planned"]') as HTMLElement;
    const actualFill = container.querySelector('.chronicle-fill[data-date-kind="actual"]') as HTMLElement;
    expect(plannedFill.querySelector(".chronicle-fill-status")).toBeNull();
    const initialStatusLabel = actualFill.querySelector(".chronicle-fill-status") as HTMLElement;
    expect(initialStatusLabel).toHaveTextContent("進行中");
    expect(parseFloat(initialStatusLabel.style.width)).toBeLessThanOrEqual(parseFloat(actualFill.style.width));

    const initialStatusLeft = initialStatusLabel.style.left;
    expect(initialStatusLeft).not.toBe("");
  });

  it("main側がdate行を返さない場合も片方だけあるplannedDateまたはactualDateを補完する", async () => {
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
      readMarkdownFile: vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
        ok: true as const,
        value: {
          content: path === "tasks/actual-only.md"
            ? "---\nstatus: [完了]\nactualDate: [2026-05-03]\n---\n# 実行だけ"
            : "---\nstatus: [未着手]\nplannedDate: [2026-05-01]\n---\n# 計画だけ",
          name: path === "tasks/actual-only.md" ? "実行だけ" : "計画だけ",
          path
        }
      }))
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(2));
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="planned"]')).toHaveLength(1);
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="actual"]')).toHaveLength(1);
    expect(container.querySelector('.chronicle-file-name[title="tasks/planned-only.md"]')).toHaveTextContent("計画だけ");
    expect(container.querySelector('.chronicle-file-name[title="tasks/actual-only.md"]')).toHaveTextContent("実行だけ");

    fireEvent.change(screen.getByLabelText("ステータス"), { target: { value: "完了" } });

    expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1);
    expect(container.querySelector('.chronicle-file-name[title="tasks/planned-only.md"]')).not.toBeInTheDocument();
    expect(container.querySelector('.chronicle-file-name[title="tasks/actual-only.md"]')).toHaveTextContent("実行だけ");
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="planned"]')).toHaveLength(0);
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="actual"]')).toHaveLength(1);
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

  it("チャート更新専用IPCが使えない場合も既存のファイル読み書きでバー変更を保存する", async () => {
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

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "---\nchronicle0: [2026]\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク",
      expectedContent: "---\nchronicle0: [2026]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# 実装タスク",
      path: "tasks/implementation.md"
    }));
  });

  it("旧形式の年表データが返っても年表タブを表示できる", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    expect(document.querySelector(".chronicle-name-column")).toBeNull();
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
  });
});
