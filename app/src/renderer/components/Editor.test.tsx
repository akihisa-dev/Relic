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
});
