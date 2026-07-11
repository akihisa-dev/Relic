import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { Editor } from "./Editor";
import { expandFrontmatter, settings } from "./editorTestHelpers";

describe("Editor frontmatter fields", () => {
  it("chronicleプロパティは開始年と終了年を通常YAMLで編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle:\n  - [メイン暦, [[1185, null], [1185, null]]]\n---\n# 本文"}
          frontmatterCandidates={{ chronicle: ["メイン暦", "帝国暦"] }}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const controls = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as Array<HTMLInputElement | HTMLSelectElement>;
    expect(container.querySelector(".cm-frontmatter-chronicle select")).toBeNull();
    expect((controls[0] as HTMLInputElement).placeholder).toBe("開始年");
    expect((controls[1] as HTMLInputElement).placeholder).toBe("終了年（任意）");
    fireEvent.input(controls[1], { target: { value: "1333" } });

    expect(viewRef.current?.state.doc.toString()).toContain([
      "chronicle:",
      "  start: 1185",
      "  end: 1333"
    ].join("\n"));
  });

  it("chronicleプロパティは暦候補を表示しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const content = "---\nchronicle:\n  - [メイン暦, [[1185, null], [1185, null]]]\n---\n# 本文";
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={content}
          frontmatterCandidates={{ chronicle: ["メイン暦"] }}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-chronicle select")).toBeNull();
  });

  it("chronicleプロパティは逆順の期間を書き戻さない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle:\n  - [メイン暦, [[1185, null], [1185, null]]]\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle input.cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.input(inputs[1], { target: { value: "1000" } });

    expect(viewRef.current?.state.doc.toString()).toContain("[メイン暦, [[1185, null], [1185, null]]]");
    expect(inputs[0].getAttribute("aria-invalid")).toBe("true");
  });

  it("plannedDateプロパティは未登録なら固定日付範囲入力として扱わない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nplannedDate: [2026-05-12]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-row")).not.toBeNull());
    expect(container.querySelector(".cm-frontmatter-date-range")).toBeNull();
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.value).toBe("2026-05-12");
    expect(viewRef.current?.state.doc.toString()).toContain("plannedDate: [2026-05-12]");
  });

  it("プロパティ編集時にYAMLのコメント行とフィールド順をできるだけ保つ", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\n# 管理用メモ\nphase: draft # 執筆状態\n\n# 公開日\npublished: false\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        userDefinedFields={[{ name: "published", type: "boolean" }]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });

    expect(viewRef.current?.state.doc.toString()).toContain([
      "---",
      "# 管理用メモ",
      "phase: review # 執筆状態",
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

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-input")).not.toBeNull());
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New title" } });

    expect(viewRef.current?.state.doc.toString()).toContain("title: \"New title\" # 表示名");
  });

  it("複雑なYAML値をフォーム上のYAML入力で編集できる", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nphase: draft\nmeta:\n  source: web\n  rating: 5\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull());
    expect(container.textContent).toContain("meta");
    expect(container.querySelectorAll(".cm-frontmatter-row:not(.cm-frontmatter-add-row) .cm-frontmatter-input")).toHaveLength(1);

    const yamlInput = container.querySelector(".cm-frontmatter-yaml-input") as HTMLTextAreaElement;
    fireEvent.change(yamlInput, { target: { value: "source: web\nrating: 6" } });

    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web\n  rating: 6");

    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "review" } });

    expect(viewRef.current?.state.doc.toString()).toContain("phase: review");
    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web\n  rating: 6");
  });

  it("未登録の配列プロパティはテキスト型として編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nunknown: [first, second]\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    expect(container.querySelector(".cm-frontmatter-pill-add")).toBeNull();
    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    expect(input.value).toBe("first");
    expect(input.getAttribute("list")).toBeNull();

    fireEvent.change(input, { target: { value: "updated" } });

    expect(viewRef.current?.state.doc.toString()).toContain("unknown:\n  - updated");
  });

  it("未登録でも複雑なYAML値はYAML入力で安全に編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nmeta:\n  source: web\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);

    expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull();
    expect(container.querySelector(".cm-frontmatter-input")).toBeNull();
  });

  it("複雑なYAML値の入力が不正な場合は本文を更新しない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nmeta:\n  source: web\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull());
    const yamlInput = container.querySelector(".cm-frontmatter-yaml-input") as HTMLTextAreaElement;
    fireEvent.change(yamlInput, { target: { value: "source: [web" } });

    expect(yamlInput.getAttribute("aria-invalid")).toBe("true");
    expect(viewRef.current?.state.doc.toString()).toContain("meta:\n  source: web");
  });

  it("登録済みプロパティの入力タイプをフォームに反映する", async () => {
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

    await expandFrontmatter(container);
    const statusSelect = Array.from(container.querySelectorAll("select.cm-frontmatter-input"))
      .find((select) => (select as HTMLSelectElement).value === "draft") as HTMLSelectElement;
    const statusOptions = Array.from(statusSelect.querySelectorAll("option"))
      .map((option) => (option as HTMLOptionElement).value);
    expect(statusOptions).toEqual(["draft", "published", "review"]);
    fireEvent.change(statusSelect, { target: { value: "review" } });
    expect(viewRef.current?.state.doc.toString()).toContain("status:\n  - review");

    const dateInput = Array.from(container.querySelectorAll(".cm-frontmatter-input"))
      .find((input) => (input as HTMLInputElement).value === "2026-03-29") as HTMLInputElement;
    expect(dateInput.type).toBe("date");
    expect(dateInput.value).toBe("2026-03-29");
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });
    expect(viewRef.current?.state.doc.toString()).toContain("updated:\n  - '2026-04-01'");

    const checkbox = container.querySelector(".cm-frontmatter-checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(viewRef.current?.state.doc.toString()).toContain("published:\n  - true");
  });

  it("statusプロパティは未登録なら通常テキストとして編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstatus: [未着手]\n---\n# 本文"}
        frontmatterCandidates={{ status: ["draft"] }}
        onChange={vi.fn()}
        settings={settings}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    expect(container.querySelector(".cm-frontmatter-pill-add")).toBeNull();

    const input = container.querySelector(".cm-frontmatter-input") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("未着手");
    expect(input.getAttribute("list")).toBeNull();

    fireEvent.change(input, { target: { value: "完了" } });
    expect(viewRef.current?.state.doc.toString()).toContain("status:\n  - 完了");
  });

  it("日時・時刻・URL入力タイプと固定tagsをフォームに反映する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <Editor
        content={"---\nstarted: 2026-05-11T20:30\nhour: \"20:30\"\nsource: https://example.com\ntags: [資料]\nraw:\n  nested: true\n---\n# 本文"}
        onChange={vi.fn()}
        settings={settings}
        userDefinedFields={[
          { name: "started", type: "datetime" },
          { name: "hour", type: "time" },
          { name: "source", type: "url" }
        ]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);

    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-input")) as HTMLInputElement[];
    expect(inputs.some((input) => input.type === "datetime-local")).toBe(true);
    expect(inputs.some((input) => input.type === "time")).toBe(true);
    expect(inputs.some((input) => input.type === "url")).toBe(true);
    expect(container.querySelector(".cm-frontmatter-pill-add")).not.toBeNull();
    expect(container.querySelector(".cm-frontmatter-yaml-input")).not.toBeNull();
  });
});
