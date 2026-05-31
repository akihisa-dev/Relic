import type { EditorView } from "@codemirror/view";
import { beforeEach, vi } from "vitest";

const diagramPreviewMocks = vi.hoisted(() => ({
  compileD2Mock: vi.fn(),
  initializeMock: vi.fn(),
  renderD2Mock: vi.fn(),
  renderMock: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: diagramPreviewMocks.initializeMock,
    render: diagramPreviewMocks.renderMock
  }
}));

vi.mock("@terrastruct/d2", () => ({
  D2: class {
    compile = diagramPreviewMocks.compileD2Mock;
    render = diagramPreviewMocks.renderD2Mock;
  }
}));

export function getDiagramPreviewMocks(): typeof diagramPreviewMocks {
  return diagramPreviewMocks;
}

export function setupDiagramPreviewTest(): void {
  beforeEach(() => {
    diagramPreviewMocks.compileD2Mock.mockReset();
    diagramPreviewMocks.initializeMock.mockReset();
    diagramPreviewMocks.renderD2Mock.mockReset();
    diagramPreviewMocks.renderMock.mockReset();
    document.body.replaceChildren();
    window.relic = undefined;
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
}

export async function loadDiagramPreviewModule() {
  vi.resetModules();
  return await import("./diagramPreview");
}

export function dispatchPointerEvent(target: HTMLElement, type: string, init: {
  button?: number;
  clientX?: number;
  clientY?: number;
  pointerId?: number;
}): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    pointerId: { value: init.pointerId ?? 1 }
  });
  target.dispatchEvent(event);
}

export function dispatchWheelEvent(target: HTMLElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

export function createAttachedContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.append(container);
  return container;
}

export function createFakeEditorView(content: string, fileName = "Note"): EditorView {
  const shell = document.createElement("div");
  shell.className = "cm-editor-shell";
  shell.dataset.outputFileName = fileName;
  document.body.append(shell);

  return {
    dom: shell,
    state: {
      doc: {
        toString: () => content
      }
    }
  } as unknown as EditorView;
}

export async function flushAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function createDeferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
