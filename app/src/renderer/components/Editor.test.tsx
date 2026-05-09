import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { buildLivePreviewDecorations, buildTableDecorations, buildWikiLinkCompletionSource, Editor } from "./Editor";

const settings = defaultEditorSettings;

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
  buildTableDecorations(state).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { constructor?: { name?: string } } } }).spec?.widget;
    if (widget?.constructor?.name) widgets.push(widget.constructor.name);
  });

  return widgets;
}

describe("Editor", () => {
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
    const classes = await collectLivePreviewClasses(content, content.length);

    expect(classes.has("cm-live-highlight")).toBe(true);
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
    const classes = await collectLivePreviewClasses([
      "**bold**",
      "*italic*",
      "~~strike~~",
      "`code`",
      "==mark==",
      "[link](https://example.com)",
      "[[Page]]"
    ].join("\n"), 0, false);

    expect(Array.from(classes)).toEqual(expect.arrayContaining([
      "cm-live-bold",
      "cm-live-italic",
      "cm-live-strike",
      "cm-live-code",
      "cm-live-highlight",
      "cm-live-link"
    ]));
  });

  it("ライブプレビューで表を挿入直後のカーソル位置でも表示する", async () => {
    const content = "| A | B |\n| --- | --- |\n| x | y |";
    const widgets = await collectLivePreviewWidgets(content, content.length);

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
    expect(container.querySelector(".cm-live-table")?.textContent).toContain("A");
    expect(container.querySelector(".cm-live-table")?.textContent).toContain("x");
  });

  it("ライブプレビューでフォーカスが外れたらカーソル行もレンダリングする", async () => {
    const classes = await collectLivePreviewClasses("**bold**", 0, false);

    expect(classes.has("cm-live-bold")).toBe(true);
  });
});
