import { readFileSync } from "node:fs";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { findClickableLinkAtPosition } from "../editorLivePreview";
import { Editor } from "./Editor";
import {
  collectInlineLivePreviewWidgetClasses,
  collectInlineLivePreviewWidgets,
  collectLivePreviewClasses,
  collectLivePreviewReplacementRanges,
  settings
} from "./editorTestHelpers";

describe("Editor live preview", () => {
  it("ライブプレビューでカーソル外のMarkdown記法を装飾する", async () => {
    const content = "==mark==\n\nx";
    const classes = await collectInlineLivePreviewWidgetClasses(content, content.length);

    expect(classes).toContain("cm-live-highlight");
  });

  it("ライブプレビューでカーソル位置のMarkdown記法もレンダリングを維持する", async () => {
    const classes = await collectLivePreviewClasses("==mark==", 3);

    expect(classes.has("cm-live-highlight")).toBe(true);
    expect(classes.size).toBe(1);
  });

  it("ライブプレビューでカーソル位置の強調もレンダリングを維持する", async () => {
    const classes = await collectLivePreviewClasses("**bold**", 3);

    expect(classes.has("cm-live-bold")).toBe(true);
  });

  it("ライブプレビューで装飾文字にカーソルが触れたら編集用Markdown記法を隠さない", async () => {
    const boldRanges = await collectLivePreviewReplacementRanges("**bold**", 3);
    const linkRanges = await collectLivePreviewReplacementRanges("[link](https://example.com)", 2);
    const listRanges = await collectLivePreviewReplacementRanges("- item", 3);

    expect(boldRanges).toEqual([]);
    expect(linkRanges).toEqual([]);
    expect(listRanges).toEqual([]);
  });

  it("ライブプレビューでカーソル外の装飾は読みやすい置換表示を維持する", async () => {
    const content = "**bold**\nplain";
    const ranges = await collectLivePreviewReplacementRanges(content, content.length);

    expect(ranges).toEqual([
      { block: false, from: 0, to: 8, widget: "InlineFormatWidget" }
    ]);
  });

  it("ライブプレビューで主要なインライン記法を安定して装飾する", async () => {
    const widgetClasses = await collectInlineLivePreviewWidgetClasses([
      "**bold**",
      "*italic*",
      "~~strike~~",
      "`code`",
      "==mark==",
      "<u>underline</u>",
      "$x^2$",
      "[^note]",
      "[link](https://example.com)",
      "![diagram](assets/diagram.png)",
      "[[Page]]"
    ].join("\n"), 0, false, "/tmp/Notes");

    expect(widgetClasses).toEqual(expect.arrayContaining([
      "cm-live-bold",
      "cm-live-italic",
      "cm-live-strike",
      "cm-live-code",
      "cm-live-highlight",
      "cm-live-underline",
      "cm-live-math-inline",
      "cm-live-footnote-ref",
      "cm-live-image",
      "cm-live-link"
    ]));
  });

  it("ライブプレビューでワークスペース内のMarkdown画像を画像Widget表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets(
      "![diagram](assets/diagram.png)",
      0,
      false,
      "/tmp/Notes"
    );
    const widgetClasses = await collectInlineLivePreviewWidgetClasses(
      "![diagram](assets/diagram.png)",
      0,
      false,
      "/tmp/Notes"
    );

    expect(widgets).toContain("ImageWidget");
    expect(widgetClasses).toContain("cm-live-image");
  });

  it("ライブプレビューでカーソルが画像記法に触れたらMarkdownソースを表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets(
      "![diagram](assets/diagram.png)",
      3,
      true,
      "/tmp/Notes"
    );

    expect(widgets).not.toContain("ImageWidget");
  });

  it("ライブプレビューで数式と脚注定義をWidget表示する", async () => {
    const content = [
      "$$",
      "x^2 + y^2",
      "$$",
      "",
      "[^note]: footnote text"
    ].join("\n");
    const widgets = await collectInlineLivePreviewWidgets(content, 0, false);
    const widgetClasses = await collectInlineLivePreviewWidgetClasses(content, 0, false);

    expect(widgets).toContain("MathWidget");
    expect(widgets).toContain("FootnoteDefinitionMarkerWidget");
    expect(widgetClasses).toContain("cm-live-math-block");
    expect(widgetClasses).toContain("cm-live-footnote-def");
  });

  it("ライブプレビューでブロック数式の後続本文を欠落させない", async () => {
    const content = [
      "## 装飾",
      "本文",
      "",
      "$a^2 + b^2 = c^2$",
      "",
      "$$",
      "score = \\frac{6}{3}",
      "$$",
      "",
      "## コード",
      "```yaml",
      "sample: 11",
      "```"
    ].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-math-block .katex")).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-header")).not.toBeNull());

    expect(container.textContent).toContain("コード");
    expect(container.textContent).toContain("yaml");
    expect(container.textContent).not.toContain("$$");
    expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull();
    expect(container.querySelector(".cm-live-code-block-source")?.textContent).toBe("sample: 11");
    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).toContain("10");
  });

  it("ライブプレビューでブロック数式を閉じ行まで1つのblock Widgetに置換する", async () => {
    const content = [
      "$$",
      "score = \\frac{6}{3}",
      "$$",
      "",
      "## コード"
    ].join("\n");
    const ranges = await collectLivePreviewReplacementRanges(content, 0, false);
    const mathRanges = ranges.filter((range) => range.widget === "MathWidget");
    const blockTo = content.indexOf("\n\n## コード");

    expect(mathRanges).toEqual([
      { block: true, from: 0, to: blockTo, widget: "MathWidget" }
    ]);
  });

  it("ライブプレビューの数式は本文行の折り返し指定を継承しない", () => {
    const css = readFileSync("src/renderer/styles/preview-editor.css", "utf8");

    expect(css).toMatch(/\.cm-live-math-inline,\s*\.cm-live-math-block\s*\{[^}]*overflow-wrap:\s*normal;/s);
    expect(css).toMatch(/\.cm-live-math-inline,\s*\.cm-live-math-block\s*\{[^}]*white-space:\s*normal;/s);
    expect(css).toMatch(/\.cm-live-math-inline,\s*\.cm-live-math-block\s*\{[^}]*word-break:\s*normal;/s);
    expect(css).toMatch(/\.cm-live-math-inline \.katex,\s*\.cm-live-math-inline \.katex \*,\s*\.cm-live-math-block \.katex,\s*\.cm-live-math-block \.katex \*\s*\{[^}]*white-space:\s*nowrap;/s);
  });

  it("ライブプレビューの数式はKaTeXの位置合わせ用styleを保持する", async () => {
    const { container } = render(
      <Editor
        content={"本文 $\\frac{6}{3}$"}
        onChange={() => undefined}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-math-inline .katex")).not.toBeNull());

    expect(container.querySelector(".cm-live-math-inline [style]")).not.toBeNull();
  });

  it("カーソルが数式と脚注に触れたときはMarkdownソースを表示する", async () => {
    const mathClasses = await collectInlineLivePreviewWidgetClasses("$x^2$", 2);
    const footnoteClasses = await collectInlineLivePreviewWidgetClasses("[^note]", 2);
    const blockMathWidgets = await collectInlineLivePreviewWidgets("$$\nx^2\n$$", 3);

    expect(mathClasses).not.toContain("cm-live-math-inline");
    expect(footnoteClasses).not.toContain("cm-live-footnote-ref");
    expect(blockMathWidgets).not.toContain("MathWidget");
  });

  it("ライブ表示で置換されたリンクの先頭位置クリックもリンクとして扱う", () => {
    const state = EditorState.create({
      doc: "トップ: [リンク確認用トップ](./00-リンク確認用トップ.md)\nWiki: [[01-企画メモ]]"
    });

    expect(findClickableLinkAtPosition(state.doc, 5)).toEqual({
      href: "./00-リンク確認用トップ.md",
      type: "markdown"
    });
    expect(findClickableLinkAtPosition(state.doc, 45)).toEqual({
      heading: undefined,
      target: "01-企画メモ",
      type: "wiki"
    });
  });

  it("ライブプレビューでブロック記法を安定して装飾する", async () => {
    const content = [
      "> quote",
      "```",
      "code",
      "```"
    ].join("\n");
    const classes = await collectLivePreviewClasses(content, 0, false);

    expect(Array.from(classes)).toContain("cm-live-blockquote");
  });

  it("ライブプレビューでmermaidコードブロックを図Widget表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets([
      "```mermaid",
      "graph TD; A-->B",
      "```"
    ].join("\n"), 0, false);

    expect(widgets).toContain("DiagramBlockWidget");
  });

  it("ライブプレビューでd2コードブロックを図Widget表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets([
      "```d2",
      "x -> y",
      "```"
    ].join("\n"), 0, false);

    expect(widgets).toContain("DiagramBlockWidget");
  });

  it("4連バッククォートの中にある3連バッククォートdiagramは図Widgetにしない", async () => {
    const content = [
      "````markdown",
      "```mermaid",
      "graph TD; A-->B",
      "```",
      "````"
    ].join("\n");
    const widgets = await collectInlineLivePreviewWidgets(content, content.indexOf("graph TD"), false);

    expect(widgets).not.toContain("DiagramBlockWidget");
  });

  it("ライブプレビューでmermaidコードブロックを開いてもエディタが落ちない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={[
          "# Mermaid",
          "",
          "```mermaid",
          "graph TD; A-->B",
          "```"
        ].join("\n")}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).not.toBeNull());
  });

  it("ライブプレビューでカーソルが図ブロック内にあるだけでは図表示を維持する", async () => {
    const content = [
      "```mermaid",
      "graph TD; A-->B",
      "```"
    ].join("\n");
    const widgets = await collectInlineLivePreviewWidgets(content, content.indexOf("A-->B"), true);

    expect(widgets).toContain("DiagramBlockWidget");
  });

  it("図Widget操作ではソース表示へ戻らず、ソースを編集ボタンでだけソース表示にする", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = [
      "# Mermaid",
      "",
      "```mermaid",
      "graph TD; A-->B",
      "```",
      "",
      "本文"
    ].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).not.toBeNull());

    const diagramWidget = container.querySelector(".cm-live-diagram") as HTMLElement;

    fireEvent.click(diagramWidget);
    fireEvent.wheel(diagramWidget, { deltaY: -1 });
    fireEvent.pointerDown(diagramWidget, { button: 0, clientX: 10, clientY: 20 });
    fireEvent.pointerMove(diagramWidget, { clientX: 40, clientY: 60 });
    fireEvent.pointerUp(diagramWidget);
    fireEvent.click(diagramWidget);

    expect(container.querySelector(".cm-live-diagram")).not.toBeNull();
    expect(container.querySelector(".cm-live-diagram-fit-button")).not.toBeNull();
    expect(container.querySelector(".cm-live-diagram-edit-button")).not.toBeNull();

    fireEvent.click(container.querySelector(".cm-live-diagram-fit-button") as HTMLButtonElement);
    expect(container.querySelector(".cm-live-diagram")).not.toBeNull();

    fireEvent.click(container.querySelector(".cm-live-diagram-edit-button") as HTMLButtonElement);

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).toBeNull());
    expect(viewRef.current?.state.selection.main.head).toBe(content.indexOf("graph TD"));

    viewRef.current?.dispatch({ selection: { anchor: content.length } });

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).not.toBeNull());
  });

  it("D2のソースを編集ボタンでD2コードブロックをソース表示に戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = [
      "# D2",
      "",
      "```d2",
      "x -> y",
      "```",
      "",
      "本文"
    ].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).not.toBeNull());

    fireEvent.click(container.querySelector(".cm-live-diagram-edit-button") as HTMLButtonElement);

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).toBeNull());
    expect(viewRef.current?.state.selection.main.head).toBe(content.indexOf("x -> y"));

    viewRef.current?.dispatch({ selection: { anchor: content.length } });

    await waitFor(() => expect(container.querySelector(".cm-live-diagram")).not.toBeNull());
  });

  it("ライブプレビューで通常コードブロックは図Widgetにしない", async () => {
    const content = [
      "```js",
      "const value = 1;",
      "```"
    ].join("\n");
    const contentWithTail = `${content}\n\n本文`;
    const widgets = await collectInlineLivePreviewWidgets(contentWithTail, contentWithTail.length, false);
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={contentWithTail}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    expect(widgets).not.toContain("DiagramBlockWidget");
    expect(widgets).toContain("CodeBlockWidget");
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
    expect(container.querySelector(".cm-live-code-block-source")?.textContent).toBe("const value = 1;");
    expect(container.textContent).not.toContain("```");
  });

  it("通常コードブロックのパネルから本文だけをコピーできる", async () => {
    const copyEditorTextToClipboard = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    window.relic = makeRelicApi({
      copyEditorTextToClipboard
    });
    const source = "const value = 1;\nconsole.log(value);";
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={["```ts", source, "```", "", "本文"].join("\n")}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
    expect(container.querySelector(".cm-live-code-block-label")?.textContent).toBe("ts");

    fireEvent.click(container.querySelector(".cm-live-code-block-copy") as HTMLButtonElement);

    expect(copyEditorTextToClipboard).toHaveBeenCalledWith({ text: source });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-copy")?.textContent).toBe("Copied"));
  });

  it("Electronクリップボードが失敗しても通常コードブロックをブラウザ経路でコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.relic = makeRelicApi({
      copyEditorTextToClipboard: vi.fn().mockRejectedValue(new Error("clipboard unavailable"))
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText
      }
    });
    const source = "あああ";
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={["```", source, "```", "", "本文"].join("\n")}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-copy")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-live-code-block-copy") as HTMLButtonElement);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(source));
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-copy")?.textContent).toBe("Copied"));
  });

  it("通常コードブロックは閉じ行まで1つのblock Widgetに置換する", async () => {
    const content = [
      "```yaml",
      "sample: 11",
      "category: entrance",
      "```",
      "",
      "本文"
    ].join("\n");
    const ranges = await collectLivePreviewReplacementRanges(content, content.length, false);
    const codeRanges = ranges.filter((range) => range.widget === "CodeBlockWidget");
    const blockTo = content.indexOf("\n\n本文");

    expect(codeRanges).toEqual([
      { block: true, from: 0, to: blockTo, widget: "CodeBlockWidget" }
    ]);
  });

  it("通常コードブロックは本文位置に選択が移ってもプレビュー表示を維持する", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = ["```", "あああ", "```", "", "本文"].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-source")).not.toBeNull());

    viewRef.current?.dispatch({ selection: { anchor: content.indexOf("あああ") + 1 } });

    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
    expect(container.querySelector(".cm-live-code-block-source")?.textContent).toBe("あああ");
    expect(container.textContent).not.toContain("```");
  });

  it("通常コードブロックは表示中のコード本文を触ってもプレビュー表示を維持する", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = ["```yaml", "sample: 11", "```", "", "本文"].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());

    fireEvent.mouseDown(container.querySelector(".cm-live-code-block-source") as HTMLElement);
    fireEvent.mouseUp(container.querySelector(".cm-live-code-block-source") as HTMLElement);
    fireEvent.click(container.querySelector(".cm-live-code-block-source") as HTMLElement);

    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
    expect(container.querySelector(".cm-live-code-block-source")?.textContent).toBe("sample: 11");
    expect(container.textContent).not.toContain("```yaml");
  });

  it("通常コードブロックはフェンス行に選択が移ったらソース表示に戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = ["```ts", "const value = 1;", "```", "", "本文"].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());

    viewRef.current?.dispatch({ selection: { anchor: content.indexOf("ts") } });

    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).toBeNull());
    expect(container.textContent).toContain("```ts");
  });

  it("通常コードブロックのヘッダーを触ったときソース表示に戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = ["```js", "const value = 1;", "```", "", "本文"].join("\n");
    const { container } = render(
      <Editor
        content={content}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());

    fireEvent.click(container.querySelector(".cm-live-code-block-header") as HTMLElement);

    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).toBeNull());
    expect(viewRef.current?.state.selection.main.head).toBe(0);
    expect(container.textContent).toContain("```js");
  });

  it("MermaidとD2の図ブロックには通常コードブロックのパネルを出さない", async () => {
    const content = [
      "```mermaid",
      "graph TD; A-->B",
      "```",
      "",
      "```d2",
      "x -> y",
      "```"
    ].join("\n");
    const widgets = await collectInlineLivePreviewWidgets(content, 0, false);
    const widgetClasses = await collectInlineLivePreviewWidgetClasses(content, 0, false);

    expect(widgets.filter((widget) => widget === "DiagramBlockWidget")).toHaveLength(2);
    expect(widgetClasses).not.toContain("cm-live-code-block-panel");
  });

  it("ライブプレビューでリスト・チェックボックス・水平線をウィジェット表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets([
      "- item",
      "1. item",
      "- [ ] task",
      "---"
    ].join("\n"), 0, false);

    expect(widgets).toEqual(expect.arrayContaining([
      "ListMarkerWidget",
      "CheckboxWidget",
      "HorizontalRuleWidget"
    ]));
  });

  it("ライブプレビューのチェックボックスクリックでMarkdownのチェック状態を切り替える", async () => {
    const onChange = vi.fn();
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"- [ ] task\n- [x] done"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    const firstCheckbox = container.querySelector(".cm-live-checkbox") as HTMLInputElement;
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(viewRef.current?.state.doc.toString()).toBe("- [x] task\n- [x] done");
    });
    expect(onChange).toHaveBeenLastCalledWith("- [x] task\n- [x] done");

    const checkedBoxes = Array.from(container.querySelectorAll(".cm-live-checkbox")) as HTMLInputElement[];
    fireEvent.click(checkedBoxes[1]);

    await waitFor(() => {
      expect(viewRef.current?.state.doc.toString()).toBe("- [x] task\n- [ ] done");
    });
    expect(onChange).toHaveBeenLastCalledWith("- [x] task\n- [ ] done");
  });
});
