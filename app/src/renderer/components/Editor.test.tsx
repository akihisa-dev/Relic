import { redo, undo } from "@codemirror/commands";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  renderEditorWithView,
  settings
} from "./editorTestHelpers";
import { Editor } from "./Editor";

describe("Editor", () => {
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
    expect(view.scrollDOM.scrollTop).toBe(88);
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
    expect(view.scrollDOM.scrollTop).toBe(88);
    expect(view.scrollDOM.scrollLeft).toBe(14);
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
