import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  type FrontmatterTemplate,
  type UserDefinedField
} from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { FrontmatterSidebar } from "./FrontmatterSidebar";

function renderSettings({
  frontmatterTemplates = [],
  userDefinedFields = [],
  onFrontmatterTemplatesSave = vi.fn(),
  onUserDefinedFieldsSave = vi.fn()
}: {
  frontmatterTemplates?: FrontmatterTemplate[];
  userDefinedFields?: UserDefinedField[];
  onFrontmatterTemplatesSave?: (templates: FrontmatterTemplate[]) => void;
  onUserDefinedFieldsSave?: (fields: UserDefinedField[]) => void;
}) {
  render(
    <I18nProvider language="en">
      <FrontmatterSidebar
        frontmatterTemplates={frontmatterTemplates}
        onFrontmatterTemplatesSave={onFrontmatterTemplatesSave}
        onUserDefinedFieldsSave={onUserDefinedFieldsSave}
        userDefinedFields={userDefinedFields}
      />
    </I18nProvider>
  );
}

describe("FrontmatterSidebar", () => {
  it("既存フロントマターテンプレートのフィールド構成を編集できる", () => {
    const onFrontmatterTemplatesSave = vi.fn();

    renderSettings({
      frontmatterTemplates: [{ fieldNames: ["status"], name: "Draft" }],
      onFrontmatterTemplatesSave,
      userDefinedFields: [
        { name: "status", type: "select" },
        { name: "date", type: "date" }
      ]
    });

    fireEvent.click(screen.getAllByLabelText("date")[0]);

    expect(onFrontmatterTemplatesSave).toHaveBeenCalledWith([
      { fieldNames: ["status", "date"], name: "Draft" }
    ]);
  });

  it("フィールド名変更をテンプレートにも反映する", () => {
    const onFrontmatterTemplatesSave = vi.fn();
    const onUserDefinedFieldsSave = vi.fn();

    renderSettings({
      frontmatterTemplates: [{ fieldNames: ["締切"], name: "原稿" }],
      onFrontmatterTemplatesSave,
      onUserDefinedFieldsSave,
      userDefinedFields: [{ name: "締切", type: "date" }]
    });

    fireEvent.change(screen.getByDisplayValue("締切"), { target: { value: "期限" } });

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "期限", type: "date" }]);
    expect(onFrontmatterTemplatesSave).toHaveBeenCalledWith([{ fieldNames: ["期限"], name: "原稿" }]);
  });

  it("フィールド削除時に空になるテンプレートを残さない", () => {
    const onFrontmatterTemplatesSave = vi.fn();
    const onUserDefinedFieldsSave = vi.fn();

    renderSettings({
      frontmatterTemplates: [{ fieldNames: ["締切"], name: "原稿" }],
      onFrontmatterTemplatesSave,
      onUserDefinedFieldsSave,
      userDefinedFields: [{ name: "締切", type: "date" }]
    });

    fireEvent.click(screen.getAllByTitle("Delete")[0]);

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([]);
    expect(onFrontmatterTemplatesSave).toHaveBeenCalledWith([]);
  });
});
