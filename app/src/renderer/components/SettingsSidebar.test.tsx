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
      "Long text",
      "Number",
      "Date",
      "Date and time",
      "Time",
      "Toggle",
      "Single choice",
      "Multiple choices",
      "Tags",
      "URL",
      "Email",
      "List",
      "YAML"
    ]);
  });

  it("フィールドを追加できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterSidebar({ onUserDefinedFieldsSave });

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "deadline" } });
    fireEvent.change(screen.getByLabelText("Input type"), { target: { value: "date" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "deadline", type: "date" }]);
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
