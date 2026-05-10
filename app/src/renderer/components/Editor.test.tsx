import { redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { fireEvent, render, waitFor } from "@testing-library/react";
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
      "<u>underline</u>",
      "[link](https://example.com)",
      "[[Page]]"
    ].join("\n"), 0, false);

    expect(Array.from(classes)).toEqual(expect.arrayContaining([
      "cm-live-bold",
      "cm-live-italic",
      "cm-live-strike",
      "cm-live-code",
      "cm-live-highlight",
      "cm-live-underline",
      "cm-live-link"
    ]));
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
      <Editor
        content={"---\nversion: v1.0\naliases: [帝都オルスター, 帝都]\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.textContent).toContain("プロパティ");
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

  it("プロパティフォームは折りたためる", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);

    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
  });

  it("プロパティフォームからプロパティを追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-add-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-add-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "updated" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("updated:"));
    expect(viewRef.current?.state.doc.toString()).toContain("updated:");
  });

  it("フロントマターがない本文へプロパティフォームから新規作成できる", async () => {
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-starter")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-starter .cm-frontmatter-add-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "status" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith("---\nstatus:\n---\n# 本文");
    expect(viewRef.current?.state.doc.toString()).toBe("---\nstatus:\n---\n# 本文");
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
  });

  it("未完了のフロントマター記法には新規作成入口を重ねない", async () => {
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-remove")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);

    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("version:"));
    expect(viewRef.current?.state.doc.toString()).toContain("status: draft");
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-pill-value")).not.toBeNull());
    const values = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(values[0], { target: { value: "idea" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\", \"review\"]");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-remove")).toHaveLength(2));
    fireEvent.click(container.querySelectorAll(".cm-frontmatter-pill-remove")[1] as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("review");
  });

  it("プロパティ編集時にYAMLのコメント行とフィールド順をできるだけ保つ", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\n# 管理用メモ\nstatus: draft # 執筆状態\n\n# 公開日\npublished: false\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        userDefinedFields={[{ name: "published", type: "boolean" }]}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });

    expect(viewRef.current?.state.doc.toString()).toContain([
      "---",
      "# 管理用メモ",
      "status: review # 執筆状態",
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New title" } });

    expect(viewRef.current?.state.doc.toString()).toContain("title: \"New title\" # 表示名");
  });

  it("登録済みプロパティの入力能力をフォームに反映する", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\nupdated: 2026-03-29\npublished: false\n---\n# 本文"}
        frontmatterCandidates={{ status: ["review"] }}
        onChange={onChange}
        settings={settings}
        userDefinedFields={[
          { choices: ["draft", "published"], name: "status", type: "select" },
          { name: "updated", type: "date" },
          { name: "published", type: "boolean" }
        ]}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    const statusInput = Array.from(container.querySelectorAll(".cm-frontmatter-input"))
      .find((input) => (input as HTMLInputElement).value === "draft") as HTMLInputElement;
    const statusOptions = Array.from(container.querySelectorAll(`#${statusInput.getAttribute("list")} option`))
      .map((option) => (option as HTMLOptionElement).value);
    expect(statusOptions).toEqual(["draft", "published", "review"]);

    const dateInput = Array.from(container.querySelectorAll(".cm-frontmatter-input"))
      .find((input) => (input as HTMLInputElement).type === "date") as HTMLInputElement;
    expect(dateInput.value).toBe("2026-03-29");
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });
    expect(viewRef.current?.state.doc.toString()).toContain("updated: 2026-04-01");

    const checkbox = container.querySelector(".cm-frontmatter-checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(viewRef.current?.state.doc.toString()).toContain("published: true");
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
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
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
      <Editor
        content={"| A | B |\n| --- | --- |\n| 2 | b |\n| 10 | a |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
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

  it("ライブプレビューの太字はDOM上でも強いウェイトを持つ", async () => {
    const { container } = render(
      <Editor
        content="**太字**"
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-bold")).not.toBeNull());
    expect((container.querySelector(".cm-live-bold") as HTMLElement).style.fontWeight).toBe("800");
  });

  it("ライブプレビューでフォーカスが外れたらカーソル行もレンダリングする", async () => {
    const classes = await collectLivePreviewClasses("**bold**", 0, false);

    expect(classes.has("cm-live-bold")).toBe(true);
  });
});
