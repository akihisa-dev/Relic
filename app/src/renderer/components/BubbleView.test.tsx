import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import type { BubbleSimulationPositionsMessage, BubbleSimNode } from "../bubble/bubbleTypes";
import { I18nProvider } from "../i18n";
import { BubbleView } from "./BubbleView";

const bubbleViewModelMocks = vi.hoisted(() => ({
  bubbleCategoryAtWorldPoint: vi.fn(),
  bubbleNodeAtCanvasPoint: vi.fn()
}));
const bubbleSimulationMocks = vi.hoisted(() => ({
  moveNode: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  setCategoryDragTarget: vi.fn(),
  setNodeCategoryCenterOffset: vi.fn(),
  setNodeFixed: vi.fn(),
  onPositions: vi.fn<(message: BubbleSimulationPositionsMessage) => void>(),
  sync: vi.fn()
}));

vi.mock("../bubble/bubbleViewModel", async (importOriginal) => ({
  ...await importOriginal<typeof import("../bubble/bubbleViewModel")>(),
  bubbleCategoryAtWorldPoint: bubbleViewModelMocks.bubbleCategoryAtWorldPoint,
  bubbleNodeAtCanvasPoint: bubbleViewModelMocks.bubbleNodeAtCanvasPoint
}));

vi.mock("../bubble/bubbleSimulationClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("../bubble/bubbleSimulationClient")>(),
  createBubbleSimulationClient: (onPositions: (message: BubbleSimulationPositionsMessage) => void) => {
    bubbleSimulationMocks.onPositions.mockImplementation(onPositions);
    return {
      dispose: vi.fn(),
      moveNode: bubbleSimulationMocks.moveNode,
      pause: bubbleSimulationMocks.pause,
      restart: vi.fn(),
      resume: bubbleSimulationMocks.resume,
      setCategoryDragTarget: bubbleSimulationMocks.setCategoryDragTarget,
      setNodeCategoryCenterOffset: bubbleSimulationMocks.setNodeCategoryCenterOffset,
      setNodeFixed: bubbleSimulationMocks.setNodeFixed,
      sync: bubbleSimulationMocks.sync,
      updateOptions: vi.fn()
    };
  }
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
  bubbleSimulationMocks.pause.mockReset();
  bubbleSimulationMocks.resume.mockReset();
  bubbleSimulationMocks.setCategoryDragTarget.mockReset();
  bubbleSimulationMocks.setNodeFixed.mockReset();
  bubbleSimulationMocks.setNodeCategoryCenterOffset.mockReset();
  bubbleSimulationMocks.onPositions.mockReset();
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

  it("ノードのpointercancelでは開かず、通常クリックでは1回で開く", () => {
    let canvas: HTMLElement;
    const releasePointerCapture = vi.fn();
    const onOpenFile = vi.fn(() => {
      expect(canvas).toHaveStyle("cursor: grab");
      expect(releasePointerCapture).toHaveBeenCalledOnce();
    });
    const onOpenTagSearch = vi.fn();
    renderBubbleView("ja", onOpenFile, onOpenTagSearch);
    canvas = screen.getByLabelText("バブル");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: releasePointerCapture });
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
    releasePointerCapture.mockClear();

    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(fileNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenFile).toHaveBeenCalledWith("note.md");

    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(tagNode);
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 20, clientY: 30 }));
    expect(onOpenTagSearch).toHaveBeenCalledWith("project");
  });

  it("ノードのドラッグでは開かず、次の通常クリックでファイルを開ける", () => {
    const onOpenFile = vi.fn();
    renderBubbleView("ja", onOpenFile);
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
    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockReturnValue(fileNode);

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    expect(bubbleSimulationMocks.pause).not.toHaveBeenCalled();
    expect(bubbleSimulationMocks.setNodeFixed).toHaveBeenCalledWith("note.md", 20, 30, 0);
    expect(bubbleSimulationMocks.resume).not.toHaveBeenCalled();
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 32, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 32, clientY: 30 }));
    expect(bubbleSimulationMocks.setNodeFixed).toHaveBeenLastCalledWith(
      "note.md",
      null,
      null,
      0,
      0,
      0
    );
    expect(bubbleSimulationMocks.resume).not.toHaveBeenCalled();
    expect(onOpenFile).not.toHaveBeenCalled();

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 32, clientY: 30 }));
    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 32, clientY: 30 }));
    expect(onOpenFile).toHaveBeenCalledWith("note.md");
  });

  it("ノードのドラッグで周囲を直接動かさず、Workerから届く自然な移動は反映する", async () => {
    const graph: WorkspaceGraph = {
      links: [],
      nodes: [
        {
          backlinkCount: 0,
          exists: true,
          id: "dragged.md",
          label: "dragged",
          linkCount: 0,
          path: "dragged.md",
          type: "file"
        },
        {
          backlinkCount: 0,
          exists: true,
          id: "target.md",
          label: "target",
          linkCount: 0,
          path: "target.md",
          type: "file"
        }
      ]
    };
    const { getWorkspaceGraph } = renderBubbleView("ja", vi.fn(), vi.fn(), graph);
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledOnce());
    await waitFor(() => expect(bubbleSimulationMocks.sync).toHaveBeenCalled());

    const canvas = screen.getByLabelText("バブル");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });
    let currentNodes: BubbleSimNode[] = [];
    bubbleViewModelMocks.bubbleNodeAtCanvasPoint.mockImplementation(
      (nodes: Iterable<BubbleSimNode>) => {
        currentNodes = [...nodes];
        return currentNodes.find((node) => node.id === "dragged.md") ?? null;
      }
    );

    fireEvent(canvas, new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20
    }));
    const draggedNode = currentNodes.find((node) => node.id === "dragged.md")!;
    const targetNode = currentNodes.find((node) => node.id === "target.md")!;
    draggedNode.fx = 0;
    draggedNode.fy = 0;
    draggedNode.x = 0;
    draggedNode.y = 0;
    targetNode.x = 0;
    targetNode.y = 0;
    fireEvent(canvas, new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 30,
      clientY: 20
    }));
    expect(bubbleSimulationMocks.moveNode).not.toHaveBeenCalled();
    expect(bubbleSimulationMocks.pause).not.toHaveBeenCalled();
    expect(bubbleSimulationMocks.resume).not.toHaveBeenCalled();
    expect(bubbleSimulationMocks.setNodeFixed).toHaveBeenLastCalledWith(
      "dragged.md",
      expect.any(Number),
      expect.any(Number),
      0
    );

    const buffer = new ArrayBuffer(2 * 6 * Float32Array.BYTES_PER_ELEMENT);
    new Float32Array(buffer).set([
      500, 600, 0, 0, 0, 0,
      700, 800, 0, 0, 0, 0
    ]);
    bubbleSimulationMocks.onPositions({
      buffer,
      ids: ["dragged.md", "target.md"],
      sequence: 0,
      type: "positions"
    });

    expect(currentNodes.find((node) => node.id === "dragged.md")?.x)
      .not.toBe(500);
    expect(currentNodes.find((node) => node.id === "target.md")).toMatchObject({
      x: 700,
      y: 800
    });

    fireEvent(canvas, new MouseEvent("pointercancel", {
      bubbles: true,
      clientX: 20,
      clientY: 20
    }));
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
      0,
      0,
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
