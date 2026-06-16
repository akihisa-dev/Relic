import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contextSelectionHighlightField } from "../editorContextSelectionHighlight";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { renderEditorWithView, settings } from "./editorTestHelpers";

describe("Editor selection commands", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("Electronでも本文の右クリックでMarkdownメニューを表示する", async () => {
    window.relic = makeRelicApi({
      readEditorClipboardForPaste: vi.fn().mockResolvedValue({ ok: true, value: "" }),
      copyEditorTextToClipboard: vi.fn().mockResolvedValue({ ok: true, value: undefined })
    });

    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });

    expect(await screen.findByRole("menuitem", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
  });

  it("本文の右クリックメニューから選択範囲にMarkdown操作を適用できる", async () => {
    const onChange = vi.fn();
    const { view, viewRef } = await renderEditorWithView({
      content: "hello world",
      onChange,
      settings: { ...settings, language: "ja" }
    });
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
    const onChange = vi.fn();
    const { view, viewRef } = await renderEditorWithView({
      content: "hello world",
      onChange,
      settings: { ...settings, language: "ja" }
    });
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
    const onChange = vi.fn();
    const { view, viewRef } = await renderEditorWithView({
      content: "one\ntwo\nthree",
      onChange,
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: 0, head: "one\ntwo".length } });

    fireEvent.contextMenu(contentElement, { clientX: 32, clientY: 32 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Code block" }));

    expect(onChange).toHaveBeenLastCalledWith("```\none\ntwo\n```\nthree");
    expect(viewRef.current!.state.doc.toString()).toBe("```\none\ntwo\n```\nthree");
  });

  it("本文の右クリックメニューからアイコンのSVGを押してもMarkdown操作を適用できる", async () => {
    const onChange = vi.fn();
    const { view, viewRef } = await renderEditorWithView({
      content: "hello world",
      onChange,
      settings: { ...settings, language: "ja" }
    });
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
    const { view } = await renderEditorWithView({
      content: "hello world",
      settings: { ...settings, language: "ja" }
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

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
});
