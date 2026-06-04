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
      "[[Page]]"
    ].join("\n"), 0, false);

    expect(widgetClasses).toEqual(expect.arrayContaining([
      "cm-live-bold",
      "cm-live-italic",
      "cm-live-strike",
      "cm-live-code",
      "cm-live-highlight",
      "cm-live-underline",
      "cm-live-math-inline",
      "cm-live-footnote-ref",
      "cm-live-link"
    ]));
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
    const widgets = await collectInlineLivePreviewWidgets(content, 0, false);
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={`${content}\n\n本文`}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    expect(widgets).not.toContain("DiagramBlockWidget");
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());
  });

  it("通常コードブロックのヘッダーから本文だけをコピーできる", async () => {
    const writeClipboardText = vi.fn();
    window.relic = makeRelicApi({
      writeClipboardText
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
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-header")).not.toBeNull());
    expect(container.querySelector(".cm-live-code-block-label")?.textContent).toBe("ts");

    fireEvent.click(container.querySelector(".cm-live-code-block-copy") as HTMLButtonElement);

    expect(writeClipboardText).toHaveBeenCalledWith(source);
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-copy")?.textContent).toBe("Copied"));
  });

  it("Electronクリップボードが失敗しても通常コードブロックをブラウザ経路でコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.relic = makeRelicApi({
      writeClipboardText: vi.fn(() => {
        throw new Error("clipboard unavailable");
      })
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

  it("通常コードブロックのヘッダーや余白をクリックしてもソース表示に戻さない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={["```", "あああ", "```", "", "本文"].join("\n")}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    viewRef.current?.dispatch({ selection: { anchor: viewRef.current.state.doc.length } });
    await waitFor(() => expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull());

    fireEvent.mouseDown(container.querySelector(".cm-live-code-block-header") as HTMLElement);
    fireEvent.click(container.querySelector(".cm-live-code-block-header") as HTMLElement);
    fireEvent.mouseDown(container.querySelector(".cm-live-code-block-body") as HTMLElement);
    fireEvent.click(container.querySelector(".cm-live-code-block-body") as HTMLElement);
    fireEvent.mouseDown(container.querySelector(".cm-live-code-block-footer") as HTMLElement);
    fireEvent.click(container.querySelector(".cm-live-code-block-footer") as HTMLElement);

    expect(container.querySelector(".cm-live-code-block-panel")).not.toBeNull();
    expect(container.textContent).not.toContain("```");
  });

  it("MermaidとD2の図ブロックには通常コードブロックのヘッダーを出さない", async () => {
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
