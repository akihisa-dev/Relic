import { readFileSync } from "node:fs";

import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: renderMock
  }
}));

async function loadMermaidPreviewModule() {
  vi.resetModules();
  return await import("./mermaidPreview");
}

function dispatchPointerEvent(target: HTMLElement, type: string, init: {
  button?: number;
  clientX?: number;
  clientY?: number;
  pointerId?: number;
}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    pointerId: { value: init.pointerId ?? 1 }
  });
  target.dispatchEvent(event);
}

function dispatchWheelEvent(target: HTMLElement, init: WheelEventInit) {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  initializeMock.mockReset();
  renderMock.mockReset();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-theme");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false })
  });
});

describe("mermaidPreview", () => {
  it("mermaid言語指定を大文字・空白・追加文字列込みで判定する", async () => {
    const { isMermaidLanguage } = await loadMermaidPreviewModule();

    expect(isMermaidLanguage(" Mermaid ")).toBe(true);
    expect(isMermaidLanguage("mermaid something")).toBe(true);
    expect(isMermaidLanguage("js")).toBe(false);
  });

  it("renderMermaidElementsはdata-mermaid-sourceを優先して描画する", async () => {
    const { renderMermaidElements } = await loadMermaidPreviewModule();
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });
    const container = document.createElement("div");
    container.innerHTML = [
      '<div class="preview-mermaid" data-mermaid-source="from-dataset">',
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderMermaidElements(container);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^relic-mermaid-/), "from-dataset");
    });
  });

  it("renderMermaidElementsはエンコード済みdata-mermaid-sourceを復元して描画する", async () => {
    const { renderMermaidElements } = await loadMermaidPreviewModule();
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });
    const container = document.createElement("div");
    const source = 'graph TD; A["<script>"]-->"B"';
    container.innerHTML = [
      `<div class="preview-mermaid" data-mermaid-source="${encodeMermaidSourceAttribute(source)}">`,
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderMermaidElements(container);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^relic-mermaid-/), source);
    });
  });

  it("renderMermaidElementsは壊れたdata-mermaid-sourceを描画に渡さない", async () => {
    const { renderMermaidElements } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    container.innerHTML = [
      '<div class="preview-mermaid" data-mermaid-source="uri:%E0%A4%A">',
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderMermaidElements(container);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("buildMermaidErrorは基本情報を表示する", async () => {
    const { buildMermaidError } = await loadMermaidPreviewModule();
    const element = buildMermaidError("graph TD; A-->", new Error("parse failed"));

    expect(element.classList.contains("preview-mermaid-error")).toBe(true);
    expect(element.textContent).toContain("Mermaidをレンダリングできませんでした");
    expect(element.textContent).toContain("構文を確認してください。");
    expect(element.textContent).toContain("graph TD; A-->");
    expect(element.textContent).toContain("parse failed");
  });

  it("buildMermaidErrorは危険なHTMLをDOM化しない", async () => {
    const { buildMermaidError } = await loadMermaidPreviewModule();
    const source = '<img src=x onerror=alert(1)>';
    const element = buildMermaidError(source, "<script>alert(1)</script>");

    expect(element.querySelector("img")).toBeNull();
    expect(element.querySelector("script")).toBeNull();
    expect(element.textContent).toContain(source);
    expect(element.textContent).toContain("<script>alert(1)</script>");
  });

  it("不正なmermaidソースでも例外で落とさずエラーUIを表示する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = document.createElement("div");
    renderMock.mockRejectedValueOnce(new Error("parse failed"));

    await expect(renderMermaidElement(container, "invalid <source>")).resolves.toBeNull();

    expect(warn).toHaveBeenCalled();
    expect(container.querySelector(".preview-mermaid-error")).not.toBeNull();
    expect(container.textContent).toContain("Mermaidをレンダリングできませんでした");
    expect(container.textContent).toContain("構文を確認してください。");
    expect(container.textContent).toContain("invalid <source>");
    expect(container.textContent).toContain("parse failed");
    expect(container.querySelector(".preview-mermaid-panzoom-viewport")).toBeNull();
    warn.mockRestore();
  });

  it("SVG描画成功時に本文内パン・ズームviewportを構成しhandleを返す", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    const handle = await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");
    const svg = container.querySelector<SVGSVGElement>(".preview-mermaid-svg svg");

    expect(typeof handle?.fitToViewport).toBe("function");
    expect(viewport).not.toBeNull();
    expect(content?.contains(container.querySelector(".preview-mermaid-svg"))).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(container.querySelector(".preview-mermaid-expand-button")).toBeNull();
    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
    expect(svg?.getAttribute("width")).toBe("640px");
    expect(svg?.style.maxWidth).toBe("none");
  });

  it("fitToViewportはviewport内に収まる倍率と中央寄せへ戻す", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    const handle = await renderMermaidElement(container, "graph TD; A-->B");
    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(content, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });

    handle?.fitToViewport();

    expect(content?.style.transform).toBe("translate(24px, 62px) scale(0.55)");
  });

  it("SVGクリックではズームせずオーバーレイも開かない", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");
    fireEvent.click(container.querySelector(".preview-mermaid-svg") as HTMLElement);

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("本文内viewportの通常ホイールで倍率式に拡大率を変更し伝播を止める", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    const parentWheel = vi.fn();
    container.addEventListener("wheel", parentWheel);
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");

    const zoomInEvent = dispatchWheelEvent(viewport as HTMLElement, { ctrlKey: false, deltaY: -1 });

    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(parentWheel).not.toHaveBeenCalled();
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.12)");

    const zoomOutEvent = dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });

    expect(zoomOutEvent.defaultPrevented).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("本文内viewportのホイールズームはマウス位置を中心に表示位置を調整する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");
    vi.spyOn(viewport as HTMLElement, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 10,
      right: 410,
      top: 20,
      width: 400,
      x: 10,
      y: 20,
      toJSON: () => ({})
    });

    dispatchWheelEvent(viewport as HTMLElement, { clientX: 60, clientY: 70, deltaY: -1 });

    expect(content?.style.transform).toBe("translate(-6px, -6px) scale(1.12)");
  });

  it("本文内viewportのホイールズームは下限と上限を超えない", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    }

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(4)");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });
    }

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(0.4)");
  });

  it("本文内viewportのドラッグ移動で表示位置を変更する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-content");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    dispatchPointerEvent(viewport as HTMLElement, "pointermove", { clientX: 40, clientY: 65 });

    expect(content?.style.transform).toBe("translate(30px, 45px) scale(1)");

    dispatchPointerEvent(viewport as HTMLElement, "pointerup", {});
    expect(viewport?.classList.contains("preview-mermaid-panzoom-viewport--dragging")).toBe(false);
  });

  it("本文内viewportはpointercancelでドラッグ状態を解除する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-mermaid-panzoom-viewport");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    expect(viewport?.classList.contains("preview-mermaid-panzoom-viewport--dragging")).toBe(true);

    dispatchPointerEvent(viewport as HTMLElement, "pointercancel", {});
    expect(viewport?.classList.contains("preview-mermaid-panzoom-viewport--dragging")).toBe(false);
  });

  it("本文内viewportはスクロールバーではなくパン操作を前提にする", async () => {
    const css = readFileSync("src/renderer/styles/preview-editor.css", "utf8");

    expect(css).toMatch(/\.preview-mermaid-panzoom-viewport\s*{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.preview-mermaid-panzoom-viewport\s*{[^}]*cursor:\s*grab;/s);
    expect(css).toMatch(/\.preview-mermaid-panzoom-viewport--dragging\s*{[^}]*cursor:\s*grabbing;/s);
    expect(css).toMatch(/\.preview-mermaid-panzoom-viewport\s*{[^}]*user-select:\s*none;/s);
    expect(css).not.toMatch(/\.preview-mermaid\s*{[^}]*overflow:\s*(auto|scroll);/s);
    expect(css).not.toContain("preview-mermaid-overlay");
  });

  it("通常コードブロックにはMermaidパン・ズームUIを追加しない", async () => {
    const { renderMermaidElements } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    container.innerHTML = '<pre><code class="language-js">const value = 1;</code></pre>';

    renderMermaidElements(container);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector(".preview-mermaid-panzoom-viewport")).toBeNull();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("既存テーマに合わせてmermaidテーマを初期化する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    document.documentElement.setAttribute("data-theme", "dark");
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });

    await renderMermaidElement(document.createElement("div"), "graph TD; A-->B");

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      flowchart: { htmlLabels: false },
      htmlLabels: false,
      securityLevel: "strict",
      theme: "dark"
    }));
  });
});
