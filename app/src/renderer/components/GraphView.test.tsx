import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { GraphView } from "./GraphView";

const graphViewModelMocks = vi.hoisted(() => ({
  graphNodeAtCanvasPoint: vi.fn()
}));

vi.mock("../graph/graphViewModel", async (importOriginal) => ({
  ...await importOriginal<typeof import("../graph/graphViewModel")>(),
  graphNodeAtCanvasPoint: graphViewModelMocks.graphNodeAtCanvasPoint
}));

function renderGraphView(
  language: "en" | "ja",
  onOpenFile = vi.fn(),
  onOpenTagSearch = vi.fn()
) {
  window.relic = makeRelicApi();

  render(
    <I18nProvider language={language}>
      <GraphView onOpenFile={onOpenFile} onOpenTagSearch={onOpenTagSearch} />
    </I18nProvider>
  );

  return { onOpenFile, onOpenTagSearch };
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  graphViewModelMocks.graphNodeAtCanvasPoint.mockReset();
});

describe("GraphView", () => {
  it("shows graph controls in English", () => {
    renderGraphView("en");

    expect(screen.getByLabelText("Graph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close graph settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play graph timelapse" })).toHaveAttribute("title", "Play timelapse");
    expect(screen.getByRole("button", { name: "Reset graph settings" })).toHaveAttribute("title", "Reset to defaults");
    expect(screen.getByText("0 nodes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByPlaceholderText("Search nodes...")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("shows graph controls in Japanese", () => {
    renderGraphView("ja");

    expect(screen.getByLabelText("グラフ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グラフ設定を閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グラフのタイムラプスを再生" })).toHaveAttribute("title", "タイムラプスを再生");
    expect(screen.getByRole("button", { name: "グラフ設定をリセット" })).toHaveAttribute("title", "初期設定に戻す");
    expect(screen.getByText("0件のノード")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "フィルタ" }));
    expect(screen.getByPlaceholderText("ノードを検索...")).toBeInTheDocument();
    expect(screen.getByText("タグ")).toBeInTheDocument();
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
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 20, clientY: 30 }));
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
});
