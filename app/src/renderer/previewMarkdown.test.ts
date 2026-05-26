import { describe, expect, it } from "vitest";

import {
  extractEmbedTargets,
  normalizeEmbedTarget,
  renderMarkdown,
  toggleNthCheckbox
} from "./previewMarkdown";
import { createTranslator } from "./i18n";
import { decodeMermaidSourceAttribute, encodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

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
      "[[Note#Heading|Alias]]\n\n- [x] Done\n\n<script>alert(1)</script>",
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
  });

  it("mermaidコードブロックを図表示用HTMLとして残す", () => {
    const html = renderMarkdown(
      "```mermaid\ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-mermaid"');
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain("graph TD; A--&gt;B");
    expect(html).not.toContain("hljs language-mermaid");

    const document = new DOMParser().parseFromString(html, "text/html");
    const sourceAttribute = document.querySelector<HTMLElement>(".preview-mermaid")?.dataset.mermaidSource;

    expect(sourceAttribute).toBe(encodeMermaidSourceAttribute("graph TD; A-->B"));
    expect(decodeMermaidSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("通常コードブロックはmermaid図表示用HTMLにしない", () => {
    const html = renderMarkdown(
      "```js\nconst value = 1;\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain("hljs language-js");
    expect(html).not.toContain('class="preview-mermaid"');
    expect(html).not.toContain("data-mermaid-source");
  });

  it("大文字・空白つきのmermaid言語指定を図表示用HTMLとして扱う", () => {
    const html = renderMarkdown(
      "``` Mermaid \ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-mermaid"');
    const document = new DOMParser().parseFromString(html, "text/html");
    const sourceAttribute = document.querySelector<HTMLElement>(".preview-mermaid")?.dataset.mermaidSource;

    expect(decodeMermaidSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("mermaid言語指定後に追加文字列があっても図表示用HTMLとして扱う", () => {
    const html = renderMarkdown(
      "```mermaid something\ngraph TD; A-->B\n```",
      null,
      new Map(),
      true,
      t
    );

    expect(html).toContain('class="preview-mermaid"');
    const document = new DOMParser().parseFromString(html, "text/html");
    const sourceAttribute = document.querySelector<HTMLElement>(".preview-mermaid")?.dataset.mermaidSource;

    expect(decodeMermaidSourceAttribute(sourceAttribute ?? "")).toBe("graph TD; A-->B");
  });

  it("mermaidソースをHTML属性として安全に保持する", () => {
    const source = 'graph TD; A["<script>"]-->"B" onmouseover="alert(1)"';
    const html = renderMarkdown(
      `\`\`\`mermaid\n${source}\n\`\`\``,
      null,
      new Map(),
      true,
      t
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const container = document.querySelector<HTMLElement>(".preview-mermaid");
    const sourceAttribute = container?.dataset.mermaidSource ?? "";

    expect(sourceAttribute).toBe(encodeMermaidSourceAttribute(source));
    expect(sourceAttribute).not.toContain("<");
    expect(sourceAttribute).not.toContain(">");
    expect(sourceAttribute).not.toContain('"');
    expect(decodeMermaidSourceAttribute(sourceAttribute)).toBe(source);
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
