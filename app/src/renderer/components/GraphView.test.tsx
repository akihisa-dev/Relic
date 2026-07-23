import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { GraphView } from "./GraphView";

const graphViewModelMocks = vi.hoisted(() => ({
  graphCategoryAtWorldPoint: vi.fn(),
  graphNodeAtCanvasPoint: vi.fn()
}));
const graphSimulationMocks = vi.hoisted(() => ({
  setNodeCategoryCenterOffset: vi.fn(),
  setNodeFixed: vi.fn(),
  sync: vi.fn()
}));

vi.mock("../graph/graphViewModel", async (importOriginal) => ({
  ...await importOriginal<typeof import("../graph/graphViewModel")>(),
  graphCategoryAtWorldPoint: graphViewModelMocks.graphCategoryAtWorldPoint,
  graphNodeAtCanvasPoint: graphViewModelMocks.graphNodeAtCanvasPoint
}));

vi.mock("../graph/graphSimulationClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("../graph/graphSimulationClient")>(),
  createGraphSimulationClient: () => ({
    dispose: vi.fn(),
    restart: vi.fn(),
    setNodeCategoryCenterOffset: graphSimulationMocks.setNodeCategoryCenterOffset,
    setNodeFixed: graphSimulationMocks.setNodeFixed,
    sync: graphSimulationMocks.sync,
    updateOptions: vi.fn()
  })
}));

function renderGraphView(
  language: "en" | "ja",
  onOpenFile = vi.fn(),
  onOpenTagSearch = vi.fn(),
  graph?: WorkspaceGraph
) {
  const getWorkspaceGraph = vi.fn().mockResolvedValue({
    ok: true,
    value: graph ?? { links: [], nodes: [] }
  });
  window.relic = makeRelicApi({ getWorkspaceGraph });

  render(
    <I18nProvider language={language}>
      <GraphView onOpenFile={onOpenFile} onOpenTagSearch={onOpenTagSearch} />
    </I18nProvider>
  );

  return { getWorkspaceGraph, onOpenFile, onOpenTagSearch };
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  graphViewModelMocks.graphCategoryAtWorldPoint.mockReset();
  graphViewModelMocks.graphNodeAtCanvasPoint.mockReset();
  graphSimulationMocks.setNodeFixed.mockReset();
  graphSimulationMocks.setNodeCategoryCenterOffset.mockReset();
  graphSimulationMocks.sync.mockReset();
});

