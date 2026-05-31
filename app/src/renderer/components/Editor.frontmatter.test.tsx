import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { Editor } from "./Editor";
import {
  collectInlineLivePreviewWidgets,
  collectLivePreviewClasses,
  expandFrontmatter,
  settings
} from "./editorTestHelpers";

describe("Editor frontmatter", () => {
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
      <I18nProvider language="ja">
        <Editor
          content={"---\nversion: v1.0\naliases: [帝都オルスター, 帝都]\n---\n# 本文"}
          onChange={onChange}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.textContent).toContain("プロパティ");
    expect((container.querySelector(".cm-frontmatter-properties") as HTMLElement).contentEditable).toBe("false");
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);

    await expandFrontmatter(container);

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

  it("ソースモードではフロントマターをフォーム化せずMarkdown構文のまま表示する", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        sourceMode
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    expect(container.querySelector(".cm-frontmatter-properties")).toBeNull();
    expect(container.textContent).toContain("version: v1.0");
  });

  it("ソースモード切替時に既存のフォーム化DOMを残さない", async () => {
    const { container, rerender } = render(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());

    rerender(
      <Editor
        content={"---\nversion: v1.0\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        sourceMode
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).toBeNull());
    expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(container.textContent).toContain("version: v1.0");
  });

  it("フロントマターは表示対象のYAML行だけを行番号ガターに残す", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nupdated: 2026-03-24\naliases:\n  - test\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    const collapsedLineNumbers = Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent);

    expect(collapsedLineNumbers).toEqual(expect.arrayContaining(["1", "7"]));
    expect(collapsedLineNumbers).not.toEqual(expect.arrayContaining(["2", "3", "4", "5", "6"]));

    await expandFrontmatter(container);

    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).toEqual(expect.arrayContaining([
      "1",
      "2",
      "3",
      "4",
      "7"
    ]));
    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).not.toEqual(expect.arrayContaining([
      "5",
      "6"
    ]));
    expect(container.querySelector(".cm-frontmatter-line-number")).toBeNull();
  });

  it("展開中のフロントマター終端行を空白の編集行として残さない", async () => {
    const { container } = render(
      <Editor
        content={"---\naliases:\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await expandFrontmatter(container);

    expect(container.querySelectorAll(".cm-frontmatter-properties")).toHaveLength(2);
    expect(container.querySelector(".cm-frontmatter-properties--spacer")).toBeNull();
    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).toEqual(expect.arrayContaining([
      "1",
      "2",
      "4"
    ]));
    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).not.toEqual(expect.arrayContaining([
      "3"
    ]));
  });

  it("プロパティフォームは折りたためる", async () => {
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);

    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);

    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
    });
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(viewRef.current?.state.doc.toString()).toBe("---\nversion: v1.0\nstatus: draft\n---\n# 本文");

    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);

    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    });
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);
  });

  it("展開中のフロントマターはエディタ再生成後も勝手に閉じない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container, rerender } = render(
      <Editor
        content={"---\nversion: v1.0\nstatus: draft\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);
    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
    });

    rerender(
      <Editor
        content={"---\nversion: v1.0\nstatus: draft\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, fontSize: settings.fontSize + 1 }}
        viewRef={viewRef}
      />
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
    });
  });

  it("常設プラスボタンから既存フロントマターに固定プロパティを追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nplannedDate:\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const items = Array.from(container.querySelectorAll(".editor-frontmatter-add-menu-item"));
    expect(items.some((item) => item.textContent?.includes("plannedDate"))).toBe(false);
    const actualDateItem = items.find((item) => item.textContent?.includes("actualDate")) as HTMLButtonElement;
    fireEvent.click(actualDateItem);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("actualDate:"));
    expect(viewRef.current?.state.doc.toString()).toContain("---\nversion: v1.0\nplannedDate:\nactualDate:\n---");
  });

  it("常設プラスボタンからフロントマターを新規作成できる", async () => {
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

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();
    expect(container.querySelector(".cm-frontmatter-add-input")).toBeNull();

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const plannedDateItem = Array.from(container.querySelectorAll(".editor-frontmatter-add-menu-item"))
      .find((item) => item.textContent?.includes("plannedDate")) as HTMLButtonElement;
    fireEvent.click(plannedDateItem);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("plannedDate:"));
    expect(viewRef.current?.state.doc.toString()).toBe("---\nplannedDate:\n---\n# 本文");
  });

  it("削除後に作り直したフロントマターは以前の展開状態を勝手に引き継がない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).toBeNull());

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const plannedDateItem = Array.from(container.querySelectorAll(".editor-frontmatter-add-menu-item"))
      .find((item) => item.textContent?.includes("plannedDate")) as HTMLButtonElement;
    fireEvent.click(plannedDateItem);

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);
  });

  it("空の新規ファイルでもフロントマター追加メニューを本文行数に依存しない高さで表示する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content=""
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);
    const menu = container.querySelector(".editor-frontmatter-add-menu") as HTMLElement;

    expect(menu).not.toBeNull();
    expect(menu.style.top).not.toBe("");
    expect(menu.style.left).not.toBe("");
    expect(menu.style.maxHeight).not.toBe("");
  });

  it("フロントマター追加メニューは画面端で見切れにくい位置へ補正する", async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const originalClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, "clientWidth");
    const originalClientHeight = Object.getOwnPropertyDescriptor(document.documentElement, "clientHeight");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 360 });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content=""
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    const button = container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement;
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      bottom: 752,
      height: 32,
      left: 318,
      right: 350,
      top: 720,
      width: 32,
      x: 318,
      y: 720,
      toJSON: () => ({})
    });

    fireEvent.click(button);
    const menu = container.querySelector(".editor-frontmatter-add-menu") as HTMLElement;

    expect(menu.style.left).toBe("44px");
    expect(menu.style.top).toBe("192px");
    expect(menu.style.maxHeight).toBe("520px");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
    if (originalClientWidth) {
      Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
    }
    if (originalClientHeight) {
      Object.defineProperty(document.documentElement, "clientHeight", originalClientHeight);
    }
  });

  it("未完了のフロントマター記法にはプロパティを追加しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();

    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);

    expect(container.querySelector(".editor-frontmatter-add-menu-empty")).not.toBeNull();
    expect(container.querySelector(".editor-frontmatter-add-menu-item")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(viewRef.current?.state.doc.toString()).toBe("---\nstatus: draft\n# 本文");
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

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-remove")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);

    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("version:"));
    expect(viewRef.current?.state.doc.toString()).toContain("status: draft");
  });

  it("展開中フロントマター入力から本文をクリックすると本文編集へ戻る", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstatus: draft\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    const view = viewRef.current!;
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    input.focus();

    await waitFor(() => expect(view.state.facet(EditorView.editable)).toBe(false));

    fireEvent.mouseDown(input);
    expect(view.state.facet(EditorView.editable)).toBe(false);

    fireEvent.mouseDown(view.dom.querySelector(".cm-content") as HTMLElement, {
      button: 0,
      clientX: 48,
      clientY: 160
    });

    expect(view.state.facet(EditorView.editable)).toBe(true);
  });

  it("複数行プロパティを削除しても隣のプロパティは残す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntags:\n  - 資料\n  - 下書き\nplannedDate: [2026-05-25]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-remove")).not.toBeNull());
    fireEvent.click(container.querySelector(".cm-frontmatter-remove") as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).not.toContain("tags:");
    expect(viewRef.current?.state.doc.toString()).not.toContain("- 資料");
    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-25]");
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

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-pill-value")).not.toBeNull());
    const values = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(values[0], { target: { value: "idea" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\", \"review\"]");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-remove")).toHaveLength(2));
    fireEvent.click(container.querySelectorAll(".cm-frontmatter-pill-remove")[1] as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"idea\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("review");
  });

  it("配列プロパティのプラスボタンから値を追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\ntags: [draft]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    fireEvent.click(container.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    const input = container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(viewRef.current?.state.doc.toString()).toBe("---\ntags: [draft]\n---\n# 本文");

    fireEvent.click(container.querySelector(".frontmatter-add-dialog-actions button:last-child") as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"draft\", \"review\"]");
  });

  it("aliasesとtagsは元が複数行でも1行配列として書き戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\naliases:\n  - 帝都\n  - 旧都\ntags:\n  - 資料\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-pill-value")).not.toBeNull());
    const values = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(values[0], { target: { value: "王都" } });

    expect(viewRef.current?.state.doc.toString()).toContain("aliases: [\"王都\", \"旧都\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("aliases:\n  -");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-value")).toHaveLength(3));
    const nextValues = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(nextValues[2], { target: { value: "下書き" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags: [\"下書き\"]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("tags:\n  -");
  });

  it("aliases入力では他ファイル由来の候補を表示しない", async () => {
    const { container } = render(
      <Editor
        content={"---\naliases: [自分の別名]\ntags: [資料]\n---\n# 本文"}
        frontmatterCandidates={{
          aliases: ["他ファイルの別名"],
          tags: ["下書き"]
        }}
        onChange={vi.fn()}
        settings={settings}
      />
    );

    await expandFrontmatter(container);

    const rows = Array.from(container.querySelectorAll(".cm-frontmatter-row"));
    const aliasRow = rows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "aliases") as HTMLElement;
    const tagRow = rows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "tags") as HTMLElement;
    fireEvent.click(aliasRow.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    expect((container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement).getAttribute("list")).toBeNull();
    fireEvent.click(container.querySelector(".frontmatter-add-dialog-actions button:first-child") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".frontmatter-add-dialog-input")).toBeNull());

    const nextRows = Array.from(container.querySelectorAll(".cm-frontmatter-row"));
    const nextTagRow = nextRows.find((row) => row.querySelector(".cm-frontmatter-key")?.textContent === "tags") as HTMLElement;
    fireEvent.click(nextTagRow.querySelector(".cm-frontmatter-pill-add") as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector(".frontmatter-add-dialog-input")).not.toBeNull());
    expect((container.querySelector(".frontmatter-add-dialog-input") as HTMLInputElement).getAttribute("list")).not.toBeNull();
  });
});
