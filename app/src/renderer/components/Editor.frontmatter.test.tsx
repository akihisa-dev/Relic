import { readFileSync } from "node:fs";

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
  it("プロパティフォームの横幅は本文カラム内に収める", () => {
    const css = readFileSync("src/renderer/styles/editor-frontmatter.css", "utf8");

    expect(css).toMatch(/\.cm-frontmatter-properties\s*\{[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s);
    expect(css).toMatch(/\.cm-frontmatter-properties--panel\s*\{[^}]*margin-left:\s*0;/s);
    expect(css).not.toContain("--frontmatter-panel-width");
    expect(css).not.toMatch(/\.cm-frontmatter-properties\s*\{[^}]*width:\s*max\(/s);
    expect(css).toMatch(/\.cm-frontmatter-row-icon\s*\{[^}]*align-self:\s*stretch;[^}]*width:\s*100%;/s);
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

  it("フロントマターは1つのプロパティフォームとして表示しYAML各行をガターに残さない", async () => {
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nupdated: 2026-03-24\naliases:\n  - test\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    const collapsedLineNumbers = Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent);

    expect(collapsedLineNumbers).toEqual(expect.arrayContaining(["7"]));
    expect(collapsedLineNumbers).not.toEqual(expect.arrayContaining(["2", "3", "4", "5", "6"]));

    await expandFrontmatter(container);

    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).not.toEqual(expect.arrayContaining([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6"
    ]));
    expect(container.querySelector(".cm-frontmatter-line-number")).toBeNull();
  });

  it("展開中のフロントマター終端行は追加操作行として表示する", async () => {
    const { container } = render(
      <Editor
        content={"---\naliases:\n---\n# 本文"}
        onChange={vi.fn()}
        settings={{ ...settings, showLineNumbers: true }}
      />
    );

    await expandFrontmatter(container);

    expect(container.querySelectorAll(".cm-frontmatter-properties")).toHaveLength(1);
    expect(container.querySelector(".cm-frontmatter-properties--spacer")).toBeNull();
    expect(container.querySelector(".cm-frontmatter-add-property")?.textContent).toContain("Add property");
    expect(Array.from(container.querySelectorAll(".cm-gutterElement")).map((line) => line.textContent)).toEqual(expect.arrayContaining([
      "4"
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

  it("左端のハンドルをドラッグしてすべてのトップレベルプロパティを並び替える", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = [
      "---",
      "title: 'Old' # keep",
      "# このコメント行は位置を保持",
      "custom:",
      "  nested: value",
      "tags:",
      "  - 資料",
      "---",
      "# 本文"
    ].join("\n");
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={content}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".cm-frontmatter-row"));
    expect(rows.map((row) => row.dataset.frontmatterKey)).toEqual(["title", "custom", "tags"]);
    expect(rows.map((row) => row.querySelector(".cm-frontmatter-row-icon")?.getAttribute("aria-label"))).toEqual([
      "title ドラッグしてプロパティを並び替え",
      "custom ドラッグしてプロパティを並び替え",
      "tags ドラッグしてプロパティを並び替え"
    ]);

    vi.spyOn(rows[0], "getBoundingClientRect").mockReturnValue({
      bottom: 76,
      height: 76,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    const handle = rows[2].querySelector(".cm-frontmatter-row-icon") as HTMLButtonElement;
    const firePointerEvent = (type: string, clientY: number): void => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      fireEvent(handle, event);
    };
    firePointerEvent("pointerdown", 190);
    firePointerEvent("pointermove", 192);
    expect(document.querySelector(".cm-frontmatter-row--drag-preview")).toBeNull();
    expect(viewRef.current?.state.doc.toString()).toBe(content);

    firePointerEvent("pointermove", 10);
    expect(document.querySelector(".cm-frontmatter-row--drag-preview")).not.toBeNull();
    expect(document.querySelector(".cm-frontmatter-row-drag-origin")).not.toBeNull();
    expect(document.querySelector(".cm-frontmatter-row-drop-indicator")).not.toBeNull();
    expect(Array.from(container.querySelectorAll<HTMLElement>(".cm-frontmatter-row")).map((row) => (
      row.dataset.frontmatterKey
    ))).toEqual(["title", "custom", "tags"]);
    expect(viewRef.current?.state.doc.toString()).toBe(content);

    firePointerEvent("pointerup", 10);
    expect(document.querySelector(".cm-frontmatter-row--drag-preview")).toBeNull();
    expect(document.querySelector(".cm-frontmatter-row-drag-origin")).toBeNull();
    expect(document.querySelector(".cm-frontmatter-row-drop-indicator")).toBeNull();

    expect(viewRef.current?.state.doc.toString()).toBe([
      "---",
      "tags:",
      "  - 資料",
      "# このコメント行は位置を保持",
      "title: 'Old' # keep",
      "custom:",
      "  nested: value",
      "---",
      "# 本文"
    ].join("\n"));
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

  it("プロパティ内の追加ボタンから既存フロントマターに固定プロパティを追加できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"---\nversion: v1.0\nstatus:\n---\n# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);

    fireEvent.click(container.querySelector(".cm-frontmatter-add-property") as HTMLButtonElement);
    const items = Array.from(document.body.querySelectorAll(".editor-frontmatter-add-menu-item"));
    expect(items.some((item) => item.textContent?.includes("status"))).toBe(false);
    expect(items.some((item) => item.textContent?.includes("plannedDate"))).toBe(false);
    expect(items.some((item) => item.textContent?.includes("actualDate"))).toBe(false);
    const aliasesItem = items.find((item) => item.textContent?.includes("aliases")) as HTMLButtonElement;
    fireEvent.click(aliasesItem);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("aliases:"));
    expect(viewRef.current?.state.doc.toString()).toContain("---\nversion: v1.0\nstatus:\naliases:\n---");
  });

  it("常設プラスボタンからフロントマターを新規作成できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Editor
        content={"# 本文"}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());

    expect(container.querySelector(".cm-frontmatter-starter")).toBeNull();
    expect(container.querySelector(".cm-frontmatter-add-input")).toBeNull();

    const addButton = container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement;
    expect(addButton).toHaveAccessibleName("Add frontmatter");
    expect(addButton.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(addButton.textContent).toBe("");
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenLastCalledWith("---\n---\n# 本文");
    expect(viewRef.current?.state.doc.toString()).toBe("---\n---\n# 本文");
    expect(document.body.querySelector(".editor-frontmatter-add-menu")).toBeNull();
  });

  it("常設プラスボタンは既存フロントマターへプロパティを追加しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const onChange = vi.fn();
    const content = "---\ntags:\n---\n# 本文";
    const { container } = render(
      <Editor
        content={content}
        onChange={onChange}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull());
    fireEvent.click(container.querySelector(".editor-frontmatter-add-button") as HTMLButtonElement);

    expect(onChange).not.toHaveBeenCalled();
    expect(viewRef.current?.state.doc.toString()).toBe(content);
    expect(document.body.querySelector(".editor-frontmatter-add-menu")).toBeNull();
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

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-properties")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("true");
    expect(container.querySelectorAll(".cm-frontmatter-row")).toHaveLength(0);
  });

  it("本文内のプロパティ追加メニューは画面端で見切れにくい位置へ補正する", async () => {
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
        content={"---\ntags:\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);

    const button = container.querySelector(".cm-frontmatter-add-property") as HTMLButtonElement;
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
    const menu = document.body.querySelector(".editor-frontmatter-add-menu") as HTMLElement;

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

  it("未完了のフロントマター記法にはフロントマターを追加しない", async () => {
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

    expect(document.body.querySelector(".editor-frontmatter-add-menu")).toBeNull();
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
    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate:\n  - '2026-05-25'");
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

    expect(viewRef.current?.state.doc.toString()).toContain("tags:\n  - idea\n  - review");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-remove")).toHaveLength(2));
    fireEvent.click(container.querySelectorAll(".cm-frontmatter-pill-remove")[1] as HTMLButtonElement);

    expect(viewRef.current?.state.doc.toString()).toContain("tags:\n  - idea");
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

    expect(viewRef.current?.state.doc.toString()).toContain("tags:\n  - draft\n  - review");
  });

  it("aliasesとtagsを通常のYAML配列として書き戻す", async () => {
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

    expect(viewRef.current?.state.doc.toString()).toContain("aliases:\n  - 王都\n  - 旧都");

    await waitFor(() => expect(container.querySelectorAll(".cm-frontmatter-pill-value")).toHaveLength(3));
    const nextValues = Array.from(container.querySelectorAll(".cm-frontmatter-pill-value")) as HTMLInputElement[];
    fireEvent.change(nextValues[2], { target: { value: "下書き" } });

    expect(viewRef.current?.state.doc.toString()).toContain("tags:\n  - 下書き");
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
