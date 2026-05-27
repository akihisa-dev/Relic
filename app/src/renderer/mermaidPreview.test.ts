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

  it("不正なmermaidソースでも例外で落とさずフォールバック表示へ戻す", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = document.createElement("div");
    renderMock.mockRejectedValueOnce(new Error("parse failed"));

    await expect(renderMermaidElement(container, "invalid <source>")).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    expect(container.querySelector("pre code")?.textContent).toBe("invalid <source>");
    expect(container.querySelector(".preview-mermaid-expand-button")).toBeNull();
    expect(container.textContent).not.toContain("parse failed");
    warn.mockRestore();
  });

  it("SVG描画成功時に拡大ボタンを追加する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    const button = container.querySelector<HTMLButtonElement>(".preview-mermaid-expand-button");
    const svg = container.querySelector<SVGSVGElement>(".preview-mermaid-svg svg");

    expect(button).not.toBeNull();
    expect(button?.type).toBe("button");
    expect(button?.getAttribute("aria-label")).toBe("Mermaid図を拡大表示");
    expect(button?.title).toBe("Mermaid図を拡大表示");
    expect(svg?.getAttribute("width")).toBe("640px");
    expect(svg?.style.maxWidth).toBe("none");
  });

  it("拡大ボタン押下でオーバーレイを開き、閉じるボタンで閉じる", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    expect(document.querySelector('[role="dialog"][aria-label="Mermaid図の拡大表示"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-modal")).toBe("true");
    expect((document.querySelector('[aria-label="Mermaid拡大表示を閉じる"]') as HTMLButtonElement).type).toBe(
      "button"
    );

    fireEvent.click(document.querySelector('[aria-label="Mermaid拡大表示を閉じる"]') as HTMLButtonElement);

    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("背景クリックで閉じ、図やツールバー操作では閉じない", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const overlay = document.querySelector<HTMLElement>(".preview-mermaid-overlay");
    const surface = document.querySelector<HTMLElement>(".preview-mermaid-overlay-surface");
    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");

    fireEvent.click(surface as HTMLElement);
    expect(document.querySelector(".preview-mermaid-overlay")).not.toBeNull();

    fireEvent.click(viewport as HTMLElement);
    expect(document.querySelector(".preview-mermaid-overlay")).not.toBeNull();

    fireEvent.click(overlay as HTMLElement);
    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("SVGクリックではオーバーレイを開かない", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-svg") as HTMLElement);

    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("拡大ビューはズームボタンを出さずリセットで視点を初期化する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");
    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");
    const resetButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Mermaid図の拡大率と位置をリセット"]'
    );
    const zoomStatus = document.querySelector<HTMLElement>(".preview-mermaid-zoom-status");

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(zoomStatus?.getAttribute("aria-label")).toBe("現在の拡大率");
    expect(zoomStatus?.textContent).toBe("100%");
    expect(document.querySelector('[aria-label="Mermaid図を拡大"]')).toBeNull();
    expect(document.querySelector('[aria-label="Mermaid図を縮小"]')).toBeNull();
    expect(resetButton?.type).toBe("button");

    dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    dispatchPointerEvent(viewport as HTMLElement, "pointermove", { clientX: 40, clientY: 65 });
    expect(content?.style.transform).toBe("translate(30px, 45px) scale(1.2)");
    expect(zoomStatus?.textContent).toBe("120%");

    fireEvent.click(resetButton as HTMLButtonElement);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(zoomStatus?.textContent).toBe("100%");
  });

  it("通常ホイールで拡大率を変更しpreventDefaultする", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");
    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");

    const zoomInEvent = dispatchWheelEvent(viewport as HTMLElement, { ctrlKey: false, deltaY: -1 });

    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.2)");

    const zoomOutEvent = dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });

    expect(zoomOutEvent.defaultPrevented).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("ホイールズームはマウス位置を中心に表示位置を調整する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");
    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");
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

    expect(content?.style.transform).toBe("translate(-10px, -10px) scale(1.2)");
  });

  it("ホイールズームは下限と上限を超えない", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");
    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");
    const zoomStatus = document.querySelector<HTMLElement>(".preview-mermaid-zoom-status");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    }

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(4)");
    expect(zoomStatus?.textContent).toBe("400%");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });
    }

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(0.4)");
    expect(zoomStatus?.textContent).toBe("40%");
  });

  it("ドラッグ移動で表示位置を変更する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");
    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    dispatchPointerEvent(viewport as HTMLElement, "pointermove", { clientX: 40, clientY: 65 });

    expect(content?.style.transform).toBe("translate(30px, 45px) scale(1)");

    dispatchPointerEvent(viewport as HTMLElement, "pointerup", {});
    expect(viewport?.classList.contains("preview-mermaid-overlay-viewport--dragging")).toBe(false);
  });

  it("pointercancelでドラッグ状態を解除する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const viewport = document.querySelector<HTMLElement>(".preview-mermaid-overlay-viewport");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    expect(viewport?.classList.contains("preview-mermaid-overlay-viewport--dragging")).toBe(true);

    dispatchPointerEvent(viewport as HTMLElement, "pointercancel", {});
    expect(viewport?.classList.contains("preview-mermaid-overlay-viewport--dragging")).toBe(false);
  });

  it("拡大ビューviewportはスクロールバーではなくパン操作を前提にする", async () => {
    const css = readFileSync("src/renderer/styles/preview-editor.css", "utf8");

    expect(css).toMatch(/\.preview-mermaid-overlay-viewport\s*{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.preview-mermaid-overlay-viewport\s*{[^}]*cursor:\s*grab;/s);
    expect(css).toMatch(/\.preview-mermaid-overlay-viewport--dragging\s*{[^}]*cursor:\s*grabbing;/s);
    expect(css).toMatch(/\.preview-mermaid-overlay-viewport\s*{[^}]*user-select:\s*none;/s);
    expect(css).not.toMatch(/\.preview-mermaid-overlay-viewport\s*{[^}]*overflow:\s*(auto|scroll);/s);
  });

  it("閉じた後に元のフォーカスへ戻す", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });
    document.body.append(container);

    await renderMermaidElement(container, "graph TD; A-->B");

    const expandButton = container.querySelector<HTMLButtonElement>(".preview-mermaid-expand-button");
    expandButton?.focus();
    fireEvent.click(expandButton as HTMLButtonElement);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(expandButton);
  });

  it("通常コードブロックにはMermaid拡大ボタンを追加しない", async () => {
    const { renderMermaidElements } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    container.innerHTML = '<pre><code class="language-js">const value = 1;</code></pre>';

    renderMermaidElements(container);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector(".preview-mermaid-expand-button")).toBeNull();
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
