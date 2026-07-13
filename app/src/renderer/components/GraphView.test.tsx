import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { GraphView } from "./GraphView";

function renderGraphView(language: "en" | "ja") {
  window.relic = makeRelicApi();

  render(
    <I18nProvider language={language}>
      <GraphView onOpenFile={vi.fn()} onOpenTagSearch={vi.fn()} />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