describe("GraphView", () => {
  it("英語表示でも設定メニューを表示しない", () => {
    renderGraphView("en");

    expect(screen.getByLabelText("Graph")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("日本語表示でも設定メニューを表示しない", () => {
    renderGraphView("ja");

    expect(screen.getByLabelText("グラフ")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("グラフを押している間はgrabbingカーソルを表示する", () => {
    renderGraphView("en");

    const canvas = screen.getByLabelText("Graph");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
    expect(canvas).toHaveStyle("cursor: grabbing");

    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 8, clientY: 8 }));
    expect(canvas).toHaveStyle("cursor: grabbing");

    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 8, clientY: 8 }));
    expect(canvas).toHaveStyle("cursor: grab");
  });

  it("背景パンのpointercancelでは操作を確定せず、次の操作を開始できる", () => {
    const { onOpenFile, onOpenTagSearch } = renderGraphView("ja");
    const canvas = screen.getByLabelText("グラフ");
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: setPointerCapture });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: releasePointerCapture });

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 20 }));
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 30, clientY: 20 }));

    expect(releasePointerCapture).toHaveBeenCalledOnce();
    expect(canvas).toHaveStyle("cursor: grab");
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(onOpenTagSearch).not.toHaveBeenCalled();

    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 30, clientY: 20 }));
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 12, clientY: 12 }));
    expect(setPointerCapture).toHaveBeenCalledTimes(2);
    expect(canvas).toHaveStyle("cursor: grabbing");
  });

  it("ノードのpointercancelでは固定だけを解除し、通常のpointerup動作を維持する", () => {
    const onOpenFile = vi.fn();
    const onOpenTagSearch = vi.fn();
    renderGraphView("ja", onOpenFile, onOpenTagSearch);
    const canvas = screen.getByLabelText("グラフ");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
    const fileNode = {
      backlinkCount: 0,
      category: "人物",
      exists: true,
      fx: null,
      fy: null,
      id: "note.md",
      label: "note",
      linkCount: 0,
      path: "note.md",
      type: "file" as const,
      vx: 0,
      vy: 0,
      x: 20,
      y: 30
    };
    const tagNode = {
      ...fileNode,
      exists: false,
      id: "#project",
      label: "#project",
      path: null,
      type: "tag" as const
    };

    graphViewModelMocks.graphNodeAtCanvasPoint.mockReturnValue(fileNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    expect(fileNode).toMatchObject({ fx: 20, fy: 30 });
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 40 }));
    expect(fileNode).toMatchObject({ fx: 30, fy: 40, x: 30, y: 40 });
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 30, clientY: 40 }));
    expect(fileNode).toMatchObject({ fx: null, fy: null });
    expect(onOpenFile).not.toHaveBeenCalled();

    graphViewModelMocks.graphNodeAtCanvasPoint.mockReturnValue(tagNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenTagSearch).not.toHaveBeenCalled();

    graphViewModelMocks.graphNodeAtCanvasPoint.mockReturnValue(fileNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenFile).toHaveBeenCalledWith("note.md");
  });

  it("バブルのドラッグでは接触した別バブルも押し、中断時に全固定を解除する", async () => {
    const graph: WorkspaceGraph = {
      links: [],
      nodes: [
        {
          backlinkCount: 0,
          category: "人物",
          exists: true,
          id: "A.md",
          label: "A",
          linkCount: 0,
          path: "A.md",
          type: "file"
        },
        {
          backlinkCount: 0,
          category: "人物",
          exists: true,
          id: "B.md",
          label: "B",
          linkCount: 0,
          path: "B.md",
          type: "file"
        },
        {
          backlinkCount: 0,
          category: "資料",
          exists: true,
          id: "C.md",
          label: "C",
          linkCount: 0,
          path: "C.md",
          type: "file"
        },
        {
          backlinkCount: 0,
          exists: true,
          id: "D.md",
          label: "D",
          linkCount: 0,
          path: "D.md",
          type: "file"
        }
      ]
    };
    const { getWorkspaceGraph } = renderGraphView("ja", vi.fn(), vi.fn(), graph);
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledOnce());
    await waitFor(() => expect(graphSimulationMocks.sync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "A.md" }),
        expect.objectContaining({ id: "B.md" }),
        expect.objectContaining({ id: "C.md" }),
        expect.objectContaining({ id: "D.md" })
      ]),
      [],
      expect.any(Object)
    ));

    const canvas = screen.getByLabelText("グラフ");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
    graphViewModelMocks.graphNodeAtCanvasPoint.mockReturnValue(null);
    graphViewModelMocks.graphCategoryAtWorldPoint.mockReturnValue("人物");

    fireEvent(canvas, new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20
    }));
    fireEvent(canvas, new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 30,
      clientY: -980
    }));
    fireEvent.lostPointerCapture(canvas, { pointerId: 1 });

    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith(
      "A.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith(
      "B.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith("A.md", null, null, 0.08);
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith("B.md", null, null, 0.08);
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith(
      "C.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith("C.md", null, null, 0.08);
    expect(graphSimulationMocks.setNodeFixed.mock.calls.some(([id]) => id === "D.md")).toBe(false);
  });

  it("単一ノードをドラッグしてもバブル中心を同じ位置に保つ", async () => {
    const graph: WorkspaceGraph = {
      links: [],
      nodes: [{
        backlinkCount: 0,
        category: "案内",
        exists: true,
        id: "guide.md",
        label: "guide",
        linkCount: 0,
        path: "guide.md",
        type: "file"
      }]
    };
    const { getWorkspaceGraph } = renderGraphView("ja", vi.fn(), vi.fn(), graph);
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledOnce());
    await waitFor(() => expect(graphSimulationMocks.sync).toHaveBeenCalled());

    const canvas = screen.getByLabelText("グラフ");
    Object.defineProperty(canvas, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(canvas, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true)
    });
    Object.defineProperty(canvas, "releasePointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    graphViewModelMocks.graphNodeAtCanvasPoint.mockImplementation(
      (nodes: Iterable<unknown>) => [...nodes][0] ?? null
    );

    fireEvent(canvas, new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20
    }));
    fireEvent(canvas, new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 40,
      clientY: 20
    }));

    expect(graphSimulationMocks.setNodeCategoryCenterOffset)
      .toHaveBeenCalledWith("guide.md", -20, 0);

    fireEvent(canvas, new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 40,
      clientY: 20
    }));
    expect(graphSimulationMocks.setNodeFixed).toHaveBeenCalledWith(
      "guide.md",
      null,
      null,
      0.08,
      expect.any(Number),
      0
    );
  });

  it("テーマ属性とOSの配色変更時だけ描画色を更新する", async () => {
    let notifyColorSchemeChange = () => undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        notifyColorSchemeChange = () => {
          if (typeof listener === "function") listener(new Event("change"));
          else listener.handleEvent(new Event("change"));
        };
      },
      dispatchEvent: vi.fn(),
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      removeEventListener: vi.fn()
    })));
    const computedStyle = vi.spyOn(window, "getComputedStyle");

    renderGraphView("ja");
    const canvas = screen.getByLabelText("グラフ");
    await waitFor(() => expect(computedStyle).toHaveBeenCalledWith(canvas));

    computedStyle.mockClear();
    document.documentElement.dataset.theme = "dark";
    await waitFor(() => expect(computedStyle).toHaveBeenCalledWith(canvas));

    computedStyle.mockClear();
    notifyColorSchemeChange();
    expect(computedStyle).not.toHaveBeenCalled();

    document.documentElement.removeAttribute("data-theme");
    await waitFor(() => expect(computedStyle).toHaveBeenCalledWith(canvas));
    computedStyle.mockClear();
    notifyColorSchemeChange();
    expect(computedStyle).toHaveBeenCalledWith(canvas);
  });

  it("静止時は描画予約を止め、最初の操作で重複なく再開する", () => {
    const scheduled: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      scheduled.push(callback);
      return scheduled.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

    renderGraphView("ja");
    const canvas = screen.getByLabelText("グラフ");
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    act(() => scheduled[0]?.(16));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 12, clientY: 12 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});
