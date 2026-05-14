import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type UserDefinedField } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { FrontmatterSidebar } from "./FrontmatterSidebar";

function renderFrontmatterSidebar({
  userDefinedFields = [],
  onUserDefinedFieldsSave = vi.fn()
}: {
  userDefinedFields?: UserDefinedField[];
  onUserDefinedFieldsSave?: (fields: UserDefinedField[]) => void;
} = {}) {
  render(
    <I18nProvider language="en">
      <FrontmatterSidebar
        onUserDefinedFieldsSave={onUserDefinedFieldsSave}
        userDefinedFields={userDefinedFields}
      />
    </I18nProvider>
  );
}

describe("FrontmatterSidebar", () => {
  it("入力タイプを通常の名前で表示する", () => {
    renderFrontmatterSidebar({
      userDefinedFields: [
        { name: "published", type: "boolean" },
        { name: "characters", type: "multi-select" }
      ]
    });

    expect(screen.getAllByText("Toggle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Multiple choices").length).toBeGreaterThan(0);
  });

  it("主要な入力タイプを選べる", () => {
    renderFrontmatterSidebar();

    expect(Array.from(screen.getByLabelText("Input type").querySelectorAll("option")).map((option) => option.textContent)).toEqual([
      "Text",
      "Number",
      "Date",
      "Date and time",
      "Time",
      "Toggle",
      "Single choice",
      "Multiple choices",
      "URL"
    ]);
    expect(screen.getByText("For short free-form values, such as notes, names, or labels.")).toBeInTheDocument();
    expect(screen.getByText("status: [note]")).toBeInTheDocument();
  });

  it("フィールドを追加できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({ onUserDefinedFieldsSave });

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "deadline" } });
    fireEvent.change(screen.getByLabelText("Input type"), { target: { value: "date" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "deadline", type: "date" }]);
  });

  it("フィールド名は入力途中で保存せず、確定時に保存する", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({
      onUserDefinedFieldsSave,
      userDefinedFields: [{ name: "status", type: "text" }]
    });

    const nameInput = screen.getByDisplayValue("status") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    expect(nameInput.value).toBe("");
    expect(onUserDefinedFieldsSave).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: "公開状態" } });
    expect(nameInput.value).toBe("公開状態");
    expect(onUserDefinedFieldsSave).not.toHaveBeenCalled();

    fireEvent.blur(nameInput);
    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "公開状態", type: "text" }]);
  });

  it("カスタムプロパティの入力タイプごとに書き方を表示する", () => {
    renderFrontmatterSidebar({
      userDefinedFields: [
        { name: "characters", type: "multi-select", choices: ["Alice", "Bob"] },
        { name: "published", type: "boolean" }
      ]
    });

    expect(screen.getByText("characters: [Alice, Bob]")).toBeInTheDocument();
    expect(screen.getByText("published: [true]")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "source" } });
    fireEvent.change(screen.getAllByLabelText("Input type")[0], { target: { value: "url" } });

    expect(screen.getByText("source: [https://example.com]")).toBeInTheDocument();
  });

  it("aliasesとtagsとchronicleと計画/実行dateを固定プロパティとして表示し、カスタムプロパティには追加しない", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({ onUserDefinedFieldsSave });

    expect(screen.getByText("Fixed properties")).not.toBeNull();
    expect(screen.getByText("Custom properties")).not.toBeNull();
    expect(screen.getByText("aliases")).not.toBeNull();
    expect(screen.getByText("tags")).not.toBeNull();
    expect(screen.getByText("chronicle")).not.toBeNull();
    expect(screen.getByText("plannedDate")).not.toBeNull();
    expect(screen.getByText("actualDate")).not.toBeNull();
    expect(screen.getByText("At the very top of the Markdown file, make a settings block that starts with --- and ends with ---. Write each property inside that block on its own line.")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "CODE" && element.textContent === "---\nproperty: [value]\n---\nStart writing here")).toBeInTheDocument();
    expect(screen.getByText("Alternative names that can link to this file. Used for link resolution and file name search. Write one or many values as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital]")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital, Old Capital]")).toBeInTheDocument();
    expect(screen.getByText("Tags that classify this file. Used for tag lists, tag search, and tag filtering. Write one or many values as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("tags: [source]")).toBeInTheDocument();
    expect(screen.getByText("tags: [source, draft]")).toBeInTheDocument();
    expect(screen.getByText("Places this file on the timeline as a single year or range. Write a single year or range as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("chronicle: [1185]")).toBeInTheDocument();
    expect(screen.getByText("chronicle: [1185, 1333]")).toBeInTheDocument();
    expect(screen.getByText("The planned date or date range for this file. Write dates without times as the same one-line array for a single day or range. Legacy date is read as planned.")).toBeInTheDocument();
    expect(screen.getByText("plannedDate: [2026-05-12]")).toBeInTheDocument();
    expect(screen.getByText("plannedDate: [2026-05-12, 2026-05-20]")).toBeInTheDocument();
    expect(screen.getByText("The actual date or date range for this file. Write dates without times as the same one-line array for a single day or range.")).toBeInTheDocument();
    expect(screen.getByText("actualDate: [2026-05-12]")).toBeInTheDocument();
    expect(screen.getByText("actualDate: [2026-05-12, 2026-05-20]")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "aliases" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "tags" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "chronicle" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "date" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "plannedDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "actualDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("候補をチップとして追加・削除できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({
      onUserDefinedFieldsSave,
      userDefinedFields: [{ choices: ["draft"], name: "status", type: "select" }]
    });

    fireEvent.change(screen.getByPlaceholderText("Enter a choice"), { target: { value: "review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add choice" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([
      { choices: ["draft", "review"], name: "status", type: "select" }
    ]);

    fireEvent.click(screen.getByLabelText("Remove draft"));

    expect(onUserDefinedFieldsSave).toHaveBeenLastCalledWith([
      { choices: ["review"], name: "status", type: "select" }
    ]);
  });

  it("テンプレート管理を表示しない", () => {
    renderFrontmatterSidebar();

    expect(screen.queryByText("Frontmatter templates")).toBeNull();
    expect(screen.queryByPlaceholderText("Template name")).toBeNull();
  });
});
