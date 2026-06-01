import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { headingFoldRange } from "../editorHeadingFolding";
import { I18nProvider } from "../i18n";
import { Editor } from "./Editor";
import {
  collectInlineLivePreviewWidgetClasses,
  renderEditor,
  renderEditorWithView,
  settings
} from "./editorTestHelpers";

describe("Editor preview", () => {
  it("本文は設定幅の内側で折り返す", async () => {
    const { container } = renderEditor({
      content: "長い本文".repeat(80),
      settings: { ...settings, maxWidth: "660px" }
    });

    await waitFor(() => expect(container.querySelector(".cm-lineWrapping")).not.toBeNull());

    expect(container.querySelector(".cm-content")).toHaveStyle({ maxWidth: "660px" });
    expect(container.querySelector(".cm-line")).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("カーソルのある現在行を薄く示す", async () => {
    const { container, view } = await renderEditorWithView({
      content: "one\ntwo\nthree"
    });

    view.focus();
    view.dispatch({ selection: { anchor: "one\n".length } });

    await waitFor(() => expect(container.querySelector(".cm-activeLine")?.textContent).toBe("two"));

    view.dispatch({ selection: { anchor: "one\ntwo\n".length } });

    await waitFor(() => expect(container.querySelector(".cm-activeLine")?.textContent).toBe("three"));
  });

  it("行番号を表示するときも本文だけを設定幅で中央に置く", async () => {
    const { container } = renderEditor({
      content: "# 見出し\n\n本文",
      settings: { ...settings, maxWidth: "660px", showLineNumbers: true }
    });

    await waitFor(() => expect(container.querySelector(".cm-gutters")).not.toBeNull());

    expect(container.querySelector(".cm-scroller")).not.toHaveStyle({ justifyContent: "center" });
    expect(container.querySelector(".cm-gutters")).not.toHaveStyle({ left: "auto" });
    expect(container.querySelector(".cm-gutters")).toHaveStyle({ padding: "8px 0 24px" });
    expect(container.querySelector(".cm-content")).toHaveStyle({
      margin: "0 auto",
      maxWidth: "660px"
    });
  });

  it("見出し折りたたみ範囲を同じ階層以上の次の見出しまでにする", () => {
    const state = EditorState.create({
      doc: "# 章\n本文\n## 節\n節本文\n# 次の章",
      extensions: [markdown({ extensions: GFM })]
    });

    expect(headingFoldRange(state, state.doc.line(1).from)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(4).to
    });
    expect(headingFoldRange(state, state.doc.line(3).from)).toEqual({
      from: state.doc.line(3).to,
      to: state.doc.line(4).to
    });
  });

  it("コードブロック内の見出し記法は折りたたみ対象にしない", () => {
    const state = EditorState.create({
      doc: "```\n# コード内\n```\n# 本文\n本文",
      extensions: [markdown({ extensions: GFM })]
    });

    expect(headingFoldRange(state, state.doc.line(2).from)).toBeNull();
    expect(headingFoldRange(state, state.doc.line(4).from)).toEqual({
      from: state.doc.line(4).to,
      to: state.doc.line(5).to
    });
  });

  it("本文側の見出し行先頭ボタンで本文を折りたためる", async () => {
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"# 章\n本文\n## 節\n節本文\n# 次の章\n続き"}
          onChange={vi.fn()}
          settings={settings}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelectorAll(".cm-heading-fold-marker--open").length).toBeGreaterThanOrEqual(3));
    expect(container.querySelector(".cm-content .cm-heading-fold-marker--open")).not.toBeNull();
    expect(container.querySelector(".cm-gutters .cm-heading-fold-marker")).toBeNull();

    fireEvent.click(container.querySelector(".cm-heading-fold-marker--open") as HTMLElement);

    await waitFor(() => expect(container.querySelectorAll(".cm-heading-fold-marker--closed").length).toBeGreaterThanOrEqual(1));
    expect(container.querySelector(".cm-foldPlaceholder")?.textContent).toBe("…");
    expect(container.textContent).not.toContain("節本文");
    expect(container.textContent).toContain("次の章");
  });

  it("ソースモードでも開閉ボタンを見出し記号の左側に出す", async () => {
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"# 章\n本文"}
          onChange={vi.fn()}
          settings={settings}
          sourceMode
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector(".cm-heading-fold-marker--open")).not.toBeNull());
    expect(container.querySelector(".cm-line")?.textContent?.startsWith("▾# 章")).toBe(true);
    expect(container.querySelector(".cm-gutters .cm-heading-fold-marker")).toBeNull();
  });

  it("ライブプレビューの太字と斜体はDOM上でもレンダリング指定を持つ", async () => {
    const boldRender = renderEditor({ content: "**太字**" });

    await waitFor(() => expect(boldRender.container.querySelector(".cm-live-bold")).not.toBeNull());
    const boldElement = boldRender.container.querySelector(".cm-live-bold") as HTMLElement;
    expect(boldElement.style.fontWeight).toBe("900");
    expect(boldElement.style.paddingInline).toBe("0.015em");
    expect(boldElement.style.textShadow).toBe("0.025em 0 0 currentColor");
    boldRender.unmount();

    const italicRender = renderEditor({ content: "*斜体*" });

    await waitFor(() => expect(italicRender.container.querySelector(".cm-live-italic")).not.toBeNull());
    const italicElement = italicRender.container.querySelector(".cm-live-italic") as HTMLElement;
    expect(italicElement.style.fontStyle).toBe("italic");
    expect(italicElement.style.transform).toBe("skewX(-14deg)");
  });

  it("編集後もライブプレビュー装飾を更新する", async () => {
    const { container, viewRef } = await renderEditorWithView({ content: "plain" });

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
