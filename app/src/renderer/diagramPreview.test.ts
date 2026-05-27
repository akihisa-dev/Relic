import { readFileSync } from "node:fs";

import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeDiagramSourceAttribute } from "./diagramSourceAttribute";

const { compileD2Mock, initializeMock, renderD2Mock, renderMock } = vi.hoisted(() => ({
  compileD2Mock: vi.fn(),
  initializeMock: vi.fn(),
  renderD2Mock: vi.fn(),
  renderMock: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: renderMock
  }
}));

vi.mock("@terrastruct/d2", () => ({
  D2: class {
    compile = compileD2Mock;
    render = renderD2Mock;
  }
}));

async function loadDiagramPreviewModule() {
  vi.resetModules();
  return await import("./diagramPreview");
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

function createAttachedContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.append(container);
  return container;
}

async function flushAnimationFrame() {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  compileD2Mock.mockReset();
  initializeMock.mockReset();
  renderD2Mock.mockReset();
  renderMock.mockReset();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-theme");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false })
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: undefined
  });
});

describe("diagramPreview", () => {
  it("diagramLanguageForはmermaidとd2を大文字・空白・追加文字列込みで判定する", async () => {
    const { diagramLanguageFor } = await loadDiagramPreviewModule();

    expect(diagramLanguageFor(" Mermaid ")).toBe("mermaid");
    expect(diagramLanguageFor("mermaid something")).toBe("mermaid");
    expect(diagramLanguageFor(" D2 ")).toBe("d2");
    expect(diagramLanguageFor("d2 sketch")).toBe("d2");
    expect(diagramLanguageFor("js")).toBeNull();
  });

  it("renderDiagramElementsはdata-diagram-sourceを正としてMermaidを描画する", async () => {
    const { renderDiagramElements } = await loadDiagramPreviewModule();
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });
    const container = createAttachedContainer();
    const source = "graph TD; A-->B";
    container.innerHTML = [
      `<div class="preview-diagram preview-diagram--mermaid" data-diagram-language="mermaid" data-diagram-source="${encodeDiagramSourceAttribute(source)}">`,
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderDiagramElements(container);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^relic-mermaid-/), source);
    });
  });

  it("renderDiagramElementsはエンコード済みdata-diagram-sourceを復元して描画する", async () => {
    const { renderDiagramElements } = await loadDiagramPreviewModule();
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });
    const container = createAttachedContainer();
    const source = 'graph TD; A["<script>"]-->"B"';
    container.innerHTML = [
      `<div class="preview-diagram preview-diagram--mermaid" data-diagram-language="mermaid" data-diagram-source="${encodeDiagramSourceAttribute(source)}">`,
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderDiagramElements(container);

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^relic-mermaid-/), source);
    });
  });

  it("renderDiagramElementsは壊れたdata-diagram-sourceを描画に渡さない", async () => {
    const { renderDiagramElements } = await loadDiagramPreviewModule();
    const container = document.createElement("div");
    container.innerHTML = [
      '<div class="preview-diagram preview-diagram--mermaid" data-diagram-language="mermaid" data-diagram-source="uri:%E0%A4%A">',
      '<pre><code class="language-mermaid">from-code</code></pre>',
      "</div>"
    ].join("");

    renderDiagramElements(container);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("renderDiagramElementsはD2コードブロックを描画する", async () => {
    const { renderDiagramElements } = await loadDiagramPreviewModule();
    compileD2Mock.mockResolvedValueOnce({
      diagram: { root: true },
      renderOptions: { pad: 12 }
    });
    renderD2Mock.mockResolvedValueOnce('<svg viewBox="0 0 120 80"><text>D2</text></svg>');
    const container = createAttachedContainer();
    const source = "x -> y";
    container.innerHTML = [
      `<div class="preview-diagram preview-diagram--d2" data-diagram-language="d2" data-diagram-source="${encodeDiagramSourceAttribute(source)}">`,
      '<pre><code class="language-d2">from-code</code></pre>',
      "</div>"
    ].join("");

    renderDiagramElements(container);

    await vi.waitFor(() => {
      expect(compileD2Mock).toHaveBeenCalledWith("x -> y", { layout: "dagre" });
      expect(renderD2Mock).toHaveBeenCalledWith({ root: true }, { noXMLTag: true, pad: 12 });
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".preview-diagram-svg--d2 svg")?.textContent).toBe("D2");
    });
  });

  it("buildDiagramErrorはMermaidの基本情報を表示する", async () => {
    const { buildDiagramError } = await loadDiagramPreviewModule();
    const element = buildDiagramError("mermaid", "graph TD; A-->", new Error("parse failed"));

    expect(element.classList.contains("preview-diagram-error")).toBe(true);
    expect(element.textContent).toContain("Mermaidをレンダリングできませんでした");
    expect(element.textContent).toContain("構文を確認してください。");
    expect(element.textContent).toContain("graph TD; A-->");
    expect(element.textContent).toContain("parse failed");
    expect(element.textContent).toContain("元ソースをコピー");
    expect(element.textContent).toContain("詳細エラーをコピー");
  });

  it("buildDiagramErrorは危険なHTMLをDOM化しない", async () => {
    const { buildDiagramError } = await loadDiagramPreviewModule();
    const source = '<img src=x onerror=alert(1)>';
    const element = buildDiagramError("mermaid", source, "<script>alert(1)</script>");

    expect(element.querySelector("img")).toBeNull();
    expect(element.querySelector("script")).toBeNull();
    expect(element.textContent).toContain(source);
    expect(element.textContent).toContain("<script>alert(1)</script>");
  });

  it("diagramエラーの元ソースと詳細エラーをクリップボードへコピーできる", async () => {
    const { buildDiagramError } = await loadDiagramPreviewModule();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    const element = buildDiagramError("d2", "x -> y", new Error("compile failed"));
    const buttons = element.querySelectorAll<HTMLButtonElement>(".preview-diagram-error-copy-button");

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("x -> y");
      expect(writeText).toHaveBeenCalledWith("compile failed");
    });
  });

  it("不正なmermaidソースでも例外で落とさずエラーUIを表示する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    renderMock.mockRejectedValueOnce(new Error("parse failed"));

    await expect(renderDiagramElement(container, "mermaid", "invalid <source>")).resolves.toBeNull();

    expect(warn).toHaveBeenCalled();
    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("Mermaidをレンダリングできませんでした");
    expect(container.textContent).toContain("構文を確認してください。");
    expect(container.textContent).toContain("invalid <source>");
    expect(container.textContent).toContain("parse failed");
    expect(container.querySelector(".preview-diagram-panzoom-viewport")).toBeNull();
    warn.mockRestore();
  });

  it("SVG描画成功時に本文内パン・ズームviewportを構成しhandleを返す", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    const handle = await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");
    const svg = container.querySelector<SVGSVGElement>(".preview-diagram-svg--mermaid svg");

    expect(typeof handle?.fitToViewport).toBe("function");
    expect(container.dataset.diagramRenderStatus).toBe("rendered");
    expect(viewport).not.toBeNull();
    expect(viewport?.tabIndex).toBe(0);
    expect(viewport?.getAttribute("aria-label")).toContain("+で拡大");
    expect(viewport?.getAttribute("aria-label")).toContain("Shift+矢印キー");
    expect(content?.contains(container.querySelector(".preview-diagram-svg--mermaid"))).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(container.querySelector(".preview-diagram-expand-button")).toBeNull();
    expect(document.querySelector(".preview-diagram-overlay")).toBeNull();
    expect(svg?.getAttribute("width")).toBe("640px");
    expect(svg?.style.maxWidth).toBe("none");
  });

  it("D2 SVG描画成功時も本文内パン・ズームviewportを構成する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    compileD2Mock.mockResolvedValueOnce({
      diagram: { root: true },
      renderOptions: {}
    });
    renderD2Mock.mockResolvedValueOnce(
      '<svg viewBox="0 0 120 80"><script>alert(1)</script><text onload="alert(1)">d2</text></svg>'
    );

    const handle = await renderDiagramElement(container, "d2", "x -> y");

    expect(typeof handle?.fitToViewport).toBe("function");
    expect(container.dataset.diagramRenderStatus).toBe("rendered");
    expect(container.querySelector(".preview-diagram-svg--d2 svg")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onload]")).toBeNull();
    expect(container.textContent).toContain("d2");
  });

  it("複数D2ブロックの描画はD2 workerの応答が混ざらないよう直列化する", async () => {
    const firstCompile = createDeferred<{ diagram: { id: string }; renderOptions: Record<string, never> }>();
    const firstRender = createDeferred<string>();
    const secondCompile = createDeferred<{ diagram: { id: string }; renderOptions: Record<string, never> }>();
    const secondRender = createDeferred<string>();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const firstContainer = createAttachedContainer();
    const secondContainer = createAttachedContainer();
    compileD2Mock
      .mockReturnValueOnce(firstCompile.promise)
      .mockReturnValueOnce(secondCompile.promise);
    renderD2Mock
      .mockReturnValueOnce(firstRender.promise)
      .mockReturnValueOnce(secondRender.promise);

    const firstResult = renderDiagramElement(firstContainer, "d2", "a -> b");
    const secondResult = renderDiagramElement(secondContainer, "d2", "c -> d");

    await vi.waitFor(() => {
      expect(compileD2Mock).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(compileD2Mock).toHaveBeenCalledWith("a -> b", { layout: "dagre" });
    expect(compileD2Mock).toHaveBeenCalledTimes(1);

    firstCompile.resolve({ diagram: { id: "first" }, renderOptions: {} });
    await vi.waitFor(() => {
      expect(renderD2Mock).toHaveBeenCalledWith({ id: "first" }, { noXMLTag: true });
    });
    firstRender.resolve('<svg viewBox="0 0 120 80"><text>first</text></svg>');
    await firstResult;

    await vi.waitFor(() => {
      expect(compileD2Mock).toHaveBeenCalledTimes(2);
    });
    expect(compileD2Mock).toHaveBeenLastCalledWith("c -> d", { layout: "dagre" });

    secondCompile.resolve({ diagram: { id: "second" }, renderOptions: {} });
    await vi.waitFor(() => {
      expect(renderD2Mock).toHaveBeenLastCalledWith({ id: "second" }, { noXMLTag: true });
    });
    secondRender.resolve('<svg viewBox="0 0 120 80"><text>second</text></svg>');
    await secondResult;

    expect(firstContainer.querySelector(".preview-diagram-svg--d2 svg")?.textContent).toBe("first");
    expect(secondContainer.querySelector(".preview-diagram-svg--d2 svg")?.textContent).toBe("second");
  });

  it("D2 rendererがSVG文字列を返さない場合はエラー表示にする", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    compileD2Mock.mockResolvedValueOnce({
      diagram: { root: true },
      renderOptions: {}
    });
    renderD2Mock.mockResolvedValueOnce({ root: true });

    await expect(renderDiagramElement(container, "d2", "x -> y")).resolves.toBeNull();

    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("D2 renderer did not return SVG text.");
    warn.mockRestore();
  });

  it("fitToViewportはviewport内に収まる倍率と中央寄せへ戻す", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    const handle = await renderDiagramElement(container, "mermaid", "graph TD; A-->B");
    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(content, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });

    handle?.fitToViewport();

    expect(content?.style.transform).toBe("translate(24px, 62px) scale(0.55)");
  });

  it("キーボード操作でズームとパンを変更できる", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    fireEvent.keyDown(viewport as HTMLElement, { key: "+" });
    await flushAnimationFrame();
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.12)");

    fireEvent.keyDown(viewport as HTMLElement, { key: "ArrowRight" });
    await flushAnimationFrame();
    expect(content?.style.transform).toBe("translate(-48px, 0px) scale(1.12)");

    fireEvent.keyDown(viewport as HTMLElement, { key: "ArrowDown", shiftKey: true });
    await flushAnimationFrame();
    expect(content?.style.transform).toBe("translate(-48px, -144px) scale(1.12)");
  });

  it("SVGクリックではズームせずオーバーレイも開かない", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");
    fireEvent.click(container.querySelector(".preview-diagram-svg--mermaid") as HTMLElement);

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(document.querySelector(".preview-diagram-overlay")).toBeNull();
  });

  it("本文内viewportの通常ホイールで倍率式に拡大率を変更し伝播を止める", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    const parentWheel = vi.fn();
    container.addEventListener("wheel", parentWheel);
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    const zoomInEvent = dispatchWheelEvent(viewport as HTMLElement, { ctrlKey: false, deltaY: -1 });
    await flushAnimationFrame();

    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(parentWheel).not.toHaveBeenCalled();
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.12)");

    const zoomOutEvent = dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });
    await flushAnimationFrame();

    expect(zoomOutEvent.defaultPrevented).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("本文内viewportのホイールズームはマウス位置を中心に表示位置を調整する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");
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
    await flushAnimationFrame();

    expect(content?.style.transform).toBe("translate(-6px, -6px) scale(1.12)");
  });

  it("本文内viewportのホイールズームは下限と上限を超えない", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    }
    await flushAnimationFrame();

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(4)");

    for (let i = 0; i < 30; i += 1) {
      dispatchWheelEvent(viewport as HTMLElement, { deltaY: 1 });
    }
    await flushAnimationFrame();

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(0.4)");
  });

  it("ホイールズームのtransform更新をrequestAnimationFrameでまとめる", async () => {
    const callbacks: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const cancelRaf = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");
    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    callbacks.shift()?.(0);

    dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(callbacks).toHaveLength(1);

    callbacks.shift()?.(16);

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.25)");
    raf.mockRestore();
    cancelRaf.mockRestore();
  });

  it("本文内viewportのドラッグ移動で表示位置を変更する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    dispatchPointerEvent(viewport as HTMLElement, "pointermove", { clientX: 40, clientY: 65 });
    await flushAnimationFrame();

    expect(content?.style.transform).toBe("translate(30px, 45px) scale(1)");

    dispatchPointerEvent(viewport as HTMLElement, "pointerup", {});
    expect(viewport?.classList.contains("preview-diagram-panzoom-viewport--dragging")).toBe(false);
  });

  it("本文内viewportはpointercancelでドラッグ状態を解除する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");

    dispatchPointerEvent(viewport as HTMLElement, "pointerdown", { button: 0, clientX: 10, clientY: 20 });
    expect(viewport?.classList.contains("preview-diagram-panzoom-viewport--dragging")).toBe(true);

    dispatchPointerEvent(viewport as HTMLElement, "pointercancel", {});
    expect(viewport?.classList.contains("preview-diagram-panzoom-viewport--dragging")).toBe(false);
  });

  it("ResizeObserverは手動操作前だけviewportサイズ変更後に全体表示へ戻す", async () => {
    let resizeCallback: ResizeObserverCallback = () => undefined;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver
    });
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(content, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });

    resizeCallback?.([], {} as ResizeObserver);
    await flushAnimationFrame();

    expect(content?.style.transform).toBe("translate(24px, 62px) scale(0.55)");
  });

  it("手動操作後のResizeObserverでは勝手に全体表示へ戻さない", async () => {
    let resizeCallback: ResizeObserverCallback = () => undefined;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: MockResizeObserver
    });
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    const handle = await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    const viewport = container.querySelector<HTMLElement>(".preview-diagram-panzoom-viewport");
    const content = container.querySelector<HTMLElement>(".preview-diagram-panzoom-content");

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(content, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });

    handle?.fitToViewport();
    dispatchWheelEvent(viewport as HTMLElement, { deltaY: -1 });
    await flushAnimationFrame();
    const transformedByUser = content?.style.transform;

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 800 });
    resizeCallback?.([], {} as ResizeObserver);
    await flushAnimationFrame();

    expect(content?.style.transform).toBe(transformedByUser);
  });

  it("古いrender結果が後から解決しても新しい内容を上書きしない", async () => {
    const oldRender = createDeferred<{ svg: string }>();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockImplementation((_id: string, source: string) => {
      if (source === "old") return oldRender.promise;
      return Promise.resolve({ svg: '<svg viewBox="0 0 640 320"><text>new</text></svg>' });
    });

    const oldResult = renderDiagramElement(container, "mermaid", "old");
    expect(container.dataset.diagramRenderStatus).toBe("rendering");
    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^relic-mermaid-/), "old");
    });

    await renderDiagramElement(container, "mermaid", "new");
    expect(container.dataset.diagramRenderStatus).toBe("rendered");
    expect(container.textContent).toContain("new");

    oldRender.resolve({ svg: '<svg viewBox="0 0 640 320"><text>old</text></svg>' });
    await expect(oldResult).resolves.toBeNull();

    expect(container.textContent).toContain("new");
    expect(container.textContent).not.toContain("old");
  });

  it("containerがDOMから外れた場合は描画結果を反映しない", async () => {
    const deferredRender = createDeferred<{ svg: string }>();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    container.textContent = "before";
    renderMock.mockReturnValueOnce(deferredRender.promise);

    const result = renderDiagramElement(container, "mermaid", "graph TD; A-->B");
    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });
    container.remove();
    deferredRender.resolve({ svg: '<svg viewBox="0 0 640 320"><text>after</text></svg>' });

    await expect(result).resolves.toBeNull();
    expect(container.dataset.diagramRenderStatus).toBe("stale");
    expect(container.textContent).toBe("before");
  });

  it("Mermaid SVGはDOMPurifyでサニタイズしてから表示する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({
      svg: '<svg viewBox="0 0 640 320"><script>alert(1)</script><text onload="alert(1)">ok</text></svg>'
    });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onload]")).toBeNull();
    expect(container.textContent).toContain("ok");
  });

  it("本文内viewportはdiagram系クラスでスクロールバーではなくパン操作を前提にする", async () => {
    const css = readFileSync("src/renderer/styles/preview-editor.css", "utf8");

    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*cursor:\s*default;/s);
    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*user-select:\s*none;/s);
    expect(css).toMatch(/\.preview-diagram-error\s*{[^}]*user-select:\s*text;/s);
    expect(css).toMatch(/\.preview-diagram-error-details pre\s*{[^}]*user-select:\s*text;/s);
    expect(css).not.toContain("preview-diagram-overlay");
  });

  it("D2ブラウザレンダラーに必要なCSPを許可する", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain("script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'");
    expect(html).toContain("worker-src 'self' blob:");
  });

  it("通常コードブロックにはDiagramパン・ズームUIを追加しない", async () => {
    const { renderDiagramElements } = await loadDiagramPreviewModule();
    const container = document.createElement("div");
    container.innerHTML = '<pre><code class="language-js">const value = 1;</code></pre>';

    renderDiagramElements(container);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector(".preview-diagram-panzoom-viewport")).toBeNull();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("既存テーマに合わせてmermaidテーマを初期化する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    document.documentElement.setAttribute("data-theme", "dark");
    renderMock.mockResolvedValueOnce({ svg: "<svg><text>ok</text></svg>" });

    await renderDiagramElement(document.createElement("div"), "mermaid", "graph TD; A-->B");

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      flowchart: { htmlLabels: false },
      htmlLabels: false,
      securityLevel: "strict",
      theme: "dark"
    }));
  });
});
