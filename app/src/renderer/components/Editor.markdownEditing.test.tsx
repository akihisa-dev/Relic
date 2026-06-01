import { redo, undo } from "@codemirror/commands";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { renderEditorWithView, settings } from "./editorTestHelpers";
import { Editor } from "./Editor";

describe("Editor markdown editing", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("テキスト入力変更を onChange に通知し、Undo / Redo が動作する", async () => {
    const onChange = vi.fn();
    const { view } = await renderEditorWithView({ content: "hello", onChange });

    view.dispatch({ changes: { from: 5, insert: " world" } });

    expect(onChange).toHaveBeenLastCalledWith("hello world");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("hello world");
  });

  it("本文の右クリックメニューからコピー・カット・ペーストを実行できる", async () => {
    const readClipboardText = vi.fn().mockReturnValue("!");
    const writeClipboardText = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    window.relic = makeRelicApi({
      readClipboardText,
      writeClipboardText
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: readClipboardText,
        writeText
      }
    });

    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: 5 } });

    fireEvent.mouseDown(contentElement, { button: 2, clientX: 32, clientY: 32 });
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy" }));
    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith("hello");
    });

    view.dispatch({ selection: { anchor: 5, head: 5 } });
    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Paste" }));
    await waitFor(() => {
      expect(document.body.textContent).toContain("hello! world");
    });
  });

  it("外側からcontentが更新されたら表示中の文書も同期する", async () => {
    const { rerender, viewRef } = await renderEditorWithView({ content: "left" });

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
});
