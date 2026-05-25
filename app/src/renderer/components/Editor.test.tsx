import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { contextSelectionHighlightField } from "../editorContextSelectionHighlight";
import {
  buildLivePreviewDecorations,
  buildTableDecorations,
  buildWikiLinkCompletionSource,
  Editor,
  findClickableLinkAtPosition
} from "./Editor";
import { createTranslator, I18nProvider } from "../i18n";

const settings = { ...defaultEditorSettings, language: "ja" as const };

async function collectLivePreviewClasses(content: string, cursor: number, hasFocus = true): Promise<Set<string>> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const classes = new Set<string>();
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const cls = (value as unknown as { spec?: { class?: string } }).spec?.class;
    if (cls) classes.add(cls);
  });

  return classes;
}

async function collectLivePreviewWidgets(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const widgets: string[] = [];
  void hasFocus;
  buildTableDecorations(state, createTranslator("ja")).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { constructor?: { name?: string } } } }).spec?.widget;
    if (widget?.constructor?.name) widgets.push(widget.constructor.name);
  });

  return widgets;
}

async function collectInlineLivePreviewWidgets(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const widgets: string[] = [];
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { constructor?: { name?: string } } } }).spec?.widget;
    if (widget?.constructor?.name) widgets.push(widget.constructor.name);
  });

  return widgets;
}

async function collectInlineLivePreviewWidgetClasses(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const classes: string[] = [];
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { className?: string } } }).spec?.widget;
    if (widget?.className) classes.push(widget.className);
  });

  return classes;
}

