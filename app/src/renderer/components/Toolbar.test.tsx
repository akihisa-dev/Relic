import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { Editor } from "./Editor";
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

    const boldButton = screen.getByRole("button", { name: "B" });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(view.state.doc.toString()).toBe("**hello**");
    view.destroy();
  });

  it("実エディタの選択範囲へMarkdown記法を適用する", async () => {
    const viewRef = createRef<EditorView | null>();

    render(
      <>
        <Toolbar viewRef={viewRef} />
        <Editor
          content="hello"
          onChange={() => undefined}
          settings={defaultEditorSettings}
          viewRef={viewRef}
        />
      </>
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    const view = viewRef.current!;
    view.dispatch({ selection: EditorSelection.single(0, 5) });

    const boldButton = screen.getByRole("button", { name: "B" });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(view.state.doc.toString()).toBe("**hello**");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("hello");
  });

  it("フォーカス中のエディタを優先してMarkdown記法を適用する", () => {
    const staleView = createView("old", EditorSelection.single(0, 3));
    const focusedView = createView("hello", EditorSelection.single(0, 5));

    Object.defineProperty(staleView, "hasFocus", { configurable: true, get: () => false });
    Object.defineProperty(focusedView, "hasFocus", { configurable: true, get: () => true });

    render(
      <Toolbar
        fallbackViewRef={{ current: focusedView }}
        viewRef={{ current: staleView }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "B" }));

    expect(staleView.state.doc.toString()).toBe("old");
    expect(focusedView.state.doc.toString()).toBe("**hello**");
    staleView.destroy();
    focusedView.destroy();
  });

  it("ブラウザ選択範囲を含むエディタを最優先してMarkdown記法を適用する", () => {
    const staleView = createView("old", EditorSelection.single(0, 3));
    const selectedView = createView("hello", EditorSelection.single(0, 5));
    const selectionHost = document.createElement("span");
    selectionHost.textContent = "hello";

    document.body.append(selectedView.dom);
    selectedView.dom.append(selectionHost);

    const range = document.createRange();
    range.selectNodeContents(selectionHost);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    Object.defineProperty(staleView, "hasFocus", { configurable: true, get: () => true });
    Object.defineProperty(selectedView, "hasFocus", { configurable: true, get: () => false });

    render(
      <Toolbar
        fallbackViewRef={{ current: selectedView }}
        viewRef={{ current: staleView }}
      />
    );

    const boldButton = screen.getByRole("button", { name: "B" });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(staleView.state.doc.toString()).toBe("old");
    expect(selectedView.state.doc.toString()).toBe("**hello**");
    document.getSelection()?.removeAllRanges();
    selectedView.dom.remove();
    staleView.destroy();
    selectedView.destroy();
  });
});
