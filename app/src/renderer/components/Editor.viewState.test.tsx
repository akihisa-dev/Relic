import { redo, undo } from "@codemirror/commands";
import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { BlockType } from "@codemirror/view";
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAppFontFamily } from "../appFont";
import { __typewriterMeasureKeyForTests } from "../editorThemeExtensions";
import {
  __resetLocalEditorContentEchoesForTests,
  markLocalEditorContentEcho
} from "../editorContentEcho";
import { renderEditorWithView, settings } from "./editorTestHelpers";
import { Editor } from "./Editor";
import {
  __markEditorCompositionEndedForTests,
  __markEditorCompositionStartedForTests
} from "../editorExtensions";

describe("Editor view state", () => {
  afterEach(() => {
    __resetLocalEditorContentEchoesForTests();
  });

  it("連続入力とMarkdown操作の更新元を区別する", async () => {
    const onChange = vi.fn();
    const onTypingChange = vi.fn();
    const { view } = await renderEditorWithView({ content: "本文", onChange, onTypingChange });

    view.dispatch({
      annotations: Transaction.userEvent.of("input.type"),
      changes: { from: view.state.doc.length, insert: "追記" }
    });
    expect(onTypingChange.mock.calls.at(-1)?.[0].toString()).toBe("本文追記");
    expect(onChange).not.toHaveBeenCalled();

    view.dispatch({
      changes: { from: view.state.doc.length, insert: "**操作**" }
    });
    expect(onChange).toHaveBeenLastCalledWith("本文追記**操作**");
  });

  it("ローカル入力を親状態から受け取ってもCodeMirror本文を再度文字列化しない", async () => {
    const contentEchoKey = "tab-local";
    const { rerender, view, viewRef } = await renderEditorWithView({ content: "本文", contentEchoKey });
    view.dispatch({
      annotations: Transaction.userEvent.of("input.type"),
      changes: { from: view.state.doc.length, insert: "追記" }
    });
    const document = view.state.doc;
    const toStringSpy = vi.spyOn(document, "toString");
    const content = document.toString();
    markLocalEditorContentEcho(contentEchoKey, content);

    rerender(
      <Editor
        content={content}
        contentEchoKey={contentEchoKey}
        onChange={() => undefined}
        settings={settings}
        viewRef={viewRef}
      />
    );
    await waitFor(() => expect(toStringSpy).toHaveBeenCalledTimes(1));
    expect(view.state.doc).toBe(document);
  });

  it("タイプライターモードの連続更新を同じ測定キーへ集約する", async () => {
    const { view } = await renderEditorWithView({ content: "一行目\n二行目", typewriterMode: true });
    const requestMeasure = vi.spyOn(view, "requestMeasure");

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.dispatch({
      annotations: Transaction.userEvent.of("input.type"),
      changes: { from: view.state.doc.length, insert: "追記" }
    });

    const typewriterMeasures = requestMeasure.mock.calls.filter(
      ([request]) => request?.key === __typewriterMeasureKeyForTests
    );
    expect(typewriterMeasures).toHaveLength(2);
    expect(typewriterMeasures.every(([request]) => request?.key === __typewriterMeasureKeyForTests)).toBe(true);
  });

  it("外部本文の反映で選択範囲とスクロールを保ち通常入力のUndo履歴から分離する", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({ content: "base text" });
    view.dispatch({
      annotations: Transaction.userEvent.of("input.type"),
      changes: { from: view.state.doc.length, insert: " local" },
      selection: { anchor: 4, head: 9 }
    });
    view.scrollDOM.scrollTop = 120;
    view.scrollDOM.scrollLeft = 9;

    rerender(
      <Editor content="external text" onChange={() => undefined} settings={settings} viewRef={viewRef} />
    );

    await waitFor(() => expect(view.state.doc.toString()).toBe("external text"));
    expect(view.state.selection.main.from).toBe(4);
    expect(view.state.selection.main.to).toBe(9);
    expect(view.scrollDOM.scrollTop).toBe(120);
    expect(view.scrollDOM.scrollLeft).toBe(9);
    expect(undo(view)).toBe(false);
  });

  it("外部更新で前方へ文章が追加されても複数の選択範囲を同じ本文位置へ追従させる", async () => {
    const content = "alpha beta gamma";
    const { rerender, view, viewRef } = await renderEditorWithView({ content });
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(content.indexOf("beta"), content.indexOf("beta") + 4),
        EditorSelection.cursor(content.indexOf("gamma"))
      ])
    });

    rerender(
      <Editor content={`prefix ${content}`} onChange={() => undefined} settings={settings} viewRef={viewRef} />
    );

    await waitFor(() => expect(view.state.doc.toString()).toBe(`prefix ${content}`));
    expect(view.state.selection.ranges).toHaveLength(2);
    expect(view.state.sliceDoc(view.state.selection.ranges[0].from, view.state.selection.ranges[0].to)).toBe("beta");
    expect(view.state.selection.ranges[1].head).toBe(`prefix ${content}`.indexOf("gamma"));
    expect(view.state.facet(EditorState.allowMultipleSelections)).toBe(true);
  });

  it("外部本文に意図的な番号飛びがあっても内容を自動整形しない", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({ content: "1. first\n2. second" });

    rerender(
      <Editor content={"1. first\n4. second"} onChange={() => undefined} settings={settings} viewRef={viewRef} />
    );

    await waitFor(() => expect(view.state.doc.toString()).toBe("1. first\n4. second"));
  });

  it("IME変換中の外部本文を変換終了まで反映しない", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({ content: "変換中" });
    __markEditorCompositionStartedForTests(view);

    rerender(
      <Editor content="外部本文" onChange={() => undefined} settings={settings} viewRef={viewRef} />
    );
    expect(view.state.doc.toString()).toBe("変換中");

    __markEditorCompositionEndedForTests(view);
    fireEvent.compositionEnd(view.contentDOM);
    await waitFor(() => expect(view.state.doc.toString()).toBe("外部本文"));
  });

  it("通常入力後もEditorView identityとカーソルとスクロール位置を維持する", async () => {
    const { view, viewRef } = await renderEditorWithView({
      content: "alpha\nbeta\ngamma"
    });

    view.scrollDOM.scrollTop = 120;
    view.scrollDOM.scrollLeft = 8;
    const insertAt = "alpha\nbe".length;

    view.dispatch({
      changes: { from: insertAt, insert: "X" },
      selection: { anchor: insertAt + 1 }
    });

    expect(viewRef.current).toBe(view);
    expect(view.state.doc.toString()).toBe("alpha\nbeXta\ngamma");
    expect(view.state.selection.main.head).toBe(insertAt + 1);
    expect(view.scrollDOM.scrollTop).toBe(120);
    expect(view.scrollDOM.scrollLeft).toBe(8);
  });

  it("エディタ拡張の更新後もEditorViewとカーソル位置と履歴を維持する", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({
      content: "1行目\n2行目\n3行目",
      frontmatterCandidates: { status: ["draft"] }
    });

    const cursorPosition = "1行目\n2行".length;
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "\n4行目" },
      selection: { anchor: cursorPosition }
    });

    rerender(
      <Editor
        content={"1行目\n2行目\n3行目\n4行目"}
        frontmatterCandidates={{ status: ["draft", "done"] }}
        onChange={() => undefined}
        settings={{ ...settings, showLineNumbers: true, spellCheck: false }}
        sourceMode
        typewriterMode
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    expect(viewRef.current!.state.selection.main.from).toBe(cursorPosition);
    expect(undo(viewRef.current!)).toBe(true);
    expect(viewRef.current!.state.doc.toString()).toBe("1行目\n2行目\n3行目");
    expect(redo(viewRef.current!)).toBe(true);
    expect(viewRef.current!.state.doc.toString()).toBe("1行目\n2行目\n3行目\n4行目");
  });

  it("設定変更後もスクロール位置とフォーカスを維持する", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({
      content: Array.from({ length: 120 }, (_, index) => `行${index + 1}`).join("\n")
    });

    view.focus();
    view.scrollDOM.scrollTop = 240;
    view.scrollDOM.scrollLeft = 12;

    rerender(
      <Editor
        content={view.state.doc.toString()}
        onChange={() => undefined}
        settings={{ ...settings, fontSize: settings.fontSize + 1, showLineNumbers: true }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    expect(view.scrollDOM.scrollTop).toBe(240);
    expect(view.scrollDOM.scrollLeft).toBe(12);
    expect(view.hasFocus).toBe(true);
  });

  it("表示言語の切替時もEditorViewを維持して対応言語のフォントへ切り替える", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({
      content: "日本語 English",
      settings: { ...settings, font: "mincho", language: "ja" }
    });

    expect(view.contentDOM).toHaveStyle({
      fontFamily: resolveAppFontFamily("mincho", "ja")
    });

    rerender(
      <Editor
        content={view.state.doc.toString()}
        onChange={() => undefined}
        settings={{ ...settings, font: "mincho", language: "en" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    expect(view.contentDOM).toHaveStyle({
      fontFamily: resolveAppFontFamily("mincho", "en")
    });
  });

  it("source/live preview切替後もEditorViewと選択範囲とスクロール位置を維持する", async () => {
    const content = [
      "# Title",
      "",
      "**bold** text",
      "",
      "tail"
    ].join("\n");
    const { rerender, view, viewRef } = await renderEditorWithView({ content });
    const selection = {
      anchor: content.indexOf("bold"),
      head: content.indexOf(" text")
    };

    view.scrollDOM.scrollTop = 88;
    view.scrollDOM.scrollLeft = 14;
    view.dispatch({ selection });

    rerender(
      <Editor
        content={content}
        onChange={() => undefined}
        settings={settings}
        sourceMode
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    expect(view.state.selection.main.from).toBe(selection.anchor);
    expect(view.state.selection.main.to).toBe(selection.head);
    expect(view.scrollDOM.scrollTop).toBeGreaterThanOrEqual(0);
    expect(view.scrollDOM.scrollLeft).toBe(14);

    rerender(
      <Editor
        content={content}
        onChange={() => undefined}
        settings={settings}
        sourceMode={false}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    expect(view.state.selection.main.from).toBe(selection.anchor);
    expect(view.state.selection.main.to).toBe(selection.head);
    expect(view.scrollDOM.scrollTop).toBeGreaterThanOrEqual(0);
    expect(view.scrollDOM.scrollLeft).toBe(14);
  });

  it("source/live preview切替時は同じ文書位置を基準にスクロールを復元する", async () => {
    const content = [
      "# Title",
      "",
      "| A | B |",
      "| --- | --- |",
      "| x | y |",
      "",
      "```yaml",
      "sample: 11",
      "category: entrance",
      "```",
      "",
      "tail"
    ].join("\n");
    const { rerender, view, viewRef } = await renderEditorWithView({
      content,
      settings: { ...settings, showLineNumbers: true }
    });

    const lineBlockAtHeight = vi.spyOn(view, "lineBlockAtHeight").mockReturnValue({
      bottom: 140,
      from: content.indexOf("```yaml"),
      height: 40,
      length: 7,
      top: 100,
      to: content.indexOf("```yaml") + "```yaml".length,
      type: BlockType.Text
    } as never);
    const lineBlockAt = vi.spyOn(view, "lineBlockAt").mockReturnValue({
      bottom: 260,
      from: content.indexOf("```yaml"),
      height: 40,
      length: 7,
      top: 220,
      to: content.indexOf("```yaml") + "```yaml".length,
      type: BlockType.Text
    } as never);

    view.scrollDOM.scrollTop = 118;
    view.scrollDOM.scrollLeft = 16;

    rerender(
      <Editor
        content={content}
        onChange={() => undefined}
        settings={{ ...settings, showLineNumbers: true }}
        sourceMode
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).toBe(view));
    await waitFor(() => expect(view.scrollDOM.scrollTop).toBe(238));
    expect(view.scrollDOM.scrollLeft).toBe(16);
    expect(lineBlockAtHeight).toHaveBeenCalledWith(118);
    expect(lineBlockAt).toHaveBeenCalledWith(content.indexOf("```yaml"));
  });

  it("ライブプレビュー装飾更新後もselectionを維持する", async () => {
    const content = "**bold**\n\nplain";
    const { view } = await renderEditorWithView({ content });
    const insertAt = content.indexOf("plain") + "plain".length;

    view.dispatch({
      changes: { from: insertAt, insert: "!" },
      selection: { anchor: insertAt + 1 }
    });

    expect(view.state.doc.toString()).toBe("**bold**\n\nplain!");
    expect(view.state.selection.main.head).toBe(insertAt + 1);
  });

  it("10,000行Markdownの通常入力でもEditorViewを再生成せずselectionとscrollを維持する", async () => {
    const content = Array.from({ length: 10_000 }, (_, index) => `行${index + 1}: **本文**`).join("\n");
    const { view, viewRef } = await renderEditorWithView({ content });

    view.scrollDOM.scrollTop = 320;
    view.scrollDOM.scrollLeft = 16;
    const insertAt = view.state.doc.length;

    view.dispatch({
      changes: { from: insertAt, insert: "\n追記" },
      selection: { anchor: insertAt + "\n追記".length }
    });

    expect(viewRef.current).toBe(view);
    expect(view.state.selection.main.head).toBe(insertAt + "\n追記".length);
    expect(view.scrollDOM.scrollTop).toBe(320);
    expect(view.scrollDOM.scrollLeft).toBe(16);
  });
});
