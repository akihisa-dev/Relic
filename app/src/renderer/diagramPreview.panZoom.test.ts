import { readFileSync } from "node:fs";

import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createAttachedContainer,
  dispatchPointerEvent,
  dispatchWheelEvent,
  flushAnimationFrame,
  getDiagramPreviewMocks,
  loadDiagramPreviewModule,
  setupDiagramPreviewTest
} from "./diagramPreviewTestHelpers";

setupDiagramPreviewTest();
const { renderMock } = getDiagramPreviewMocks();

describe("diagramPreview pan/zoom", () => {
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

  it("本文内viewportはdiagram系クラスでスクロールバーではなくパン操作を前提にする", async () => {
    const css = readFileSync("src/renderer/styles/preview-editor.css", "utf8");

    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*cursor:\s*default;/s);
    expect(css).toMatch(/\.preview-diagram-panzoom-viewport\s*{[^}]*user-select:\s*none;/s);
    expect(css).toMatch(/\.preview-diagram-panzoom-viewport--expanded\s*{[^}]*min-height:\s*420px;/s);
    expect(css).toMatch(/\.preview-diagram-error\s*{[^}]*user-select:\s*text;/s);
    expect(css).toMatch(/\.preview-diagram-error-details pre\s*{[^}]*user-select:\s*text;/s);
    expect(css).toContain("preview-diagram-overlay");
  });
});
