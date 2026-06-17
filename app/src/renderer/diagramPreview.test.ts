import { readFileSync } from "node:fs";

import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { encodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { diagramMaxSourceChars, diagramRenderTimeoutMs } from "./diagramLimits";
import {
  createAttachedContainer,
  createDeferred,
  createFakeEditorView,
  getDiagramPreviewMocks,
  loadDiagramPreviewModule,
  setupDiagramPreviewTest
} from "./diagramPreviewTestHelpers";
import { makeRelicApi } from "../test/rendererTestUtils";

setupDiagramPreviewTest();
const { compileD2Mock, initializeMock, renderD2Mock, renderMock } = getDiagramPreviewMocks();

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
      expect(compileD2Mock).toHaveBeenCalledWith({
        fs: { index: "x -> y" },
        options: { layout: "dagre" }
      });
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
    expect(element.textContent).toContain("Mermaid could not be rendered.");
    expect(element.textContent).toContain("Check the syntax.");
    expect(element.textContent).toContain("graph TD; A-->");
    expect(element.textContent).toContain("parse failed");
    expect(element.textContent).toContain("Copy source");
    expect(element.textContent).toContain("Copy error details");
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
    expect(container.textContent).toContain("Mermaid could not be rendered.");
    expect(container.textContent).toContain("Check the syntax.");
    expect(container.textContent).toContain("invalid <source>");
    expect(container.textContent).toContain("parse failed");
    expect(container.querySelector(".preview-diagram-panzoom-viewport")).toBeNull();
    warn.mockRestore();
  });

  it("大きすぎるMermaidソースはレンダラーへ渡さずエラーUIを表示する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    const source = `graph TD;\n${"A-->B\n".repeat(Math.ceil(diagramMaxSourceChars / 5))}`;

    await expect(renderDiagramElement(container, "mermaid", source)).resolves.toBeNull();

    expect(renderMock).not.toHaveBeenCalled();
    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("Mermaid diagram source is too large to render.");
    warn.mockRestore();
  });

  it("大きすぎるD2ソースはレンダラーへ渡さずエラーUIを表示する", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    const source = "x -> y\n".repeat(Math.ceil(diagramMaxSourceChars / 7));

    await expect(renderDiagramElement(container, "d2", source)).resolves.toBeNull();

    expect(compileD2Mock).not.toHaveBeenCalled();
    expect(renderD2Mock).not.toHaveBeenCalled();
    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("D2 diagram source is too large to render.");
    warn.mockRestore();
  });

  it("Mermaid描画が一定時間を超える場合はエラーUIを表示する", async () => {
    vi.useFakeTimers();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    renderMock.mockReturnValueOnce(new Promise(() => undefined));

    const result = renderDiagramElement(container, "mermaid", "graph TD; A-->B");
    await vi.advanceTimersByTimeAsync(diagramRenderTimeoutMs);

    await expect(result).resolves.toBeNull();
    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("Mermaid diagram rendering timed out.");
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("D2描画が一定時間を超える場合はエラーUIを表示する", async () => {
    vi.useFakeTimers();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    compileD2Mock.mockReturnValueOnce(new Promise(() => undefined));

    const result = renderDiagramElement(container, "d2", "x -> y");
    await vi.advanceTimersByTimeAsync(diagramRenderTimeoutMs);

    await expect(result).resolves.toBeNull();
    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.textContent).toContain("D2 diagram rendering timed out.");
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("D2描画がタイムアウトしても元処理が完了するまで次のD2描画を開始しない", async () => {
    vi.useFakeTimers();
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const firstContainer = createAttachedContainer();
    const secondContainer = createAttachedContainer();
    const firstCompile = createDeferred<{ diagram: { id: string }; renderOptions: Record<string, never> }>();
    const firstRender = createDeferred<string>();
    compileD2Mock.mockReturnValueOnce(firstCompile.promise);
    renderD2Mock.mockReturnValueOnce(firstRender.promise);

    const firstResult = renderDiagramElement(firstContainer, "d2", "stuck -> diagram");
    await vi.waitFor(() => {
      expect(compileD2Mock).toHaveBeenCalledTimes(1);
    });
    await vi.advanceTimersByTimeAsync(diagramRenderTimeoutMs);

    await expect(firstResult).resolves.toBeNull();
    expect(firstContainer.dataset.diagramRenderStatus).toBe("error");

    compileD2Mock.mockResolvedValueOnce({
      diagram: { root: true },
      renderOptions: {}
    });
    renderD2Mock.mockResolvedValueOnce('<svg viewBox="0 0 120 80"><text>recovered</text></svg>');

    const secondResult = renderDiagramElement(secondContainer, "d2", "next -> diagram");
    await Promise.resolve();
    expect(compileD2Mock).toHaveBeenCalledTimes(1);

    firstCompile.resolve({ diagram: { id: "first" }, renderOptions: {} });
    await vi.waitFor(() => {
      expect(renderD2Mock).toHaveBeenCalledWith({ id: "first" }, { noXMLTag: true });
    });
    firstRender.resolve('<svg viewBox="0 0 120 80"><text>late</text></svg>');

    await vi.waitFor(() => {
      expect(compileD2Mock).toHaveBeenCalledTimes(2);
    });
    await expect(secondResult).resolves.toEqual(expect.objectContaining({
      fitToViewport: expect.any(Function)
    }));
    expect(secondContainer.dataset.diagramRenderStatus).toBe("rendered");
    expect(secondContainer.querySelector(".preview-diagram-svg--d2 svg")?.textContent).toBe("recovered");
    warn.mockRestore();
    vi.useRealTimers();
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
    expect(viewport?.getAttribute("aria-label")).toContain("Use + to zoom in");
    expect(viewport?.getAttribute("aria-label")).toContain("Shift+arrow keys");
    expect(content?.contains(container.querySelector(".preview-diagram-svg--mermaid"))).toBe(true);
    expect(content?.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(container.querySelector(".preview-diagram-expand-button")?.textContent).toBe("Open large");
    expect(document.querySelector(".preview-diagram-overlay")).toBeNull();
    expect(svg?.getAttribute("width")).toBe("640px");
    expect(svg?.style.maxWidth).toBe("none");
  });

  it("通常プレビューの拡大表示ボタンで大きな図表ビューを開閉できる", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 640 320"><text>large</text></svg>' });

    await renderDiagramElement(container, "mermaid", "graph TD; A-->B");

    fireEvent.click(container.querySelector(".preview-diagram-expand-button") as HTMLButtonElement);

    const overlay = document.querySelector<HTMLElement>(".preview-diagram-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.textContent).toContain("Mermaid diagram");
    expect(overlay?.textContent).toContain("large");
    expect(overlay?.querySelector(".preview-diagram-panzoom-viewport--expanded")).not.toBeNull();

    fireEvent.click(overlay?.querySelectorAll<HTMLButtonElement>(".preview-diagram-overlay-button")[1] as HTMLButtonElement);

    expect(document.querySelector(".preview-diagram-overlay")).toBeNull();
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

  it("Mermaid図でSVG保存操作とSVGコピー操作が出る", async () => {
    const { DiagramBlockWidget } = await import("./editorDiagramLivePreview");
    window.relic = makeRelicApi({
      copyDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "copied" } }),
      saveDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "saved", filePath: "/tmp/note.svg" } })
    });
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 120 80"><text>mermaid</text></svg>' });
    const view = createFakeEditorView("```mermaid\ngraph TD; A-->B\n```", "Note");
    const widget = new DiagramBlockWidget("graph TD; A-->B", "mermaid", 0, 30, 11);
    const element = widget.toDOM(view);
    document.body.append(element);

    await vi.waitFor(() => {
      expect(element.textContent).toContain("Open large");
      expect(element.textContent).toContain("Save as SVG");
      expect(element.textContent).toContain("Copy SVG");
    });

    fireEvent.click(element.querySelectorAll<HTMLButtonElement>(".cm-live-diagram-output-button")[0]);
    fireEvent.click(element.querySelectorAll<HTMLButtonElement>(".cm-live-diagram-output-button")[1]);

    await vi.waitFor(() => {
      expect(window.relic!.saveDiagramSvg).toHaveBeenCalledWith({
        defaultFileName: "Note-diagram-1-mermaid",
        language: "mermaid",
        svg: expect.stringContaining("<svg")
      });
      expect(window.relic!.copyDiagramSvg).toHaveBeenCalledWith({
        language: "mermaid",
        svg: expect.stringContaining("mermaid")
      });
    });
  });

  it("D2図でSVG保存操作とSVGコピー操作が出る", async () => {
    const { DiagramBlockWidget } = await import("./editorDiagramLivePreview");
    window.relic = makeRelicApi({
      copyDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "copied" } }),
      saveDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "saved", filePath: "/tmp/note.svg" } })
    });
    compileD2Mock.mockResolvedValueOnce({
      diagram: { root: true },
      renderOptions: {}
    });
    renderD2Mock.mockResolvedValueOnce('<svg viewBox="0 0 120 80"><path d="M0 0h1" /></svg>');
    const view = createFakeEditorView("```d2\nx -> y\n```", "Note");
    const widget = new DiagramBlockWidget("x -> y", "d2", 0, 16, 6);
    const element = widget.toDOM(view);
    document.body.append(element);

    await vi.waitFor(() => {
      expect(element.textContent).toContain("Save as SVG");
      expect(element.textContent).toContain("Copy SVG");
    });
  });

  it("Diagram描画エラー時にSVG保存/SVGコピー操作が出ない", async () => {
    const { DiagramBlockWidget } = await import("./editorDiagramLivePreview");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderMock.mockRejectedValueOnce(new Error("parse failed"));
    const view = createFakeEditorView("```mermaid\ninvalid\n```", "Note");
    const widget = new DiagramBlockWidget("invalid", "mermaid", 0, 22, 11);
    const element = widget.toDOM(view);
    document.body.append(element);

    await vi.waitFor(() => {
      expect(element.querySelector(".preview-diagram-error")).not.toBeNull();
    });

    expect(element.textContent).not.toContain("SVGとして保存");
    expect(element.textContent).not.toContain("SVGをコピー");
    warn.mockRestore();
  });

  it("pan/zoom操作後でも保存/コピー対象SVGにpan/zoom用wrapperやtransformが混ざらない", async () => {
    const { DiagramBlockWidget } = await import("./editorDiagramLivePreview");
    window.relic = makeRelicApi({
      copyDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "copied" } })
    });
    renderMock.mockResolvedValueOnce({ svg: '<svg viewBox="0 0 120 80"><text>clean</text></svg>' });
    const view = createFakeEditorView("```mermaid\ngraph TD; A-->B\n```", "Note");
    const widget = new DiagramBlockWidget("graph TD; A-->B", "mermaid", 0, 30, 11);
    const element = widget.toDOM(view);
    document.body.append(element);

    await vi.waitFor(() => {
      expect(element.textContent).toContain("Copy SVG");
    });

    const content = element.querySelector<HTMLElement>(".preview-diagram-panzoom-content");
    if (!content) throw new Error("Pan/zoom content was not rendered.");
    content.style.transform = "translate(40px, 20px) scale(2)";
    fireEvent.click(element.querySelectorAll<HTMLButtonElement>(".cm-live-diagram-output-button")[1]);

    await vi.waitFor(() => {
      expect(window.relic!.copyDiagramSvg).toHaveBeenCalled();
    });
    const svg = vi.mocked(window.relic!.copyDiagramSvg).mock.calls[0][0].svg;
    expect(svg).toContain("<svg");
    expect(svg).toContain("clean");
    expect(svg).not.toContain("preview-diagram-panzoom");
    expect(svg).not.toContain("translate(40px, 20px) scale(2)");
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
    expect(compileD2Mock).toHaveBeenCalledWith({
      fs: { index: "a -> b" },
      options: { layout: "dagre" }
    });
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
    expect(compileD2Mock).toHaveBeenLastCalledWith({
      fs: { index: "c -> d" },
      options: { layout: "dagre" }
    });

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

  it("サニタイズ後にSVGが残らない場合は描画成功扱いにしない", async () => {
    const { renderDiagramElement } = await loadDiagramPreviewModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const container = createAttachedContainer();
    renderMock.mockResolvedValueOnce({ svg: "<span>not svg</span>" });

    await expect(renderDiagramElement(container, "mermaid", "graph TD; A-->B")).resolves.toBeNull();

    expect(container.dataset.diagramRenderStatus).toBe("error");
    expect(container.querySelector(".preview-diagram-error")).not.toBeNull();
    expect(container.querySelector(".preview-diagram-panzoom-viewport")).toBeNull();
    expect(container.textContent).toContain("Mermaid renderer did not return SVG text.");
    warn.mockRestore();
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

  it("D2ブラウザレンダラーに必要なCSPだけを許可する", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(html).not.toContain("'unsafe-eval'");
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
