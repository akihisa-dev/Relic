import { redo, undo } from "@codemirror/commands";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { renderEditorWithView, settings } from "./editorTestHelpers";
import { Editor } from "./Editor";

describe("Editor markdown editing", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("テキスト入力変更を onChange に通知し、Undo / Redo が動作する", async () => {
    const onChange = vi.fn();
    const { view } = await renderEditorWithView({ content: "hello", onChange });

    view.dispatch({ changes: { from: 5, insert: " world" } });

    expect(onChange).toHaveBeenLastCalledWith("hello world");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello world");
  });

  it("本文の右クリックメニューからコピー・カット・ペーストを実行できる", async () => {
    const readClipboardText = vi.fn().mockReturnValue("!");
    const writeClipboardText = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.relic = makeRelicApi({
      readClipboardText,
      writeClipboardText
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: readClipboardText,
        writeText
      }
    });

    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.mouseDown(contentElement, { button: 2, clientX: 32, clientY: 32 });
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy" }));
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith("hello");
    });

    view.dispatch({ selection: { anchor: 5, head: 5 } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));
    await waitFor(() => {
      expect(document.body.textContent).toContain("hello! world");
    });
  });

  it("カット時にクリップボードへ保存できない場合は本文を消さない", async () => {
    const writeClipboardText = vi.fn(() => {
      throw new Error("clipboard unavailable");
    });
    const writeText = vi.fn().mockRejectedValue(new Error("browser clipboard unavailable"));
    const execCommand = vi.fn().mockReturnValue(false);
    window.relic = makeRelicApi({
      writeClipboardText
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText
      }
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    });

    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith("copy");
    });
    expect(view.state.doc.toString()).toBe("hello world");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("hello");
  });

  it("カット時にクリップボードへ保存できた場合だけ本文を消し、1回のUndoで戻せる", async () => {
    const writeClipboardText = vi.fn();
    window.relic = makeRelicApi({
      writeClipboardText
    });

    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cut" }));

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe(" world");
    });
    expect(writeClipboardText).toHaveBeenCalledWith("hello");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello world");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(" world");
  });

  it("本文への複数行日本語ペーストは1回のUndoで戻せる", async () => {
    const pastedText = "一行目\n- 箇条書き\n```ts\nconst 値 = 1;\n```";
    const readClipboardText = vi.fn().mockReturnValue(pastedText);
    window.relic = makeRelicApi({ readClipboardText });

    const { view } = await renderEditorWithView({
      content: "前\n後",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    const insertAt = "前\n".length;

    view.dispatch({ selection: { anchor: insertAt } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe(`前\n${pastedText}後`);
    });
    expect(view.state.selection.main.head).toBe(insertAt + pastedText.length);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("前\n後");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(`前\n${pastedText}後`);
  });

  it("HTMLを含む通常ペーストでもプレーンMarkdown本文として貼り付け、1回のUndoで戻せる", async () => {
    const pastedText = [
      "日本語の見出し",
      "",
      "| 項目 | 値 |",
      "| --- | --- |",
      "| 表 | 123 |",
      "",
      "```js",
      "console.log('貼り付け');",
      "```"
    ].join("\n");
    const pastedHtml = [
      "<h1>日本語の見出し</h1>",
      "<table><tr><th>項目</th><th>値</th></tr><tr><td>表</td><td>123</td></tr></table>",
      "<pre><code>console.log('貼り付け');</code></pre>"
    ].join("");

    const { view } = await renderEditorWithView({
      content: "前\n後",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    const insertAt = "前\n".length;
    const getData = vi.fn((type: string) => {
      if (type === "text/plain") return pastedText;
      if (type === "text/html") return pastedHtml;
      return "";
    });

    view.focus();
    view.dispatch({ selection: { anchor: insertAt } });
    fireEvent.paste(contentElement, {
      clipboardData: {
        getData,
        types: ["text/html", "text/plain"]
      }
    });

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe(`前\n${pastedText}後`);
    });
    expect(getData).toHaveBeenCalledWith("text/plain");
    expect(view.state.selection.main.head).toBe(insertAt + pastedText.length);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("前\n後");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(`前\n${pastedText}後`);
  });

  it("Electron側のクリップボード読み取りに失敗してもブラウザ側からペーストできる", async () => {
    const readClipboardText = vi.fn(() => {
      throw new Error("clipboard unavailable");
    });
    const readText = vi.fn().mockResolvedValue("fallback paste");
    window.relic = makeRelicApi({ readClipboardText });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText,
        writeText: vi.fn()
      }
    });

    const { view } = await renderEditorWithView({
      content: "前後",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 1 } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe("前fallback paste後");
    });
    expect(readText).toHaveBeenCalled();
  });

  it("外側からcontentが更新されたら表示中の文書も同期する", async () => {
    const { rerender, viewRef } = await renderEditorWithView({ content: "left" });

    expect(viewRef.current!.state.doc.toString()).toBe("left");

    rerender(
      <Editor
        content="right"
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current!.state.doc.toString()).toBe("right"));
  });
});
