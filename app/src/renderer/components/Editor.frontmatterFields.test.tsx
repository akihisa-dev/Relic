import { EditorView } from "@codemirror/view";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { Editor } from "./Editor";
import { expandFrontmatter, settings } from "./editorTestHelpers";

describe("Editor frontmatter fields", () => {
  it("chronicle0プロパティは1行配列として編集する", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle0:\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    expect(inputs[0].placeholder).toBe("開始");
    expect(inputs[1].placeholder).toBe("終了");
    fireEvent.change(inputs[0], { target: { value: "1185" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle0: [1185]");

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const nextInputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(nextInputs[1], { target: { value: "1333" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle0: [1185, 1333]");
  });

  it("chronicle0プロパティは不正な年や逆順の期間を書き戻さない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle0: [1185]\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(inputs[1], { target: { value: "1000" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle0: [1185]");
    expect(viewRef.current?.state.doc.toString()).not.toContain("chronicle0: [1000, 1185]");
    expect(container.querySelector(".cm-frontmatter-input-error")?.textContent).toBe("開始年は終了年以下にしてください。");
    expect(inputs[0].getAttribute("aria-invalid")).toBe("true");
  });

  it("サブ暦のchronicleプロパティは0以下の整数も書き戻す", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle1:\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "-2" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle1: [-2]");

    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const nextInputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(nextInputs[1], { target: { value: "0" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle1: [-2, 0]");
  });

  it("サブ暦のchronicleプロパティは小数を書き戻さない", async () => {
    const viewRef = createRef<EditorView | null>();
    const { container } = render(
      <I18nProvider language="ja">
        <Editor
          content={"---\nchronicle1: [-2]\n---\n# 本文"}
          onChange={vi.fn()}
          settings={settings}
          viewRef={viewRef}
        />
      </I18nProvider>
    );

    await expandFrontmatter(container);
    await waitFor(() => expect(container.querySelector(".cm-frontmatter-chronicle")).not.toBeNull());
    const inputs = Array.from(container.querySelectorAll(".cm-frontmatter-chronicle .cm-frontmatter-input")) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "1.5" } });

    expect(viewRef.current?.state.doc.toString()).toContain("chronicle1: [-2]");
    expect(container.querySelector(".cm-frontmatter-input-error")?.textContent).toBe("年は整数で入力してください。");
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

    expect(viewRef.current?.state.doc.toString()).toContain("unknown: [\"updated\"]");
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
        content={"---\ncategory: draft\nupdated: 2026-03-29\npublished: false\n---\n# 本文"}
        frontmatterCandidates={{ category: ["review"] }}
        onChange={onChange}
        settings={settings}
        userDefinedFields={[
          { choices: ["draft", "published"], name: "category", type: "select" },
          { name: "updated", type: "date" },
          { name: "published", type: "boolean" }
        ]}
        viewRef={viewRef}
      />
    );

    await expandFrontmatter(container);
    const categorySelect = Array.from(container.querySelectorAll("select.cm-frontmatter-input"))
      .find((select) => (select as HTMLSelectElement).value === "draft") as HTMLSelectElement;
    const statusOptions = Array.from(categorySelect.querySelectorAll("option"))
      .map((option) => (option as HTMLOptionElement).value);
    expect(statusOptions).toEqual(["draft", "published", "review"]);
    fireEvent.change(categorySelect, { target: { value: "review" } });
    expect(viewRef.current?.state.doc.toString()).toContain("category: [\"review\"]");

    const dateInput = Array.from(container.querySelectorAll(".cm-frontmatter-input"))
      .find((input) => (input as HTMLInputElement).value === "2026-03-29") as HTMLInputElement;
    expect(dateInput.type).toBe("date");
    expect(dateInput.value).toBe("2026-03-29");
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });
    expect(viewRef.current?.state.doc.toString()).toContain("updated: [\"2026-04-01\"]");

    const checkbox = container.querySelector(".cm-frontmatter-checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(viewRef.current?.state.doc.toString()).toContain("published: [true]");
  });

  it("statusプロパティは固定候補を単一選択の入力補助に使う", async () => {
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

    const input = container.querySelector("select.cm-frontmatter-input") as HTMLSelectElement;
    expect(input.value).toBe("未着手");
    const candidates = Array.from(input.querySelectorAll("option"))
      .map((option) => (option as HTMLOptionElement).value);
    expect(candidates).toEqual(["未着手", "進行中", "完了", "中断", "中止"]);

    fireEvent.change(input, { target: { value: "完了" } });
    expect(viewRef.current?.state.doc.toString()).toContain("status: [\"完了\"]");
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
