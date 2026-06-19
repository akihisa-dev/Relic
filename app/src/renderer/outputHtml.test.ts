import { afterEach, describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import {
  buildDiagramDefaultFileName,
  buildPreviewOutputHtml,
  firstH1,
  safeOutputFileName
} from "./outputHtml";

describe("outputHtml", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("印刷/PDF用HTMLにアプリUIを含めない", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: "# タイトル\n\n本文\n\n| A | B |\n| - | - |\n| 1 | 2 |",
      fileName: "Note",
      path: "Folder/Note.md",
      t,
      title: "Note",
      workspacePath: "/tmp/relic"
    });

    expect(result.defaultFileName).toBe("Note");
    expect(result.html).toContain('<main class="relic-output-body">');
    expect(result.html).toContain("@page");
    expect(result.html).toContain("margin: 12.7mm 13.8mm;");
    expect(result.html).toContain("size: A4;");
    expect(result.html).toContain("<h1");
    expect(result.html).not.toContain("title-bar");
    expect(result.html).not.toContain("files-sidebar");
    expect(result.html).not.toContain("toolbar-btn");
    expect(result.html).not.toContain("right-panel");
  });

  it("印刷/PDF用HTMLに危険なMarkdown由来HTMLを残さない", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: [
        "# タイトル",
        "",
        "<script>alert(1)</script>",
        '<img src=x onerror="alert(1)">',
        "[x](javascript:alert(1))",
        '<iframe src="https://example.com"></iframe>'
      ].join("\n"),
      fileName: "Note",
      path: "Folder/Note.md",
      t,
      title: "Note",
      workspacePath: "/tmp/relic"
    });

    expect(result.html).not.toContain("<script>alert(1)</script>");
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("<img");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<iframe");
    expect(result.html).toContain("<h1");
    expect(new DOMParser().parseFromString(result.html, "text/html").querySelector("a[href^='javascript:']")).toBeNull();
  });

  it("印刷/PDF用HTMLでも通常Markdown、コードブロック、KaTeX、Mermaid枠を維持する", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: [
        "# タイトル",
        "",
        "本文 **強調**",
        "",
        "$E=mc^2$",
        "",
        "```js",
        "const value = 1;",
        "```",
        "",
        "```mermaid",
        "graph TD; A-->B",
        "```"
      ].join("\n"),
      fileName: "Note",
      path: "Folder/Note.md",
      t,
      title: "Note",
      workspacePath: "/tmp/relic"
    });

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("<strong>強調</strong>");
    expect(result.html).toContain("math-inline");
    expect(result.html).toContain("katex");
    expect(result.html).toContain("hljs language-js");
    expect(result.html).toContain("preview-diagram");
    expect(result.html).toContain('data-diagram-language="mermaid"');
  });

  it("Diagramファイルは自由テキストNodeの図解として出力する", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: [
        "---",
        "type: diagram",
        "title: 図解ファイル",
        "---",
        "",
        "nodes:",
        "  - id: a",
        "    shape: process",
        "    text: 主人公",
        "    x: 0",
        "    y: 0",
        "    width: 192",
        "    height: 96",
        "  - id: b",
        "    shape: decision",
        "    text: 敵対組織",
        "    x: 256",
        "    y: 0",
        "    width: 192",
        "    height: 96",
        "    layer: 1",
        "  - id: c",
        "    shape: area",
        "    text: 勢力範囲",
        "    x: -64",
        "    y: -64",
        "    width: 384",
        "    height: 224",
        "    layer: -1",
        "lines:",
        "  - id: l1",
        "    from: a",
        "    to: b",
        "    label: 対立"
      ].join("\n"),
      fileName: "図解ファイル.md",
      path: "図解ファイル.md",
      t,
      title: "図解ファイル",
      workspacePath: "/tmp/relic"
    });

    expect(result.html).toContain("relic-output-diagram-canvas");
    expect(result.html).toContain("relic-output-diagram-canvas-node--shape-decision");
    expect(result.html).toContain("relic-output-diagram-canvas-node--shape-area");
    expect(result.html).toContain("relic-output-diagram-canvas-node-label--shape-process");
    expect(result.html).toContain("relic-output-diagram-canvas-node-label--shape-decision");
    expect(result.html).toContain("relic-output-diagram-canvas-node-label--area");
    expect(result.html).toContain(">主人公<");
    expect(result.html).toContain(">敵対組織<");
    expect(result.html).toContain(">勢力範囲<");
    expect(result.html).toContain("対立");
    expect(result.html).toContain(".relic-output-diagram-canvas-node--shape-decision::before");
    expect(result.html).toContain(".relic-output-diagram-canvas-node--shape-decision::after");
    expect(result.html).not.toContain("text: 主人公");
  });

  it("Diagramの見た目設定と印刷設定を出力へ反映する", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: [
        "---",
        "type: diagram",
        "formatVersion: 1",
        "title: Styled",
        "---",
        "",
        "printArea:",
        "  x: 32",
        "  y: 64",
        "  width: 500",
        "  height: 300",
        "printSettings:",
        "  paperSize: A3",
        "  orientation: landscape",
        "  marginPreset: small",
        "  scaleMode: actual",
        "  scale: 1.25",
        "nodes:",
        "  - id: a",
        "    shape: process",
        "    text: 色付き",
        "    x: 32",
        "    y: 64",
        "    width: 160",
        "    height: 64",
        "    layer: 1",
        "    color: blue",
        "    textSize: large",
        "    textAlign: left",
        "    verticalAlign: top",
        "  - id: b",
        "    shape: process",
        "    text: 次",
        "    x: 260",
        "    y: 64",
        "    width: 160",
        "    height: 64",
        "    layer: 1",
        "lines:",
        "  - id: l1",
        "    from: a",
        "    to: b",
        "    label: 太い",
        "    labelTextSize: large"
      ].join("\n"),
      fileName: "Styled.md",
      path: "Styled.md",
      t,
      title: "Styled",
      workspacePath: "/tmp/relic"
    });

    expect(result.html).toContain("viewBox=\"192 192 512 320\"");
    expect(result.html).toContain("--diagram-output-node-fill: #d8e6f7");
    expect(result.html).toContain("font-size: 16px");
    expect(result.html).toContain("justify-content: start");
    expect(result.html).toContain("color: #1f1d19");
    expect(result.html).not.toContain("color: #102a4c");
    expect(result.html).toContain("@page { margin: 6mm; size: A3 landscape; }");
    expect(result.printOptions).toMatchObject({
      landscape: true,
      pageSize: "A3",
      scaleFactor: 1.25
    });
  });

  it("初期ファイル名に使えない文字を安全な文字にする", () => {
    expect(safeOutputFileName('A/B:C*D?"E.md')).toBe("A_B_C_D__E");
    expect(firstH1("前\n# 見出し\n本文")).toBe("見出し");
    expect(buildDiagramDefaultFileName("Note", 2, "d2")).toBe("Note-diagram-2-d2");
  });
});
