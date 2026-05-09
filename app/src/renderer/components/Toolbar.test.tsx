import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { insertBlockIds, Toolbar } from "./Toolbar";

function createView(doc: string, selection: EditorSelection): EditorView {
  return new EditorView({
    parent: document.createElement("div"),
    state: EditorState.create({ doc, selection })
  });
}

describe("Toolbar block IDs", () => {
  it("カーソル位置の段落末尾にブロックIDを挿入する", () => {
    const view = createView("a\nb\n\nc", EditorSelection.single(0));

    insertBlockIds(view, () => "abc123");

    expect(view.state.doc.toString()).toBe("a\nb ^abc123\n\nc");
    view.destroy();
  });

  it("選択範囲内の各段落末尾にブロックIDを挿入する", () => {
    const view = createView(
      "one\n\nsecond line\ncontinued\n\nthird",
      EditorSelection.single(0, "one\n\nsecond line\ncontinued".length)
    );
    const ids = ["aaa111", "bbb222"];

    insertBlockIds(view, () => ids.shift() ?? "fallback");

    expect(view.state.doc.toString()).toBe("one ^aaa111\n\nsecond line\ncontinued ^bbb222\n\nthird");
    view.destroy();
  });

  it("既存のブロックIDがある段落には重複挿入しない", () => {
    const view = createView("already ^abc123", EditorSelection.single(0));

    insertBlockIds(view, () => "new123");

    expect(view.state.doc.toString()).toBe("already ^abc123");
    view.destroy();
  });
});

describe("Toolbar markdown actions", () => {
  it("ボタン押下時に現在のエディタへMarkdown記法を適用する", () => {
    const view = createView("hello", EditorSelection.single(0, 5));
    const viewRef = { current: view };

    render(<Toolbar viewRef={viewRef} />);

    fireEvent.click(screen.getByRole("button", { name: "B" }));

    expect(view.state.doc.toString()).toBe("**hello**");
    view.destroy();
  });
});
