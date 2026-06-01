import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contextSelectionHighlightField } from "../editorContextSelectionHighlight";
import { buildWikiLinkCompletionSource } from "../editorExtensions";
import { headingFoldRange } from "../editorHeadingFolding";
import { isListInputEvent } from "../editorListInput";
import { I18nProvider } from "../i18n";
import { Editor } from "./Editor";
import {
  collectInlineLivePreviewWidgetClasses,
  settings
} from "./editorTestHelpers";

describe("Editor", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("テキスト入力変更を onChange に通知し、Undo / Redo が動作する", async () => {
    const onChange = vi.fn();
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content="hello"
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    const view = viewRef.current!;
    view.dispatch({ changes: { from: 5, insert: " world" } });

    expect(onChange).toHaveBeenLastCalledWith("hello world");

    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello");

    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello world");
  });

  it("エディタ拡張の更新後もカーソル位置を維持する", async () => {
    const onChange = vi.fn();
    const viewRef = createRef<EditorView | null>();
    const { rerender } = render(
      <Editor
        content={"1行目\n2行目\n3行目"}
        frontmatterCandidates={{ status: ["draft"] }}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    const cursorPosition = "1行目\n2行".length;
    const firstView = viewRef.current!;
    firstView.dispatch({ selection: { anchor: cursorPosition } });

    rerender(
      <Editor
        content={"1行目\n2行目\n3行目"}
        frontmatterCandidates={{ status: ["draft", "done"] }}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBe(firstView));
    expect(viewRef.current!.state.selection.main.from).toBe(cursorPosition);
  });

  it("ライブ表示のリンク文字クリックでリンクを開く", async () => {
    const onOpenLink = vi.fn();
    const onOpenWikiLink = vi.fn();
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content={"トップ: [リンク確認用トップ](./00-リンク確認用トップ.md)\nWiki: [[01-企画メモ]]"}
        onChange={vi.fn()}
        onOpenLink={onOpenLink}
        onOpenWikiLink={onOpenWikiLink}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    fireEvent.click(await screen.findByText("リンク確認用トップ"));
    expect(onOpenLink).toHaveBeenCalledWith("./00-リンク確認用トップ.md");

    fireEvent.click(await screen.findByText("01-企画メモ"));
    expect(onOpenWikiLink).toHaveBeenCalledWith("01-企画メモ", undefined);
  });

  it("本文の右クリックメニューからコピー・カット・ペーストを実行できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const readClipboardText = vi.fn().mockReturnValue("!");
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.relic = {
      readClipboardText
    } as unknown as typeof window.relic;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: readClipboardText,
        writeText
      }
    });

    render(
      <Editor
        content="hello world"
        onChange={vi.fn()}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    await waitFor(() => expect(view.state.doc.toString()).toBe("hello world"));
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.mouseDown(contentElement, { button: 2, clientX: 32, clientY: 32 });
    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    expect(await screen.findByRole("menuitem", { name: "Cut" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Cut" })).toBeEnabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hello");
    });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    view.dispatch({ selection: { anchor: 5, head: 5 } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Cut" })).toBeEnabled();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));
    await waitFor(() => {
      expect(document.body.textContent).toContain("hello! world");
    });
  });

  it("Electronでも本文の右クリックでMarkdownメニューを表示する", async () => {
    const viewRef = createRef<EditorView | null>();
    window.relic = {
      readClipboardText: vi.fn(),
      writeClipboardText: vi.fn()
    } as unknown as typeof window.relic;

    render(
      <Editor
        content="hello world"
        onChange={vi.fn()}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const contentElement = viewRef.current!.dom.querySelector(".cm-content")!;

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });

    expect(await screen.findByRole("menuitem", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
  });

  it("本文の右クリックメニューから選択範囲にMarkdown操作を適用できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();

    render(
      <Editor
        content="hello world"
        onChange={onChange}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    expect(view.state.selection.main.empty).toBe(false);
    expect(viewRef.current!.state.field(contextSelectionHighlightField).size).toBe(1);
    const boldButton = await screen.findByRole("menuitem", { name: "Bold" });
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(viewRef.current!.state.field(contextSelectionHighlightField).size).toBe(0);
    expect(onChange).toHaveBeenLastCalledWith("**hello** world");
    expect(viewRef.current!.state.doc.toString()).toBe("**hello** world");
  });

  it("本文の右クリック中に選択が動いても最初の選択範囲へMarkdown操作を適用する", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();

    render(
      <Editor
        content="hello world"
        onChange={onChange}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 6, head: 11 } });

    fireEvent.mouseDown(contentElement, { button: 2, clientX: 32, clientY: 32 });
    expect(await screen.findByRole("menuitem", { name: "Bold" })).toBeInTheDocument();

    view.dispatch({ selection: { anchor: 0, head: 5 } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Bold" }));

    expect(onChange).toHaveBeenLastCalledWith("hello **world**");
    expect(viewRef.current!.state.doc.toString()).toBe("hello **world**");
  });

  it("本文の右クリックメニューから選択範囲をコードブロックで囲む", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();

    render(
      <Editor
        content={"one\ntwo\nthree"}
        onChange={onChange}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: "one\ntwo".length } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Code block" }));

    expect(onChange).toHaveBeenLastCalledWith("```\none\ntwo\n```\nthree");
    expect(viewRef.current!.state.doc.toString()).toBe("```\none\ntwo\n```\nthree");
  });

  it("本文の右クリックメニューからアイコンのSVGを押してもMarkdown操作を適用できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();

    render(
      <Editor
        content="hello world"
        onChange={onChange}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    const boldButton = await screen.findByRole("menuitem", { name: "Bold" });
    const boldPath = boldButton.querySelector("path")!;
    fireEvent.pointerDown(boldPath);
    fireEvent.mouseDown(boldPath);
    fireEvent.click(boldPath);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("**hello** world");
    expect(viewRef.current!.state.doc.toString()).toBe("**hello** world");
  });

  it("本文の右クリックメニューはよく使う操作から表示する", async () => {
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content="hello world"
        onChange={vi.fn()}
        settings={{ ...settings, language: "ja" }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const contentElement = viewRef.current!.dom.querySelector(".cm-content")!;

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    await screen.findByRole("menuitem", { name: "Copy" });

    const labels = screen.getAllByRole("menuitem").map((item) => item.getAttribute("aria-label") ?? item.textContent);
    expect(labels.slice(0, 10)).toEqual([
      "Copy",
      "Cut",
      "Paste",
      "Bold",
      "Highlight",
      "Internal link",
      "Markdown link",
      "Bulleted list",
      "Numbered list",
      "Checkbox"
    ]);
  });

  it("リスト行でEnterを押すと次の項目を作り、空項目ではリストを終了する", async () => {
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content={"- item\n1. first\n- [x] done\n- "}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 6 } });
    fireEvent.keyDown(contentElement, { key: "Enter" });
    expect(view.state.doc.toString()).toBe("- item\n- \n1. first\n- [x] done\n- ");

    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("first") + "first".length } });
    fireEvent.keyDown(contentElement, { key: "Enter" });
    expect(view.state.doc.toString()).toBe("- item\n- \n1. first\n2. \n- [x] done\n- ");

    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("done") + "done".length } });
    fireEvent.keyDown(contentElement, { key: "Enter" });
    expect(view.state.doc.toString()).toBe("- item\n- \n1. first\n2. \n- [x] done\n- [ ] \n- ");

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    fireEvent.keyDown(contentElement, { key: "Enter" });
    expect(view.state.doc.toString()).toBe("- item\n- \n1. first\n2. \n- [x] done\n- [ ] \n");
  });

  it("TabとShift+Tabで選択中の行を段下げ・段上げする", async () => {
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content={"- one\n- two\nplain"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 0, head: "- one\n- two".length } });
    fireEvent.keyDown(contentElement, { key: "Tab" });
    expect(view.state.doc.toString()).toBe("  - one\n  - two\nplain");

    view.dispatch({ selection: { anchor: 0, head: "  - one\n  - two".length } });
    fireEvent.keyDown(contentElement, { key: "Tab", shiftKey: true });
    expect(view.state.doc.toString()).toBe("- one\n- two\nplain");

    const plainStart = view.state.doc.toString().indexOf("plain");
    view.dispatch({ selection: { anchor: plainStart, head: view.state.doc.length } });
    fireEvent.keyDown(contentElement, { key: "Tab" });
    expect(view.state.doc.toString()).toBe("- one\n- two\n  plain");
  });

  it("Alt+上下で選択中の行を移動する", async () => {
    const viewRef = createRef<EditorView | null>();

    render(
      <Editor
        content={"one\ntwo\nthree\nfour"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    const view = viewRef.current!;
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: "one\n".length, head: "one\ntwo\nthree".length } });
    fireEvent.keyDown(contentElement, { key: "ArrowUp", altKey: true });
    expect(view.state.doc.toString()).toBe("two\nthree\none\nfour");

    fireEvent.keyDown(contentElement, { key: "ArrowDown", altKey: true });
    expect(view.state.doc.toString()).toBe("one\ntwo\nthree\nfour");
  });

  it("IME変換中のEnterではリスト入力補助を実行しない", () => {
    const composingEvent = new KeyboardEvent("keydown", { key: "Enter" });
    Object.defineProperty(composingEvent, "isComposing", { value: true });
    const imeProcessEvent = new KeyboardEvent("keydown", { key: "Enter" });
    Object.defineProperty(imeProcessEvent, "keyCode", { value: 229 });

    expect(isListInputEvent(composingEvent, { composing: false } as EditorView)).toBe(false);
    expect(isListInputEvent(imeProcessEvent, { composing: false } as EditorView)).toBe(false);
    expect(isListInputEvent(new KeyboardEvent("keydown", { key: "Enter" }), { composing: true } as EditorView)).toBe(false);
  });

  it("外側からcontentが更新されたら表示中の文書も同期する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { rerender } = render(
      <Editor
        content="left"
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
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

  it("本文は設定幅の内側で折り返す", async () => {
    const { container } = render(
      <Editor
        content={"長い本文".repeat(80)}
        onChange={vi.fn()}
        settings={{ ...settings, maxWidth: "660px" }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-lineWrapping")).not.toBeNull());

    expect(container.querySelector(".cm-content")).toHaveStyle({ maxWidth: "660px" });
    expect(container.querySelector(".cm-line")).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("カーソルのある現在行を薄く示す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"one\ntwo\nthree"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());

    const view = viewRef.current!;
    view.focus();
    view.dispatch({ selection: { anchor: "one\n".length } });

    await waitFor(() => expect(container.querySelector(".cm-activeLine")?.textContent).toBe("two"));

    view.dispatch({ selection: { anchor: "one\ntwo\n".length } });

    await waitFor(() => expect(container.querySelector(".cm-activeLine")?.textContent).toBe("three"));
  });

  it("行番号を表示するときも本文だけを設定幅で中央に置く", async () => {
    const { container } = render(
      <Editor
        content={"# 見出し\n\n本文"}
        onChange={vi.fn()}
        settings={{ ...settings, maxWidth: "660px", showLineNumbers: true }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-gutters")).not.toBeNull());

    expect(container.querySelector(".cm-scroller")).not.toHaveStyle({ justifyContent: "center" });
    expect(container.querySelector(".cm-gutters")).not.toHaveStyle({ left: "auto" });
    expect(container.querySelector(".cm-gutters")).toHaveStyle({ padding: "8px 0 24px" });
    expect(container.querySelector(".cm-content")).toHaveStyle({
      margin: "0 auto",
      maxWidth: "660px"
    });
  });

  it("見出し折りたたみ範囲を同じ階層以上の次の見出しまでにする", () => {
    const state = EditorState.create({
      doc: "# 章\n本文\n## 節\n節本文\n# 次の章",
      extensions: [markdown({ extensions: GFM })]
    });

    expect(headingFoldRange(state, state.doc.line(1).from)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(4).to
    });
    expect(headingFoldRange(state, state.doc.line(3).from)).toEqual({
      from: state.doc.line(3).to,
      to: state.doc.line(4).to
    });
  });

  it("コードブロック内の見出し記法は折りたたみ対象にしない", () => {
    const state = EditorState.create({
      doc: "```\n# コード内\n```\n# 本文\n本文",
      extensions: [markdown({ extensions: GFM })]
    });

    expect(headingFoldRange(state, state.doc.line(2).from)).toBeNull();
    expect(headingFoldRange(state, state.doc.line(4).from)).toEqual({
      from: state.doc.line(4).to,
      to: state.doc.line(5).to
    });
  });

  it("本文側の見出し行先頭ボタンで本文を折りたためる", async () => {
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"# 章\n本文\n## 節\n節本文\n# 次の章\n続き"}
          onChange={vi.fn()}
          settings={settings}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelectorAll(".cm-heading-fold-marker--open").length).toBeGreaterThanOrEqual(3));
    expect(container.querySelector(".cm-content .cm-heading-fold-marker--open")).not.toBeNull();
    expect(container.querySelector(".cm-gutters .cm-heading-fold-marker")).toBeNull();

    fireEvent.click(container.querySelector(".cm-heading-fold-marker--open") as HTMLElement);

    await waitFor(() => expect(container.querySelectorAll(".cm-heading-fold-marker--closed").length).toBeGreaterThanOrEqual(1));
    expect(container.querySelector(".cm-foldPlaceholder")?.textContent).toBe("…");
    expect(container.textContent).not.toContain("節本文");
    expect(container.textContent).toContain("次の章");
  });

  it("ソースモードでも開閉ボタンを見出し記号の左側に出す", async () => {
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"# 章\n本文"}
          onChange={vi.fn()}
          settings={settings}
          sourceMode
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector(".cm-heading-fold-marker--open")).not.toBeNull());
    expect(container.querySelector(".cm-line")?.textContent?.startsWith("▾# 章")).toBe(true);
    expect(container.querySelector(".cm-gutters .cm-heading-fold-marker")).toBeNull();
  });

  it("[[ 入力時のファイル名補完候補を作る", () => {
    const source = buildWikiLinkCompletionSource([
      "読書メモ.md",
      "folder/読書メモ.md",
      "資料.md"
    ]);
    const result = source({
      explicit: true,
      matchBefore: () => ({ from: 0, text: "[[読" })
    } as never);

    expect(result).toMatchObject({
      from: 2,
      options: expect.arrayContaining([
        { apply: "読書メモ]]", label: "読書メモ" },
        { apply: "folder/読書メモ]]", label: "folder/読書メモ" },
        { apply: "資料]]", label: "資料" }
      ])
    });
  });

  it("ライブプレビューの太字と斜体はDOM上でもレンダリング指定を持つ", async () => {
    const boldRender = render(
      <Editor
        content="**太字**"
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(boldRender.container.querySelector(".cm-live-bold")).not.toBeNull());
    const boldElement = boldRender.container.querySelector(".cm-live-bold") as HTMLElement;
    expect(boldElement.style.fontWeight).toBe("900");
    expect(boldElement.style.paddingInline).toBe("0.015em");
    expect(boldElement.style.textShadow).toBe("0.025em 0 0 currentColor");
    boldRender.unmount();

    const italicRender = render(
      <Editor
        content="*斜体*"
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(italicRender.container.querySelector(".cm-live-italic")).not.toBeNull());
    const italicElement = italicRender.container.querySelector(".cm-live-italic") as HTMLElement;
    expect(italicElement.style.fontStyle).toBe("italic");
    expect(italicElement.style.transform).toBe("skewX(-14deg)");
  });

  it("編集後もライブプレビュー装飾を更新する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content="plain"
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(viewRef.current).not.toBeNull());
    expect(container.querySelector(".cm-live-bold")).toBeNull();

    viewRef.current!.dispatch({
      changes: { from: 0, to: viewRef.current!.state.doc.length, insert: "**bold**" }
    });

    await waitFor(() => expect(container.querySelector(".cm-live-bold")).not.toBeNull());
  });

  it("ライブプレビューでフォーカスが外れたらカーソル行もレンダリングする", async () => {
    const classes = await collectInlineLivePreviewWidgetClasses("**bold**", 0, false);

    expect(classes).toContain("cm-live-bold");
  });
});
