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
        '<span style="background-image:url(https://example.com/a.png)">styled</span>',
        '<meta http-equiv="refresh" content="0;url=https://example.com">',
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
    expect(result.html).not.toContain("style=");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<iframe");
    expect(result.html).toContain("<h1");
    const document = new DOMParser().parseFromString(result.html, "text/html");
    expect(document.querySelector("a[href^='javascript:']")).toBeNull();
    expect(document.querySelector("meta[http-equiv='refresh']")).toBeNull();
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

  it("初期ファイル名に使えない文字を安全な文字にする", () => {
    expect(safeOutputFileName('A/B:C*D?"E.md')).toBe("A_B_C_D__E");
    expect(firstH1("前\n# 見出し\n本文")).toBe("見出し");
    expect(buildDiagramDefaultFileName("Note", 2, "d2")).toBe("Note-diagram-2-d2");
  });
});
