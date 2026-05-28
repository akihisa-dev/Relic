import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function clickToolbarButton(name: string | RegExp): void {
  const button = screen.getByRole("button", { name });
  fireEvent.mouseDown(button);
  fireEvent.click(button);
}

async function renderToolbarWithEditor(content: string, selection: EditorSelection): Promise<{
  unmount: () => void;
  view: EditorView;
}> {
  const viewRef = createRef<EditorView | null>();
  const { unmount } = render(
    <>
      <Toolbar viewRef={viewRef} />
      <Editor
        content={content}
        onChange={() => undefined}
        settings={defaultEditorSettings}
        viewRef={viewRef}
      />
    </>
  );

  await waitFor(() => expect(viewRef.current).not.toBeNull());
  const view = viewRef.current!;
  view.dispatch({ selection });

  return { unmount, view };
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

    const boldButton = screen.getByRole("button", { name: "Bold" });
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

    const boldButton = screen.getByRole("button", { name: "Bold" });
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

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

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

    const boldButton = screen.getByRole("button", { name: "Bold" });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(staleView.state.doc.toString()).toBe("old");
    expect(selectedView.state.doc.toString()).toBe("**hello**");
    document.getSelection()?.removeAllRanges();
    selectedView.dom.remove();
    staleView.destroy();
    selectedView.destroy();
  });

  it("インライン装飾ボタンがすべてMarkdown記法を適用する", () => {
    const cases: Array<{ button: string | RegExp; expected: string }> = [
      { button: "Bold", expected: "**hello**" },
      { button: "Italic", expected: "*hello*" },
      { button: "Strikethrough", expected: "~~hello~~" },
      { button: "Highlight", expected: "==hello==" },
      { button: "Underline", expected: "<u>hello</u>" },
      { button: "Inline code", expected: "`hello`" }
    ];

    for (const { button, expected } of cases) {
      const view = createView("hello", EditorSelection.single(0, 5));
      render(<Toolbar viewRef={{ current: view }} />);

      clickToolbarButton(button);

      expect(view.state.doc.toString()).toBe(expected);
      view.destroy();
      document.body.innerHTML = "";
    }
  });

  it("見出しメニューがH1からH6まで適用できる", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const view = createView("hello", EditorSelection.single(0, 5));
      render(<Toolbar viewRef={{ current: view }} />);

      clickToolbarButton("Heading");
      fireEvent.click(screen.getByRole("button", { name: `H${level}` }));

      expect(view.state.doc.toString()).toBe(`${"#".repeat(level)} hello`);
      view.destroy();
      document.body.innerHTML = "";
    }
  });

  it("ブロック系ボタンがMarkdownブロックを挿入する", () => {
    const cases: Array<{ button: string | RegExp; expected: string }> = [
      { button: "Blockquote", expected: "> hello" },
      { button: "Code block", expected: "hello\n```\n\n```\n" },
      { button: "Horizontal rule", expected: "hello\n---\n" },
      { button: "Bulleted list", expected: "- hello" },
      { button: "Numbered list", expected: "1. hello" },
      { button: "Checkbox", expected: "- [ ] hello" }
    ];

    for (const { button, expected } of cases) {
      const view = createView("hello", EditorSelection.single(0, 5));
      render(<Toolbar viewRef={{ current: view }} />);

      clickToolbarButton(button);

      expect(view.state.doc.toString()).toBe(expected);
      view.destroy();
      document.body.innerHTML = "";
    }
  });

  it("リスト系ボタンが複数行選択へ一括適用し、空行を飛ばす", () => {
    const content = "one\n\ntwo\nthree";
    const cases: Array<{ button: string | RegExp; expected: string }> = [
      { button: "Bulleted list", expected: "- one\n\n- two\n- three" },
      { button: "Numbered list", expected: "1. one\n\n2. two\n3. three" },
      { button: "Checkbox", expected: "- [ ] one\n\n- [ ] two\n- [ ] three" }
    ];

    for (const { button, expected } of cases) {
      const view = createView(content, EditorSelection.single(0, content.length));
      render(<Toolbar viewRef={{ current: view }} />);

      clickToolbarButton(button);

      expect(view.state.doc.toString()).toBe(expected);
      view.destroy();
      document.body.innerHTML = "";
    }
  });

  it("リンクボタンがURL入力後にMarkdownリンクを挿入する", () => {
    const view = createView("hello", EditorSelection.single(0, 5));
    render(<Toolbar viewRef={{ current: view }} />);

    clickToolbarButton("Markdown link");
    fireEvent.change(screen.getByPlaceholderText("URL"), { target: { value: "https://example.com" } });
    clickToolbarButton("Insert");

    expect(view.state.doc.toString()).toBe("[hello](https://example.com)");
    view.destroy();
  });

  it("内部リンクボタンがカーソル位置へ内部リンク記法を挿入する", () => {
    const view = createView("hello", EditorSelection.single(2));
    render(<Toolbar viewRef={{ current: view }} />);

    clickToolbarButton("Internal link");

    expect(view.state.doc.toString()).toBe("he[[]]llo");
    expect(view.state.selection.main.from).toBe(4);
    view.destroy();
  });

  it("内部リンクボタンが選択範囲を内部リンク記法で包む", () => {
    const view = createView("あああ", EditorSelection.single(0, 3));
    render(<Toolbar viewRef={{ current: view }} />);

    clickToolbarButton("Internal link");

    expect(view.state.doc.toString()).toBe("[[あああ]]");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("あああ");
    view.destroy();
  });

  it("実エディタ上でも内部リンクボタンが選択範囲を包む", async () => {
    const { unmount, view } = await renderToolbarWithEditor("あああ", EditorSelection.single(0, 3));

    clickToolbarButton("Internal link");

    expect(view.state.doc.toString()).toBe("[[あああ]]");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("あああ");
    unmount();
  });

  it("実エディタ上ですべてのインラインツールバーボタンが選択範囲を包む", async () => {
    const cases: Array<{ button: string; expected: string }> = [
      { button: "Bold", expected: "**あああ**" },
      { button: "Italic", expected: "*あああ*" },
      { button: "Strikethrough", expected: "~~あああ~~" },
      { button: "Highlight", expected: "==あああ==" },
      { button: "Underline", expected: "<u>あああ</u>" },
      { button: "Inline code", expected: "`あああ`" }
    ];

    for (const { button, expected } of cases) {
      const { unmount, view } = await renderToolbarWithEditor("あああ", EditorSelection.single(0, 3));

      clickToolbarButton(button);

      expect(view.state.doc.toString()).toBe(expected);
      unmount();
    }
  });

  it("実エディタ上でMarkdownリンクが選択範囲を包む", async () => {
    const { unmount, view } = await renderToolbarWithEditor("あああ", EditorSelection.single(0, 3));

    clickToolbarButton("Markdown link");
    fireEvent.change(screen.getByPlaceholderText("URL"), { target: { value: "https://example.com" } });
    clickToolbarButton("Insert");

    expect(view.state.doc.toString()).toBe("[あああ](https://example.com)");
    unmount();
  });

  it("表ボタンが指定行列のMarkdown表を挿入する", () => {
    const view = createView("hello", EditorSelection.single(5));
    render(<Toolbar viewRef={{ current: view }} />);

    clickToolbarButton("Table");
    const dialog = screen.getByText("×").closest(".toolbar-inline-dialog");
    expect(dialog).not.toBeNull();
    const inputs = within(dialog as HTMLElement).getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "2" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });
    fireEvent.click(within(dialog as HTMLElement).getByRole("button", { name: "Insert" }));

    expect(view.state.doc.toString()).toBe([
      "hello",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      "| 　 | 　 |",
      "| 　 | 　 |",
      ""
    ].join("\n"));
    view.destroy();
  });

  it("見出しドロップダウンを閉じると退場反応を通る", () => {
    const view = createView("hello", EditorSelection.single(0, 5));
    render(<Toolbar viewRef={{ current: view }} />);

    clickToolbarButton("Heading");
    const menu = screen.getByRole("button", { name: "H1" }).closest(".toolbar-dropdown-menu");
    if (!(menu instanceof HTMLElement)) throw new Error("heading menu was not rendered");

    fireEvent.click(screen.getByRole("button", { name: "H1" }));

    expect(menu).toHaveClass("toolbar-panel--closing");
    view.destroy();
  });

  it("リンク入力ダイアログを閉じると退場反応を通る", async () => {
    const { unmount, view } = await renderToolbarWithEditor("あああ", EditorSelection.single(0, 3));

    clickToolbarButton("Markdown link");
    const dialog = screen.getByPlaceholderText("URL").closest(".toolbar-inline-dialog");
    if (!(dialog instanceof HTMLElement)) throw new Error("link dialog was not rendered");

    fireEvent.keyDown(screen.getByPlaceholderText("URL"), { key: "Escape" });

    expect(dialog).toHaveClass("toolbar-panel--closing");
    view.destroy();
    unmount();
  });
});
