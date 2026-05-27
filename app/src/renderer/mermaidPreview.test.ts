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
    expect(container.textContent).not.toContain("parse failed");
    warn.mockRestore();
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
