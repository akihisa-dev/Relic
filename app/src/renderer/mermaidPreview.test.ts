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

    fireEvent.click(document.querySelector('[aria-label="Mermaid拡大表示を閉じる"]') as HTMLButtonElement);

    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("SVGクリックでオーバーレイを開き、Escで閉じる", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-svg") as HTMLElement);

    expect(document.querySelector(".preview-mermaid-overlay")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.querySelector(".preview-mermaid-overlay")).toBeNull();
  });

  it("ズームイン・ズームアウト・リセットで拡大率を変更する", async () => {
    const { renderMermaidElement } = await loadMermaidPreviewModule();
    const container = document.createElement("div");
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>ok</text></svg>' });

    await renderMermaidElement(container, "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-mermaid-expand-button") as HTMLButtonElement);

    const content = document.querySelector<HTMLElement>(".preview-mermaid-overlay-content");
    const zoomInButton = document.querySelector<HTMLButtonElement>('[aria-label="Mermaid図を拡大"]');
    const zoomOutButton = document.querySelector<HTMLButtonElement>('[aria-label="Mermaid図を縮小"]');
    const resetButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Mermaid図の拡大率と位置をリセット"]'
    );

    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");

    fireEvent.click(zoomInButton as HTMLButtonElement);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1.2)");

    fireEvent.click(zoomOutButton as HTMLButtonElement);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");

    fireEvent.click(zoomInButton as HTMLButtonElement);
    fireEvent.click(resetButton as HTMLButtonElement);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
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