async function expandFrontmatter(container: HTMLElement): Promise<void> {
  await waitFor(() => expect(container.querySelector(".cm-frontmatter-header")).not.toBeNull());
  const properties = container.querySelector(".cm-frontmatter-properties");

  if (properties?.getAttribute("data-collapsed") === "true") {
    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);
  }

  await waitFor(() => {
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
  });
}

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

  it("ライブプレビューでカーソル外のMarkdown記法を装飾する", async () => {
    const content = "==mark==\n\nx";
    const classes = await collectInlineLivePreviewWidgetClasses(content, content.length);

    expect(classes).toContain("cm-live-highlight");
  });

  it("ライブプレビューでカーソル位置のMarkdown記法もレンダリングを維持する", async () => {
    const classes = await collectLivePreviewClasses("==mark==", 3);

    expect(classes.has("cm-live-highlight")).toBe(true);
    expect(classes.size).toBe(1);
  });

  it("ライブプレビューでカーソル位置の強調もレンダリングを維持する", async () => {
    const classes = await collectLivePreviewClasses("**bold**", 3);

    expect(classes.has("cm-live-bold")).toBe(true);
  });

  it("ライブプレビューで主要なインライン記法を安定して装飾する", async () => {
    const widgetClasses = await collectInlineLivePreviewWidgetClasses([
      "**bold**",
      "*italic*",
      "~~strike~~",
      "`code`",
      "==mark==",
      "<u>underline</u>",
      "[link](https://example.com)",
      "[[Page]]"
    ].join("\n"), 0, false);

    expect(widgetClasses).toEqual(expect.arrayContaining([
      "cm-live-bold",
      "cm-live-italic",
      "cm-live-strike",
      "cm-live-code",
      "cm-live-highlight",
      "cm-live-underline",
      "cm-live-link"
    ]));
  });

  it("ライブ表示で置換されたリンクの先頭位置クリックもリンクとして扱う", () => {
    const state = EditorState.create({
      doc: "トップ: [リンク確認用トップ](./00-リンク確認用トップ.md)\nWiki: [[01-企画メモ]]"
    });

    expect(findClickableLinkAtPosition(state.doc, 5)).toEqual({
      href: "./00-リンク確認用トップ.md",
      type: "markdown"
    });
    expect(findClickableLinkAtPosition(state.doc, 45)).toEqual({
      heading: undefined,
      target: "01-企画メモ",
      type: "wiki"
    });
  });

  it("ライブプレビューでブロック記法を安定して装飾する", async () => {
    const classes = await collectLivePreviewClasses([
      "> quote",
      "```",
      "code",
      "```"
    ].join("\n"), 0, false);

    expect(Array.from(classes)).toEqual(expect.arrayContaining([
      "cm-live-blockquote",
      "cm-live-code-block"
    ]));
  });

  it("ライブプレビューでリスト・チェックボックス・水平線をウィジェット表示する", async () => {
    const widgets = await collectInlineLivePreviewWidgets([
      "- item",
      "1. item",
      "- [ ] task",
      "---"
    ].join("\n"), 0, false);

    expect(widgets).toEqual(expect.arrayContaining([
      "ListMarkerWidget",
      "CheckboxWidget",
      "HorizontalRuleWidget"
    ]));
  });

  it("先頭フロントマターは水平線にせずメタデータとして薄く表示する", async () => {
    const content = "---\nstatus: draft\n---\n# 本文";
    const classes = await collectLivePreviewClasses(content, content.length, false);
    const widgets = await collectInlineLivePreviewWidgets(content, content.length, false);

    expect(classes.has("cm-live-frontmatter")).toBe(true);
    expect(widgets).not.toContain("HorizontalRuleWidget");
  });

  it("先頭フロントマターをプロパティフォームとしてDOM表示する", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nversion: v1.0\naliases: [帝都オルスター, 帝都]\n---\n# 本文"}
          onChange={onChange}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.textContent).toContain("プロパティ");
    expect((container.querySelector(".cm-frontmatter-properties") as HTMLElement).contentEditable).toBe("false");
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);

    await expandFrontmatter(container);

    expect(container.textContent).toContain("version");
    expect(Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")).map((input) => (input as HTMLInputElement).value)).toEqual([
      "帝都オルスター",
      "帝都"
    ]);

    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "v1.1" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("version: v1.1"));
    expect(viewRef.current?.state.doc.toString()).toContain("---\nversion: v1.1");
  });

  it("ソースモードではフロントマターをフォーム化せずMarkdown構文のまま表示する", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        sourceMode
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    expect(container.querySelector(".cm-frontmatter-properties")).toBeNull();
    expect(container.textContent).toContain("version: v1.0");
  });

  it("ソースモード切替時に既存のフォーム化DOMを残さない", async () => {
    const { container, rerender } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());

    rerender(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        sourceMode
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).toBeNull());
    expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(container.textContent).toContain("version: v1.0");
  });

  it("折りたたみ中のフロントマターは行番号の空白も畳み、展開時は通常の行番号ガターに表示する", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nupdated: 2026-03-24\naliases:\n  - test\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    const collapsedLineNumbers = Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent);

    expect(collapsedLineNumbers).toEqual(expect.arrayContaining(["1", "7"]));
    expect(collapsedLineNumbers).not.toEqual(expect.arrayContaining(["2", "3", "4", "5", "6"]));

    await expandFrontmatter(container);

    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).toEqual(expect.arrayContaining([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6"
    ]));
    expect(container.querySelector(".cm-frontmatter-line-number")).toBeNull();
  });

  it("プロパティフォームは折りたためる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nstatus: draft\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);

    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);

    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
    });
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(viewRef.current?.state.doc.toString()).toBe("---\nversion: v1.0\nstatus: draft\n---\n# 本文");

    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);

    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    });
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);
  });

  it("常設プラスボタンから既存フロントマターに固定プロパティを追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nplannedDate:\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const items = Array.from(container.querySelectorAll(".editor-frontmatter-add-menu-item"));
    expect(items.some((item) => item.textContent?.includes("plannedDate"))).toBe(false);
    const actualDateItem = items.find((item) => item.textContent?.includes("actualDate")) as HTMLButtonElement;
    fireEvent.click(actualDateItem);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("actualDate:"));
    expect(viewRef.current?.state.doc.toString()).toContain("---\nversion: v1.0\nplannedDate:\nactualDate:\n---");
  });

  it("常設プラスボタンからフロントマターを新規作成できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"# 本文"}
        onChange={onChange}
        settings={settings}
        userDefinedFields={[{ name: "status", type: "select" }]}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();
    expect(container.querySelector(".cm-frontmatter-add-input")).toBeNull();

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const plannedDateItem = Array.from(container.querySelectorAll(".editor-frontmatter-add-menu-item"))
      .find((item) => item.textContent?.includes("plannedDate")) as HTMLButtonElement;
    fireEvent.click(plannedDateItem);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("plannedDate:"));
    expect(viewRef.current?.state.doc.toString()).toBe("---\nplannedDate:\n---\n# 本文");
  });

  it("未完了のフロントマター記法にはプロパティを追加しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);

    expect(container.querySelector(".editor-frontmatter-add-menu-empty")).not.toBeNull();
    expect(container.querySelector(".editor-frontmatter-add-menu-item")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(viewRef.current?.state.doc.toString()).toBe("---\nstatus: draft\n# 本文");
  });

  it("プロパティフォームからプロパティを削除できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nstatus: draft\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-remove")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);

    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("version:"));
    expect(viewRef.current?.state.doc.toString()).toContain("status: draft");
  });

  it("複数行プロパティを削除しても隣のプロパティは残す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntags:\n  - 資料\n  - 下書き\nplannedDate: [2026-05-25]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-remove")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).not.toContain("tags:");
    expect(viewRef.current?.state.doc.toString()).not.toContain("- 資料");
    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-25]");
  });

  it("配列プロパティの値を個別に編集・削除できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntags: [draft, review]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-pill-value")).not.toBeNull());
    const values = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(values[0], { target: { value: "idea" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\", \"review\"]");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-remove")).toHaveLength(2));
    fireEvent.click(container.querySelectorAll(".cm-frontmatter-pill-remove")[1] as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("review");
  });

  it("配列プロパティのプラスボタンから値を追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntags: [draft]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    fireEvent.click(container.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    const input = container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(viewRef.current?.state.doc.toString()).toBe("---\ntags: [draft]\n---\n# 本文");

    fireEvent.click(container.querySelector(".frontmatter-add-dialog-actions button:last-child") as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"draft\", \"review\"]");
  });

  it("aliasesとtagsは元が複数行でも1行配列として書き戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\naliases:\n  - 帝都\n  - 旧都\ntags:\n  - 資料\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-pill-value")).not.toBeNull());
    const values = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(values[0], { target: { value: "王都" } });

    expect(viewRef.current?.state.doc.toString()).toContain("aliases: [\"王都\", \"旧都\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("aliases:\n  -");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-value")).toHaveLength(3));
    const nextValues = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(nextValues[2], { target: { value: "下書き" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"下書き\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("tags:\n  -");
  });

  it("aliases入力では他ファイル由来の候補を表示しない", async () => {
    const { container } = render(
      <Editor
        content={"---\naliases: [自分の別名]\ntags: [資料]\n---\n# 本文"}
        frontmatterCandidates={{
          aliases: ["他ファイルの別名"],
          tags: ["下書き"]
        }}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await expandFrontmatter(container);

    const rows = Array.from(container.querySelectorAll(".cm-frontmatter-row"));
    const aliasRow = rows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "aliases") as HTMLElement;
    const tagRow = rows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "tags") as HTMLElement;
    fireEvent.click(aliasRow.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    expect((container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement).getAttribute("list")).toBeNull();
    fireEvent.click(container.querySelector(".frontmatter-add-dialog-actions button:first-child") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".frontmatter-add-dialog-input")).toBeNull());

    const nextRows = Array.from(container.querySelectorAll(".cm-frontmatter-row"));
    const nextTagRow = nextRows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "tags") as HTMLElement;
    fireEvent.click(nextTagRow.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".frontmatter-add-dialog-input")).not.toBeNull());
    expect((container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement).getAttribute("list")).not.toBeNull();
  });

  it("chronicle0プロパティは1行配列として編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle0:\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    expect(inputs[0].placeholder).toBe("開始");
    expect(inputs[1].placeholder).toBe("終了");
    fireEvent.change(inputs[0], { target: { value: "1185" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle0: [1185]");

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const nextInputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(nextInputs[1], { target: { value: "1333" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle0: [1185, 1333]");
  });

  it("plannedDateプロパティは年月日の単日・期間を1行配列として編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nplannedDate:\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await expandFrontmatter(container);
    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-date-range")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-date-range .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "2026-05-12" } });

    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-12]");

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-date-range")).not.toBeNull());
    const nextInputs = Array.from(container.querySelectorAll(".cm-frontmatter-date-range .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(nextInputs[1], { target: { value: "2026-05-20" } });

    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-12, 2026-05-20]");
  });

  it("plannedDateプロパティは設定した日付順で入力でき、保存はYYYY-MM-DDに揃える", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nplannedDate: [2026-05-12]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, frontmatterDateFormat: "dmy" }}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-date-range")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-date-range .cm-frontmatter-input")) as HTMLInputElement[];
    expect(inputs[0].type).toBe("text");
    expect(inputs[0].value).toBe("12/05/2026");
    fireEvent.change(inputs[1], { target: { value: "20/05/2026" } });

    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-12, 2026-05-20]");
  });

  it("プロパティ編集時にYAMLのコメント行とフィールド順をできるだけ保つ", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\n# 管理用メモ\nphase: draft # 執筆状態\n\n# 公開日\npublished: false\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        userDefinedFields={[{ name: "published", type: "boolean" }]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });

    expect(viewRef.current?.state.doc.toString()).toContain([
      "---",
      "# 管理用メモ",
      "phase: review # 執筆状態",
      "",
      "# 公開日",
      "published: false",
      "---"
    ].join("\n"));
  });

  it("プロパティ編集時に単純な文字列スカラーのクォートを保つ", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntitle: \"Old title\" # 表示名\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New title" } });

    expect(viewRef.current?.state.doc.toString()).toContain("title: \"New title\" # 表示名");
  });

  it("複雑なYAML値をフォーム上のYAML入力で編集できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nphase: draft\nmeta:\n  source: web\n  rating: 5\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull());
    expect(container.textContent).toContain("meta");
    expect(container.querySelectorAll(".cm-frontmatter-row:not(.cm-frontmatter-add-row) .cm-frontmatter-input")).toHaveLength(1);

    const yamlInput = container.querySelector(".cm-frontmatter-yaml-input") as HTMLTextAreaElement;
    fireEvent.change(yamlInput, { target: { value: "source: web\nrating: 6" } });

    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web\n  rating: 6");

    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });

    expect(viewRef.current?.state.doc.toString()).toContain("phase: review");
    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web\n  rating: 6");
  });

  it("複雑なYAML値の入力が不正な場合は本文を更新しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nmeta:\n  source: web\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull());
    const yamlInput = container.querySelector(".cm-frontmatter-yaml-input") as HTMLTextAreaElement;
    fireEvent.change(yamlInput, { target: { value: "source: [web" } });

    expect(yamlInput.getAttribute("aria-invalid")).toBe("true");
    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web");
  });

  it("登録済みプロパティの入力タイプをフォームに反映する", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\ncategory: draft\nupdated: 2026-03-29\npublished: false\n---\n# 本文"}
        frontmatterCandidates={{ category: ["review"] }}
        onChange={onChange}
        settings={settings}
        userDefinedFields={[
          { choices: ["draft", "published"], name: "category", type: "select" },
          { name: "updated", type: "date" },
          { name: "published", type: "boolean" }
        ]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    const categorySelect = Array.from(container.querySelectorAll("select.cm-frontmatter-input"))
      .find((select) => (select as HTMLSelectElement).value === "draft") as HTMLSelectElement;
    const statusOptions = Array.from(categorySelect.querySelectorAll("option"))
      .map((option) => (option as HTMLOptionElement).value);
    expect(statusOptions).toEqual(["draft", "published", "review"]);
    fireEvent.change(categorySelect, { target: { value: "review" } });
    expect(viewRef.current?.state.doc.toString()).toContain("category: [\"review\"]");

    const dateInput = Array.from(container.querySelectorAll(".cm-frontmatter-input"))
      .find((input) => (input as HTMLInputElement).value === "2026-03-29") as HTMLInputElement;
    expect(dateInput.type).toBe("text");
    expect(dateInput.value).toBe("2026-03-29");
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });
    expect(viewRef.current?.state.doc.toString()).toContain("updated: [\"2026-04-01\"]");

    const checkbox = container.querySelector(".cm-frontmatter-checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(viewRef.current?.state.doc.toString()).toContain("published: [true]");
  });

  it("statusプロパティは固定候補を単一選択の入力補助に使う", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstatus: [未着手]\n---\n# 本文"}
        frontmatterCandidates={{ status: ["draft"] }}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    expect(container.querySelector(".cm-frontmatter-pill-add")).toBeNull();

    const input = container.querySelector("select.cm-frontmatter-input") as HTMLSelectElement;
    expect(input.value).toBe("未着手");
    const candidates = Array.from(input.querySelectorAll("option"))
      .map((option) => (option as HTMLOptionElement).value);
    expect(candidates).toEqual(["未着手", "進行中", "完了", "中断", "中止"]);

    fireEvent.change(input, { target: { value: "完了" } });
    expect(viewRef.current?.state.doc.toString()).toContain("status: [\"完了\"]");
  });

  it("日時・時刻・URL入力タイプと固定tagsをフォームに反映する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstarted: 2026-05-11T20:30\nhour: \"20:30\"\nsource: https://example.com\ntags: [資料]\nraw:\n  nested: true\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        userDefinedFields={[
          { name: "started", type: "datetime" },
          { name: "hour", type: "time" },
          { name: "source", type: "url" }
        ]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);

    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-input")) as HTMLInputElement[];
    expect(inputs.some((input) => input.type === "datetime-local")).toBe(true);
    expect(inputs.some((input) => input.type === "time")).toBe(true);
    expect(inputs.some((input) => input.type === "url")).toBe(true);
    expect(container.querySelector(".cm-frontmatter-pill-add")).not.toBeNull();
    expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull();
  });

  it("ライブプレビューで表を挿入直後のカーソル位置でも表示する", async () => {
    const content = "| A | B |\n| --- | --- |\n| x | y |";
    const widgets = await collectLivePreviewWidgets(content, content.length);

    expect(widgets).toContain("TableWidget");
  });

  it("ライブプレビューで表の内部にカーソルがあっても表示を解除しない", async () => {
    const content = "| A | B |\n| --- | --- |\n| x | y |";
    const widgets = await collectLivePreviewWidgets(content, 2);

    expect(widgets).toContain("TableWidget");
  });

  it("ライブプレビューで表をDOMに表示する", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-live-table-cell-input")) as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(expect.arrayContaining(["A", "B", "x", "y"]));
  });

  it("ライブプレビューの表セルを編集するとMarkdown本文を更新する", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector(".cm-live-table-cell-input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Name" } });

    expect(viewRef.current?.state.doc.toString()).toBe("| Name | B |\n| --- | --- |\n| x | y |");
  });

  it("ライブプレビューの表でEnterを押すと下のセルへ移動する", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;

    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]'));
    });
    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| x | y |\n| z | w |");
  });

  it("ライブプレビューの表で最終行からEnterを押すと行を追加して下のセルへ移動する", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;

    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]'));
    });
    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| x | y |\n|  |  |");
  });

  it("ライブプレビューの表で側面の追加ボタンから選択行列の後ろに追加できる", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-add--column-after')).not.toBeNull());
    fireEvent.click(container.querySelector('.cm-live-table-add--column-after') as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toBe("| A |  | B |\n| --- | --- | --- |\n| x |  | y |");

    await waitFor(() => expect(container.querySelector('.cm-live-table-add--row-after')).not.toBeNull());
    fireEvent.click(container.querySelector('.cm-live-table-add--row-after') as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toBe("| A |  | B |\n| --- | --- | --- |\n| x |  | y |\n|  |  |  |");
  });

  it("ライブプレビューの表で追加ボタンはヘッダーと端セルに触れた時だけ出す", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="0"][data-col="0"]')).not.toBeNull());
    const table = container.querySelector(".cm-live-table") as HTMLElement;

    fireEvent.mouseEnter(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement);
    expect(table.dataset.canAddColumnBefore).toBe("true");
    expect(table.dataset.canAddColumnAfter).toBeUndefined();
    expect(table.dataset.canAddRowBefore).toBe("true");
    expect(table.dataset.canAddRowAfter).toBeUndefined();
    expect(table.dataset.canGrabRow).toBe("true");
    expect(table.dataset.canGrabColumn).toBeUndefined();

    fireEvent.mouseEnter(container.querySelector('.cm-live-table-cell-input[data-row="0"][data-col="0"]') as HTMLInputElement);
    expect(table.dataset.canAddColumnAfter).toBe("true");
    expect(table.dataset.canAddRowBefore).toBe("true");
    expect(table.dataset.canAddRowAfter).toBeUndefined();
    expect(table.dataset.canGrabColumn).toBe("true");
    expect(table.dataset.canGrabRow).toBe("true");

    fireEvent.mouseEnter(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]') as HTMLInputElement);
    expect(table.dataset.canAddColumnAfter).toBeUndefined();
    expect(table.dataset.canAddColumnBefore).toBe("true");
    expect(table.dataset.canAddRowAfter).toBe("true");
    expect(table.dataset.canAddRowBefore).toBeUndefined();
    expect(table.dataset.canGrabColumn).toBeUndefined();
    expect(table.dataset.canGrabRow).toBeUndefined();
  });

  it("ライブプレビューの表で削除ボタンを出さず、行列選択ハンドルを出す", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-handle--column")).not.toBeNull());

    expect(container.querySelector('button[title="列を削除"]')).toBeNull();
    expect(container.querySelector('button[title="行を削除"]')).toBeNull();
    expect(container.querySelector(".cm-live-table-handle--column")).not.toBeNull();
    expect(container.querySelector(".cm-live-table-handle--row")).not.toBeNull();
  });

  it("ライブプレビューの表で右クリックメニューから行列を操作できる", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container, getByText } = render(
      <I18nProvider language="ja">
        <Editor
          content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]')).not.toBeNull());
    fireEvent.contextMenu(container.querySelector('td[data-row="1"][data-column="1"]') as HTMLTableCellElement);
    fireEvent.click(getByText("列を左へ移動"));

    expect(viewRef.current?.state.doc.toString()).toBe("| B | A |\n| --- | --- |\n| y | x |\n| w | z |");

    await waitFor(() => expect(container.querySelector('td[data-row="1"][data-column="0"]')).not.toBeNull());
    fireEvent.contextMenu(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement);
    fireEvent.click(getByText("行を下へ移動"));

    expect(viewRef.current?.state.doc.toString()).toBe("| B | A |\n| --- | --- |\n| w | z |\n| y | x |");
  });

  it("ライブプレビューの表で右クリックメニューから列をソートできる", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container, getByText } = render(
      <I18nProvider language="ja">
        <Editor
          content={"| A | B |\n| --- | --- |\n| 2 | b |\n| 10 | a |"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector('td[data-row="1"][data-column="0"]')).not.toBeNull());
    fireEvent.contextMenu(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement);
    fireEvent.click(getByText("列を降順に並べ替え"));

    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| 10 | a |\n| 2 | b |");
  });

  it("ライブプレビューの表からフォーカスが外れたら選択表示を解除する", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]')).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;
    input.focus();

    await waitFor(() => expect(container.querySelector(".cm-live-table-active")).not.toBeNull());
    fireEvent.blur(input, { relatedTarget: document.body });
    fireEvent.focusOut(input, { relatedTarget: document.body });

    await waitFor(() => expect(container.querySelector(".cm-live-table-active")).toBeNull());
  });

  it("ライブプレビューの表で行列ハンドルをドラッグして移動できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"| A | B | C |\n| --- | --- | --- |\n| x | y | z |\n| 1 | 2 | 3 |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-handle--column")).not.toBeNull());
    (container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="2"]') as HTMLInputElement).focus();
    fireEvent.mouseDown(container.querySelector(".cm-live-table-handle--column") as HTMLButtonElement, { clientX: 250, clientY: 40 });
    fireEvent.mouseUp(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement, { clientX: 110, clientY: 70 });

    expect(viewRef.current?.state.doc.toString()).toBe("| C | A | B |\n| --- | --- | --- |\n| z | x | y |\n| 3 | 1 | 2 |");

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]')).not.toBeNull());
    (container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]') as HTMLInputElement).focus();
    fireEvent.mouseDown(container.querySelector(".cm-live-table-handle--row") as HTMLButtonElement, { clientX: 90, clientY: 110 });
    fireEvent.mouseUp(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement, { clientX: 110, clientY: 70 });

    expect(viewRef.current?.state.doc.toString()).toBe("| C | A | B |\n| --- | --- | --- |\n| 3 | 1 | 2 |\n| z | x | y |");
  });

  it("ライブプレビューの表ドラッグ開始は pointer と mouse の二重発火でも一度だけ処理する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"| A | B | C |\n| --- | --- | --- |\n| x | y | z |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-handle--column")).not.toBeNull());
    (container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="2"]') as HTMLInputElement).focus();
    const handle = container.querySelector(".cm-live-table-handle--column") as HTMLButtonElement;
    fireEvent.pointerDown(handle, { clientX: 250, clientY: 40 });
    fireEvent.mouseDown(handle, { clientX: 250, clientY: 40 });
    fireEvent.pointerUp(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement, {
      clientX: 110,
      clientY: 70
    });

    expect(viewRef.current?.state.doc.toString()).toBe("| C | A | B |\n| --- | --- | --- |\n| z | x | y |");
  });

  it("ライブプレビューの表で行ハンドルを左側の帯のままドラッグして移動できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => null)
    });

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    const table = container.querySelector("table") as HTMLTableElement;
    vi.spyOn(table, "getBoundingClientRect").mockReturnValue({
      bottom: 130,
      height: 90,
      left: 100,
      right: 300,
      top: 40,
      width: 200,
      x: 100,
      y: 40,
      toJSON: () => ({})
    } as DOMRect);

    (container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]') as HTMLInputElement).focus();
    fireEvent.mouseDown(container.querySelector(".cm-live-table-handle--row") as HTMLButtonElement, {
      clientX: 80,
      clientY: 105
    });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 65 });
    fireEvent.mouseUp(document, { clientX: 80, clientY: 65 });

    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| z | w |\n| x | y |");
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint
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
