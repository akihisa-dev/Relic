import { completionStatus, startCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  __markEditorCompositionEndedForTests,
  __markEditorCompositionStartedForTests
} from "../editorExtensions";
import { isListInputEvent } from "../editorListInput";
import { renderEditorWithView } from "./editorTestHelpers";

function modKeyInit(): { ctrlKey?: boolean; metaKey?: boolean } {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
}

function dispatchKeyboardEventWithReadOnlyValue(
  target: Element,
  key: string,
  property: "isComposing" | "keyCode",
  value: boolean | number
): void {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
  Object.defineProperty(event, property, { value });
  target.dispatchEvent(event);
}

describe("Editor shortcuts", () => {
  it("Mod+BとMod+Iで選択範囲へ太字・斜体を適用する", async () => {
    const { view } = await renderEditorWithView({
      content: "bold italic"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 0, head: 4 } });
    fireEvent.keyDown(contentElement, { key: "b", ...modKeyInit() });
    expect(view.state.doc.toString()).toBe("**bold** italic");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("bold");

    const italicStart = view.state.doc.toString().indexOf("italic");
    view.dispatch({ selection: { anchor: italicStart, head: italicStart + "italic".length } });
    fireEvent.keyDown(contentElement, { key: "i", ...modKeyInit() });
    expect(view.state.doc.toString()).toBe("**bold** *italic*");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("italic");
  });

  it("同じMarkdown書式を再実行すると記法を重複させず解除し、1回のUndoで戻せる", async () => {
    const { view } = await renderEditorWithView({ content: "bold" });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 0, head: 4 } });
    fireEvent.keyDown(contentElement, { key: "b", ...modKeyInit() });
    expect(view.state.doc.toString()).toBe("**bold**");

    fireEvent.keyDown(contentElement, { key: "b", ...modKeyInit() });
    expect(view.state.doc.toString()).toBe("bold");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("**bold**");
  });

  it("Mod+Kで選択範囲へMarkdownリンクを適用し、Undoで戻せる", async () => {
    const { view } = await renderEditorWithView({
      content: "open link"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 5, head: 9 } });
    fireEvent.keyDown(contentElement, { key: "k", ...modKeyInit() });

    expect(view.state.doc.toString()).toBe("open [link](URL)");
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe("link");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("open link");
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("open [link](URL)");
  });

  it("リスト行でEnterを押すと次の項目を作り、空項目ではリストを終了する", async () => {
    const { view } = await renderEditorWithView({
      content: "- item\n1. first\n- [x] done\n- "
    });
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

  it("リスト行への複数行貼り付けは字下げと種類を継続し、1回のUndoで戻せる", async () => {
    const { view } = await renderEditorWithView({
      content: "  3. 前後\n  - [x] 完了"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: "  3. 前".length } });
    fireEvent.paste(contentElement, {
      clipboardData: {
        getData: (type: string) => type === "text/plain" ? "一\n二\n\n三" : "",
        types: ["text/plain"]
      }
    });

    expect(view.state.doc.toString()).toBe("  3. 前一\n  4. 二\n\n  5. 三後\n  - [x] 完了");
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("  3. 前後\n  - [x] 完了");

    const checkboxPosition = view.state.doc.toString().indexOf("完了") + "完了".length;
    view.dispatch({ selection: { anchor: checkboxPosition } });
    fireEvent.paste(contentElement, {
      clipboardData: {
        getData: (type: string) => type === "text/plain" ? "済み\n次" : "",
        types: ["text/plain"]
      }
    });

    expect(view.state.doc.toString()).toBe("  3. 前後\n  - [x] 完了済み\n  - [ ] 次");
  });

  it("コードブロック内の複数行貼り付けはリスト記号を補わない", async () => {
    const { view } = await renderEditorWithView({
      content: "```md\n- 前後\n```"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    const position = view.state.doc.toString().indexOf("前") + 1;

    view.dispatch({ selection: { anchor: position } });
    fireEvent.paste(contentElement, {
      clipboardData: {
        getData: (type: string) => type === "text/plain" ? "一\n二" : "",
        types: ["text/plain"]
      }
    });

    expect(view.state.doc.toString()).toBe("```md\n- 前一\n二後\n```");
  });

  it("コードブロック内のリスト風テキストではEnterのリスト補完を実行しない", async () => {
    const { view } = await renderEditorWithView({
      content: "```md\n- item\n```"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: "```md\n- item".length } });
    fireEvent.keyDown(contentElement, { key: "Enter" });

    expect(view.state.doc.toString()).toBe("```md\n- item\n\n```");
  });

  it("TabとShift+Tabで選択中の行を段下げ・段上げする", async () => {
    const { view } = await renderEditorWithView({
      content: "- one\n- two\nplain"
    });
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

  it("補完候補が開いている間はTabをリストの字下げに使わない", async () => {
    const { view } = await renderEditorWithView({
      allFilePaths: ["alpha.md"],
      content: "- [[a"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;
    view.dispatch({ selection: { anchor: view.state.doc.length } });

    startCompletion(view);
    await waitFor(() => expect(completionStatus(view.state)).not.toBeNull());
    fireEvent.keyDown(contentElement, { key: "Tab" });

    expect(view.state.doc.toString()).toBe("- [[a");
  });

  it("Alt+上下で選択中の行を移動する", async () => {
    const { view } = await renderEditorWithView({
      content: "one\ntwo\nthree\nfour"
    });
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
    expect(isListInputEvent(new KeyboardEvent("keydown", { key: "Enter" }), { composing: false, compositionStarted: true } as EditorView)).toBe(false);
  });

  it("compositionstart中はMarkdown list shortcutを実行せずcompositionend後は通常入力に戻る", async () => {
    const { view } = await renderEditorWithView({
      content: "- 日本語"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    __markEditorCompositionStartedForTests(view);
    fireEvent.keyDown(contentElement, { key: "Enter" });

    expect(view.state.doc.toString()).toBe("- 日本語");

    __markEditorCompositionEndedForTests(view);
    fireEvent.keyDown(contentElement, { key: "Enter" });

    expect(view.state.doc.toString()).toBe("- 日本語\n- ");
  });

  it("keyCode 229のEnterではリスト補完を実行しない", async () => {
    const { view } = await renderEditorWithView({
      content: "- item"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    dispatchKeyboardEventWithReadOnlyValue(contentElement, "Enter", "keyCode", 229);

    expect(view.state.doc.toString()).toBe("- item");
  });

  it("event.isComposingのEnterではリスト補完を実行しない", async () => {
    const { view } = await renderEditorWithView({
      content: "- item"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    dispatchKeyboardEventWithReadOnlyValue(contentElement, "Enter", "isComposing", true);

    expect(view.state.doc.toString()).toBe("- item");
  });

  it("compositionstart中はTab段下げとAlt上下の行移動を実行しない", async () => {
    const { view } = await renderEditorWithView({
      content: "- one\n- two\nthree"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 0, head: "- one\n- two".length } });
    __markEditorCompositionStartedForTests(view);

    fireEvent.keyDown(contentElement, { key: "Tab" });
    expect(view.state.doc.toString()).toBe("- one\n- two\nthree");

    fireEvent.keyDown(contentElement, { altKey: true, key: "ArrowDown" });
    expect(view.state.doc.toString()).toBe("- one\n- two\nthree");

    __markEditorCompositionEndedForTests(view);
    fireEvent.keyDown(contentElement, { key: "Tab" });
    expect(view.state.doc.toString()).toBe("  - one\n  - two\nthree");
  });

  it("event.isComposingとkeyCode 229ではTab段下げとAlt上下の行移動を実行しない", async () => {
    const { view } = await renderEditorWithView({
      content: "one\ntwo\nthree"
    });
    const contentElement = view.dom.querySelector(".cm-content")!;

    view.dispatch({ selection: { anchor: 0, head: "one\ntwo".length } });
    dispatchKeyboardEventWithReadOnlyValue(contentElement, "Tab", "isComposing", true);
    expect(view.state.doc.toString()).toBe("one\ntwo\nthree");

    dispatchKeyboardEventWithReadOnlyValue(contentElement, "ArrowDown", "keyCode", 229);
    expect(view.state.doc.toString()).toBe("one\ntwo\nthree");

    fireEvent.keyDown(contentElement, { altKey: true, key: "ArrowDown" });
    expect(view.state.doc.toString()).toBe("three\none\ntwo");
  });
});
