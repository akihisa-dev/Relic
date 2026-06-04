import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { collectInlineMatches, findClickableLinkAtPosition, overlaps } from "./editorLivePreviewModel";

describe("editorLivePreviewModel", () => {
  it("主要なインライン記法を検出する", () => {
    const text = "`code` [link](https://example.com) [[Note|Alias]] **bold** __strong__ ~~gone~~ ==mark== <u>under</u> [^note] $x^2$ *em* _it_";
    const matches = collectInlineMatches(0, text);

    expect(matches.map((match) => ({
      className: match.className,
      text: text.slice(match.contentFrom, match.contentTo)
    }))).toEqual([
      { className: "cm-live-code", text: "code" },
      { className: "cm-live-link", text: "link" },
      { className: "cm-live-link", text: "Alias" },
      { className: "cm-live-bold", text: "bold" },
      { className: "cm-live-bold", text: "strong" },
      { className: "cm-live-strike", text: "gone" },
      { className: "cm-live-highlight", text: "mark" },
      { className: "cm-live-underline", text: "under" },
      { className: "cm-live-footnote-ref", text: "note" },
      { className: "cm-live-math-inline", text: "x^2" },
      { className: "cm-live-italic", text: "em" },
      { className: "cm-live-italic", text: "it" }
    ]);
  });

  it("範囲が重なる記法は外側を優先する", () => {
    const matches = collectInlineMatches(0, "[**bold**](https://example.com)");

    expect(matches).toHaveLength(1);
    expect(matches[0].className).toBe("cm-live-link");
  });

  it("範囲の重なりを判定する", () => {
    expect(overlaps(2, 4, [{ from: 0, to: 3 }])).toBe(true);
    expect(overlaps(3, 5, [{ from: 0, to: 3 }])).toBe(false);
  });

  it("Markdown linkのクリック位置からhrefを返す", () => {
    const state = EditorState.create({ doc: "Go [site](https://example.com)" });
    const position = state.doc.toString().indexOf("site");

    expect(findClickableLinkAtPosition(state.doc, position)).toEqual({
      href: "https://example.com",
      type: "markdown"
    });
  });

  it("wiki linkのクリック位置からtargetとheadingを返す", () => {
    const state = EditorState.create({ doc: "See [[Folder/Note#Intro|Alias]]" });
    const position = state.doc.toString().indexOf("Alias");

    expect(findClickableLinkAtPosition(state.doc, position)).toEqual({
      heading: "Intro",
      target: "Folder/Note",
      type: "wiki"
    });
  });
});
