import { EditorView } from "@codemirror/view";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isListInputEvent } from "../editorListInput";
import { renderEditorWithView } from "./editorTestHelpers";

describe("Editor shortcuts", () => {
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
  });
});
