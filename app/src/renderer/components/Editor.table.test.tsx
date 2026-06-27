import { undo, redo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { livePreviewTableMaxRows } from "../editorTables";
import { Editor } from "./Editor";
import { collectLivePreviewWidgets, settings } from "./editorTestHelpers";

describe("Editor table preview", () => {
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

  it("大きすぎる表はライブプレビューWidget化せず本文入力を軽く保つ", async () => {
    const content = [
      "| A | B |",
      "| --- | --- |",
      ...Array.from({ length: livePreviewTableMaxRows }, (_, index) => `| ${index} | value |`)
    ].join("\n");
    const widgets = await collectLivePreviewWidgets(content, content.length);

    expect(widgets).not.toContain("TableWidget");
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

  it("ライブプレビューの表セルにTSVを貼り付けると複数セルへ展開する", async () => {
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

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "left\tright\nnext\tlast"
      }
    });

    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| left | right |\n| next | last |");
  });

  it("ライブプレビューの表セルTSV貼り付けは1回のUndoで戻せる", async () => {
    const viewRef = createRef<EditorView | null>();
    const original = "| A | B |\n| --- | --- |\n| x | y |";
    const pasted = "| A | B |\n| --- | --- |\n| 左 | 右 |\n| 次 | 最後 |";

    const { container } = render(
      <Editor
        content={original}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "左\t右\n次\t最後"
      }
    });

    expect(viewRef.current?.state.doc.toString()).toBe(pasted);
    expect(undo(viewRef.current!)).toBe(true);
    expect(viewRef.current?.state.doc.toString()).toBe(original);
    expect(redo(viewRef.current!)).toBe(true);
    expect(viewRef.current?.state.doc.toString()).toBe(pasted);
  });

  it("ライブプレビューの表セルへの貼り付けが既存列を超える場合は列を追加する", async () => {
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
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]') as HTMLInputElement;

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "right\textra"
      }
    });

    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |  |\n| --- | --- | --- |\n| x | right | extra |");
  });

  it("ライブプレビューの表セルへの単一テキスト貼り付けは表展開しない", async () => {
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
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: () => "single"
      }
    });

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| x | y |");
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

  it("ライブプレビューの表で上下左右キーから隣セルへ移動する", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    fireEvent.keyDown(input, { key: "ArrowRight" });
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]'));
    });

    fireEvent.keyDown(document.activeElement as HTMLInputElement, { key: "ArrowDown" });
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="1"]'));
    });

    const bottomRight = document.activeElement as HTMLInputElement;
    bottomRight.setSelectionRange(0, 0);
    fireEvent.keyDown(bottomRight, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="2"][data-col="0"]'));
    });

    fireEvent.keyDown(document.activeElement as HTMLInputElement, { key: "ArrowUp" });
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]'));
    });
  });

  it("ライブプレビューの表で左右キーはセル内カーソルが端にない場合はセル移動しない", async () => {
    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| text | y |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-live-table-cell-input")).not.toBeNull());
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement;

    input.focus();
    input.setSelectionRange(2, 2);
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(document.activeElement).toBe(input);
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

  it("ライブプレビューの表で追加ボタンへ移動してもボタンが消えずクリックできる", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]')).not.toBeNull());
    const table = container.querySelector(".cm-live-table") as HTMLElement;
    const input = container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="1"]') as HTMLInputElement;
    const addButton = container.querySelector(".cm-live-table-add--row-after") as HTMLButtonElement;

    fireEvent.mouseEnter(input);
    fireEvent.mouseLeave(table);
    expect(table.dataset.canAddRowAfter).toBe("true");

    fireEvent.click(addButton);
    expect(viewRef.current?.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| x | y |\n|  |  |");
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

  it("ライブプレビューの表操作ボタンから右クリックメニューと同じ操作を開ける", async () => {
    const { container, getByText } = render(
      <I18nProvider language="ja">
        <Editor
          content={"| A | B |\n| --- | --- |\n| x | y |"}
          onChange={vi.fn()}
          settings={settings}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]')).not.toBeNull());
    (container.querySelector('.cm-live-table-cell-input[data-row="1"][data-col="0"]') as HTMLInputElement).focus();
    fireEvent.click(getByText("表操作"));

    expect(getByText("行を下に追加")).not.toBeNull();
    expect(getByText("列を右に追加")).not.toBeNull();
  });

  it("ライブプレビューの表メニューは画面に固定表示して切れにくくする", async () => {
    const { container, getByText } = render(
      <I18nProvider language="ja">
        <Editor
          content={"| A | B |\n| --- | --- |\n| x | y |"}
          onChange={vi.fn()}
          settings={settings}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector('td[data-row="1"][data-column="0"]')).not.toBeNull());
    fireEvent.contextMenu(container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement, {
      clientX: 1200,
      clientY: 900
    });

    const menu = getByText("行を下に追加").closest(".cm-live-table-menu") as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.style.position).toBe("fixed");
    expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(8);
  });

  it("ライブプレビューの表セルをドラッグして範囲選択し、TSVとしてコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText
      }
    });

    const { container } = render(
      <Editor
        content={"| A | B |\n| --- | --- |\n| x | y |\n| z | w |"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector('td[data-row="1"][data-column="0"]')).not.toBeNull());
    const startCell = container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement;
    const endCell = container.querySelector('td[data-row="2"][data-column="1"]') as HTMLTableCellElement;
    const table = container.querySelector(".cm-live-table") as HTMLElement;

    fireEvent.mouseDown(startCell, { button: 0 });
    fireEvent.mouseEnter(endCell);
    fireEvent.mouseUp(document);

    expect(container.querySelectorAll(".cm-live-table-selected")).toHaveLength(4);

    fireEvent.keyDown(table, { key: "c", metaKey: true });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("x\ty\nz\tw"));
  });

  it("ライブプレビューの表で選択範囲をDeleteするとセル内容だけ消す", async () => {
    const viewRef = createRef<EditorView | null>();

    const { container } = render(
      <Editor
        content={"| A | B | C |\n| --- | --- | --- |\n| x | y | keep |\n| z | w | stay |"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector('td[data-row="1"][data-column="0"]')).not.toBeNull());
    const startCell = container.querySelector('td[data-row="1"][data-column="0"]') as HTMLTableCellElement;
    const endCell = container.querySelector('td[data-row="2"][data-column="1"]') as HTMLTableCellElement;
    const table = container.querySelector(".cm-live-table") as HTMLElement;

    fireEvent.mouseDown(startCell, { button: 0 });
    fireEvent.mouseEnter(endCell);
    fireEvent.mouseUp(document);
    fireEvent.keyDown(table, { key: "Delete" });

    expect(viewRef.current?.state.doc.toString()).toBe("| A | B | C |\n| --- | --- | --- |\n|  |  | keep |\n|  |  | stay |");
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
});
