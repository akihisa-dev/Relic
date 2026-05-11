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
  });

  it("フィールドを追加できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({ onUserDefinedFieldsSave });

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "deadline" } });
    fireEvent.change(screen.getByLabelText("Input type"), { target: { value: "date" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "deadline", type: "date" }]);
  });

  it("aliasesとtagsとchronicleを固定プロパティとして表示し、カスタムプロパティには追加しない", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({ onUserDefinedFieldsSave });

    expect(screen.getByText("Fixed properties")).not.toBeNull();
    expect(screen.getByText("Custom properties")).not.toBeNull();
    expect(screen.getByText("aliases")).not.toBeNull();
    expect(screen.getByText("tags")).not.toBeNull();
    expect(screen.getByText("chronicle")).not.toBeNull();
    expect(screen.getByText("Alternative names that can link to this file. Used for link resolution and file name search.")).toBeInTheDocument();
    expect(screen.getByText("Tags that classify this file. Used for tag lists, tag search, and tag filtering.")).toBeInTheDocument();
    expect(screen.getByText("Places this file on the timeline as a single year or range. Use chronicle: [1185] or chronicle: [1185, 1333].")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "aliases" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "tags" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "chronicle" } });

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
