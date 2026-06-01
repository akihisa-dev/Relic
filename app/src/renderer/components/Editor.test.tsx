import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  renderEditorWithView,
  settings
} from "./editorTestHelpers";
import { Editor } from "./Editor";

describe("Editor", () => {
  it("エディタ拡張の更新後もカーソル位置を維持する", async () => {
    const { rerender, view, viewRef } = await renderEditorWithView({
      content: "1行目\n2行目\n3行目",
      frontmatterCandidates: { status: ["draft"] }
    });

    const cursorPosition = "1行目\n2行".length;
    view.dispatch({ selection: { anchor: cursorPosition } });

    rerender(
      <Editor
        content={"1行目\n2行目\n3行目"}
        frontmatterCandidates={{ status: ["draft", "done"] }}
        onChange={() => undefined}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBe(view));
    expect(viewRef.current!.state.selection.main.from).toBe(cursorPosition);
  });
});
