import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { BubbleView } from "./BubbleView";

const bubbleViewModelMocks = vi.hoisted(() => ({
  bubbleCategoryAtWorldPoint: vi.fn(),
  bubbleNodeAtCanvasPoint: vi.fn()
}));
const bubbleSimulationMocks = vi.hoisted(() => ({
  moveNode: vi.fn(),
  setCategoryDragTarget: vi.fn(),
  setNodeCategoryCenterOffset: vi.fn(),
  setNodeFixed: vi.fn(),
  sync: vi.fn()
}));

vi.mock("../bubble/bubbleViewModel", async (importOriginal) => ({
  ...await importOriginal<typeof import("../bubble/bubbleViewModel")>(),
  bubbleCategoryAtWorldPoint: bubbleViewModelMocks.bubbleCategoryAtWorldPoint,
  bubbleNodeAtCanvasPoint: bubbleViewModelMocks.bubbleNodeAtCanvasPoint
}));

vi.mock("../bubble/bubbleSimulationClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("../bubble/bubbleSimulationClient")>(),
  createBubbleSimulationClient: () => ({
    dispose: vi.fn(),
    moveNode: bubbleSimulationMocks.moveNode,
    restart: vi.fn(),
    setCategoryDragTarget: bubbleSimulationMocks.setCategoryDragTarget,
    setNodeCategoryCenterOffset: bubbleSimulationMocks.setNodeCategoryCenterOffset,
    setNodeFixed: bubbleSimulationMocks.setNodeFixed,
    sync: bubbleSimulationMocks.sync,
    updateOptions: vi.fn()
  })
}));

function renderBubbleView(
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
      <BubbleView onOpenFile={onOpenFile} onOpenTagSearch={onOpenTagSearch} />
    </I18nProvider>
  );

  return { getWorkspaceGraph, onOpenFile, onOpenTagSearch };
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  bubbleViewModelMocks.bubbleCategoryAtWorldPoint.mockReset();
  bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReset();
  bubbleSimulationMocks.moveNode.mockReset();
  bubbleSimulationMocks.setCategoryDragTarget.mockReset();
  bubbleSimulationMocks.setNodeFixed.mockReset();
  bubbleSimulationMocks.setNodeCategoryCenterOffset.mockReset();
  bubbleSimulationMocks.sync.mockReset();
});

describe("BubbleView", () => {
  it("英語表示でも設定メニューを表示しない", () => {
    renderBubbleView("en");

    expect(screen.getByLabelText("Bubble")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("日本語表示でも設定メニューを表示しない", () => {
    renderBubbleView("ja");

    expect(screen.getByLabelText("バブル")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("バブルを押している間はgrabbingカーソルを表示する", () => {
    renderBubbleView("en");

    const canvas = screen.getByLabelText("Bubble");
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
    const { onOpenFile, onOpenTagSearch } = renderBubbleView("ja");
    const canvas = screen.getByLabelText("バブル");
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
    renderBubbleView("ja", onOpenFile, onOpenTagSearch);
    const canvas = screen.getByLabelText("バブル");
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

    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(fileNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    expect(fileNode).toMatchObject({ fx: 20, fy: 30 });
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 40 }));
    expect(fileNode).toMatchObject({ fx: 30, fy: 40, x: 30, y: 40 });
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 30, clientY: 40 }));
    expect(fileNode).toMatchObject({ fx: null, fy: null });
    expect(onOpenFile).not.toHaveBeenCalled();

    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(tagNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenTagSearch).not.toHaveBeenCalled();

    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(fileNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenFile).toHaveBeenCalledWith("note.md");
  });

  it("バブルのドラッグでは物理演算を続けながら接触した別バブルも押す", async () => {
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
    const { getWorkspaceGraph } = renderBubbleView("ja", vi.fn(), vi.fn(), graph);
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledOnce());
    await waitFor(() => expect(bubbleSimulationMocks.sync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "A.md" }),
        expect.objectContaining({ id: "B.md" }),
        expect.objectContaining({ id: "C.md" }),
        expect.objectContaining({ id: "D.md" })
      ]),
      [],
      expect.any(Object)
    ));

    const canvas = screen.getByLabelText("バブル");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(null);
    bubbleViewModelMocks.bubbleCategoryAtWorldPoint.mockReturnValue("人物");

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

    expect(bubbleSimulationMocks.setCategoryDragTarget).toHaveBeenNthCalledWith(1, {
      centerX: expect.any(Number),
      centerY: expect.any(Number),
      nodeIds: ["A.md", "B.md"]
    });
    expect(bubbleSimulationMocks.moveNode).toHaveBeenCalledWith(
      "A.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(bubbleSimulationMocks.moveNode).toHaveBeenCalledWith(
      "B.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(bubbleSimulationMocks.moveNode).toHaveBeenCalledWith(
      "C.md",
      expect.any(Number),
      expect.any(Number)
    );
    expect(bubbleSimulationMocks.moveNode.mock.calls.some(([id]) => id === "D.md")).toBe(false);
    expect(bubbleSimulationMocks.setNodeFixed).not.toHaveBeenCalled();
    expect(bubbleSimulationMocks.setCategoryDragTarget).toHaveBeenNthCalledWith(2, {
      centerX: expect.any(Number),
      centerY: expect.any(Number),
      nodeIds: ["A.md", "B.md"]
    });
    const initialDragTarget = bubbleSimulationMocks.setCategoryDragTarget.mock.calls[0]![0]!;
    const movedDragTarget = bubbleSimulationMocks.setCategoryDragTarget.mock.calls[1]![0]!;
    expect(movedDragTarget.centerX - initialDragTarget.centerX).toBe(10);
    expect(movedDragTarget.centerY - initialDragTarget.centerY).toBe(-1000);
    expect(bubbleSimulationMocks.setCategoryDragTarget).toHaveBeenNthCalledWith(3, null);
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
    const { getWorkspaceGraph } = renderBubbleView("ja", vi.fn(), vi.fn(), graph);
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledOnce());
    await waitFor(() => expect(bubbleSimulationMocks.sync).toHaveBeenCalled());

    const canvas = screen.getByLabelText("バブル");
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
    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockImplementation(
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

    expect(bubbleSimulationMocks.setNodeCategoryCenterOffset)
      .toHaveBeenCalledWith("guide.md", -20, 0);

    fireEvent(canvas, new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 40,
      clientY: 20
    }));
    expect(bubbleSimulationMocks.setNodeFixed).toHaveBeenCalledWith(
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

    renderBubbleView("ja");
    const canvas = screen.getByLabelText("バブル");
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

    renderBubbleView("ja");
    const canvas = screen.getByLabelText("バブル");
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    act(() => scheduled[0]?.(16));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 12, clientY: 12 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});
