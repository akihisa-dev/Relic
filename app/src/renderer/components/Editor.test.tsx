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
import { buildLivePreviewDecorations, buildWikiLinkCompletionSource, Editor } from "./Editor";

const settings = defaultEditorSettings;

async function collectLivePreviewClasses(content: string, cursor: number): Promise<Set<string>> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const classes = new Set<string>();
  buildLivePreviewDecorations({
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const cls = (value as unknown as { spec?: { class?: string } }).spec?.class;
    if (cls) classes.add(cls);
  });

  return classes;
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

  it("ライブプレビューでカーソル行はMarkdown記法のままにする", async () => {
    const classes = await collectLivePreviewClasses("==mark==\n\n==other==", 0);

    expect(classes.has("cm-live-highlight")).toBe(true);
    expect(classes.size).toBe(1);
  });
});
