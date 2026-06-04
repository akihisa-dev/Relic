import { undo } from "@codemirror/commands";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  renderEditorWithView,
  settings
} from "./editorTestHelpers";
import { Editor } from "./Editor";

describe("Editor", () => {
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
});
