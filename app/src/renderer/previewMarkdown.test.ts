import { describe, expect, it } from "vitest";

import {
  extractEmbedTargets,
  normalizeEmbedTarget,
  renderMarkdown,
  toggleNthCheckbox
} from "./previewMarkdown";
import { createTranslator } from "./i18nModel";
import { decodeDiagramSourceAttribute, encodeDiagramSourceAttribute } from "./diagramSourceAttribute";

const t = createTranslator("ja");

describe("previewMarkdown", () => {
  it("Markdownファイルとして読める埋め込み先へ正規化する", () => {
    expect(normalizeEmbedTarget("Folder/Note")).toBe("Folder/Note.md");
    expect(normalizeEmbedTarget("Folder/Note.md#見出し")).toBe("Folder/Note.md");
    expect(normalizeEmbedTarget("Folder/Note^block")).toBe("Folder/Note.md");
    expect(normalizeEmbedTarget("Folder/image.png")).toBeNull();
    expect(normalizeEmbedTarget("../secret")).toBeNull();
    expect(normalizeEmbedTarget("https://example.com/note.md")).toBeNull();
  });

  it("指定した順番のチェックボックスだけを切り替える", () => {
    expect(toggleNthCheckbox("- [ ] 一\n- [x] 二\n- [ ] 三", 1)).toBe("- [ ] 一\n- [ ] 二\n- [ ] 三");
  });

  it("重複と無効値を除いて埋め込み先を抽出する", () => {
    expect(extractEmbedTargets("![[A]] ![[A.md#見出し]] ![[image.png]] ![[../secret]] ![[B\\C]]")).toEqual([
      "A.md",
      "B/C.md"
    ]);
  });

  it("主要なclassとdata属性を残しながら危険なHTMLを除去する", () => {
    const html = renderMarkdown(
      [
        "[[Note#Heading|Alias]]",
        "",
        "- [x] Done",
        "",
        "<script>alert(1)</script>",
        '<img src=x onerror="alert(1)">',
        '<iframe src="https://example.com"></iframe>',
        "[x](javascript:alert(1))"
      ].join("\n"),
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="wikilink"');
    expect(html).toContain('data-target="Note#Heading"');
    expect(html).toContain('class="preview-checkbox"');
    expect(html).toContain("checked");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
    expect(new DOMParser().parseFromString(html, "text/html").querySelector("a[href^='javascript:']")).toBeNull();
  });

  it("file URLをリンク先として残さない", () => {
    const html = renderMarkdown("[local](file:///Users/example/secret.md)", null, new Map(), true, t);

    const document = new DOMParser().parseFromString(html, "text/html");
    const link = document.querySelector("a");

    expect(link).toBeNull();
    expect(html).toContain("local");
    expect(html).not.toContain("file:");
  });

  it("mermaidコードブロックをDiagram表示用HTMLとして残す", () => {
    const html = renderMarkdown(
      "```mermaid\ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-diagram preview-diagram--mermaid"');
    expect(html).toContain('data-diagram-language="mermaid"');
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain("graph TD; A--&gt;B");
    expect(html).not.toContain("hljs language-mermaid");

    const document = new DOMParser().parseFromString(html, "text/html");
    const container = document.querySelector<HTMLElement>(".preview-diagram");
    const sourceAttribute = container?.dataset.diagramSource;

    expect(sourceAttribute).toBe(encodeDiagramSourceAttribute("graph TD; A-->B"));
    expect(decodeDiagramSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("d2コードブロックをDiagram表示用HTMLとして残す", () => {
    const html = renderMarkdown(
      "```d2\nuser -> app: opens\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-diagram preview-diagram--d2"');
    expect(html).toContain('data-diagram-language="d2"');
    expect(html).toContain('class="language-d2"');
    expect(html).toContain("user -&gt; app: opens");
    expect(html).not.toContain("hljs language-d2");

    const document = new DOMParser().parseFromString(html, "text/html");
    const container = document.querySelector<HTMLElement>(".preview-diagram");

    expect(container?.dataset.diagramSource).toBe(encodeDiagramSourceAttribute("user -> app: opens"));
  });

  it("通常コードブロックはDiagram表示用HTMLにしない", () => {
    const html = renderMarkdown(
      "```js\nconst value = 1;\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain("hljs language-js");
    expect(html).not.toContain('class="preview-diagram');
    expect(html).not.toContain("data-diagram-source");
  });

  it("通常Markdown、コードブロック、KaTeXをsanitize後も維持する", () => {
    const html = renderMarkdown(
      "# 見出し\n\n本文 **強調**\n\n$E=mc^2$\n\n```js\nconst value = 1;\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain("<h1");
    expect(html).toContain("<strong>強調</strong>");
    expect(html).toContain("math-inline");
    expect(html).toContain("katex");
    expect(html).toContain("hljs language-js");
    expect(html).toContain("const");
  });

  it("コードブロック内の危険URL例は説明用テキストとして維持する", () => {
    const html = renderMarkdown("```md\n[x](javascript:alert(1))\n```", null, new Map(), true, t);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("code")?.textContent).toBe("[x](javascript:alert(1))");
    expect(document.querySelector("a[href^='javascript:']")).toBeNull();
  });

  it("カスタムMarkdown拡張の表示文字列をHTMLとして実行しない", () => {
    const html = renderMarkdown(
      '==<img src=x onerror="alert(1)">==\n\n[[Note" onclick="alert(1)|<script>alert(1)</script>]]',
      null,
      new Map(),
      true,
      t
    );

    const document = new DOMParser().parseFromString(html, "text/html");
    const wikiLink = document.querySelector<HTMLElement>(".wikilink");

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("[onerror]")).toBeNull();
    expect(wikiLink?.dataset.target).toBe('Note" onclick="alert(1)');
    expect(wikiLink?.getAttribute("onclick")).toBeNull();
    expect(wikiLink?.textContent).toBe("<script>alert(1)</script>");
  });

  it("大文字・空白つきのmermaid言語指定をDiagram表示用HTMLとして扱う", () => {
    const html = renderMarkdown(
      "``` Mermaid \ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-diagram preview-diagram--mermaid"');
    const document = new DOMParser().parseFromString(html, "text/html");
    const sourceAttribute = document.querySelector<HTMLElement>(".preview-diagram")?.dataset.diagramSource;

    expect(decodeDiagramSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("mermaid言語指定後に追加文字列があってもDiagram表示用HTMLとして扱う", () => {
    const html = renderMarkdown(
      "```mermaid something\ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-diagram preview-diagram--mermaid"');
    const document = new DOMParser().parseFromString(html, "text/html");
    const sourceAttribute = document.querySelector<HTMLElement>(".preview-diagram")?.dataset.diagramSource;

    expect(decodeDiagramSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("DiagramソースをHTML属性として安全に保持する", () => {
    const source = 'graph TD; A["<script>"]-->"B" onmouseover="alert(1)"';
    const html = renderMarkdown(
      `\`\`\`mermaid\n${source}\n\`\`\``,
      null,
      new Map(),
      true,
      t
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const container = document.querySelector<HTMLElement>(".preview-diagram");
    const sourceAttribute = container?.dataset.diagramSource ?? "";

    expect(sourceAttribute).toBe(encodeDiagramSourceAttribute(source));
    expect(sourceAttribute).not.toContain("<");
    expect(sourceAttribute).not.toContain(">");
    expect(sourceAttribute).not.toContain('"');
    expect(decodeDiagramSourceAttribute(sourceAttribute)).toBe(source);
    expect(container?.getAttribute("onmouseover")).toBeNull();
    expect(container?.querySelector("code")?.textContent).toBe(source);
  });

  it("埋め込みHTMLは一段階だけ描画する", () => {
    const html = renderMarkdown(
      "![[Parent]]",
      null,
      new Map([["Parent.md", { status: "loaded", content: "# Parent\n\n![[Child]]", name: "Parent" }]]),
      true,
      t
    );

    expect(html).toContain("preview-file-embed");
    expect(html).toContain("Parent");
    expect(html).toContain('class="wikilink"');
    expect(html).toContain('data-target="Child"');
    expect(html).not.toContain("Child.md を読み込んでいます");
  });
});
