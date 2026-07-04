import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  type UserDefinedField
} from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { FrontmatterPanel } from "./FrontmatterPanel";
import { SettingsPanel } from "./SettingsPanel";

function renderFrontmatterPanel({
  userDefinedFields = [],
  onUserDefinedFieldsSave = vi.fn()
}: {
  userDefinedFields?: UserDefinedField[];
  onUserDefinedFieldsSave?: (fields: UserDefinedField[]) => void;
} = {}) {
  render(
    <I18nProvider language="en">
      <FrontmatterPanel
        onUserDefinedFieldsSave={onUserDefinedFieldsSave}
        userDefinedFields={userDefinedFields}
      />
    </I18nProvider>
  );
}

describe("FrontmatterPanel", () => {
  it("入力タイプを通常の名前で表示する", () => {
    renderFrontmatterPanel({
      userDefinedFields: [
        { name: "published", type: "boolean" },
        { name: "characters", type: "multi-select" }
      ]
    });

    expect(screen.getAllByText("Toggle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Multiple choices").length).toBeGreaterThan(0);
  });

  it("主要な入力タイプを選べる", () => {
    renderFrontmatterPanel();

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
    expect(screen.getByText("category: [note]")).toBeInTheDocument();
  });

  it("フィールドを追加できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterPanel({ onUserDefinedFieldsSave });

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "deadline" } });
    fireEvent.change(screen.getByLabelText("Input type"), { target: { value: "date" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([{ name: "deadline", type: "date" }]);
  });

  it("フィールド名は入力途中で保存せず、確定時に保存する", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterPanel({
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
    renderFrontmatterPanel({
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

  it("aliasesとtagsとchronicleを固定プロパティとして表示し、statusとplannedDateとactualDateはカスタムプロパティに追加できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterPanel({ onUserDefinedFieldsSave });

    expect(screen.getByText("Fixed properties")).not.toBeNull();
    expect(screen.getByText("Custom properties")).not.toBeNull();
    expect(screen.getByText("aliases")).not.toBeNull();
    expect(screen.getByText("tags")).not.toBeNull();
    expect(screen.queryByText("status")).toBeNull();
    expect(screen.getByRole("button", { name: "chronicle 1 field" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("chronicle")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "chronicle 1 field" }));
    expect(screen.getByRole("button", { name: "chronicle 1 field" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("plannedDate")).toBeNull();
    expect(screen.queryByText("actualDate")).toBeNull();
    expect(screen.getByText("At the very top of the Markdown file, make a settings block that starts with --- and ends with ---. Write each property inside that block on its own line.")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "CODE" && element.textContent === "---\nproperty: [value]\n---\nStart writing here")).toBeInTheDocument();
    expect(screen.getByText("Alternative names that can link to this file. Used for link resolution and file name search. Write one or many values as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital]")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital, Old Capital]")).toBeInTheDocument();
    expect(screen.getByText("Tags that classify this file. Used for tag lists, tag search, and tag filtering. Write one or many values as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("tags: [source]")).toBeInTheDocument();
    expect(screen.getByText("tags: [source, draft]")).toBeInTheDocument();
    expect(screen.getAllByText("Places this file on the timeline with one or more calendar ranges. Each range stores a calendar name and start/end year-month points.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chronicle: [[Main calendar, [[1185, null], [1185, null]]]]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chronicle: [[Main calendar, [[1185, 5], [1333, 8]]]]").length).toBeGreaterThan(0);
    expect(screen.queryByText("plannedDate: [2026-05-12]")).toBeNull();
    expect(screen.queryByText("actualDate: [2026-05-12]")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "aliases" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "tags" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "chronicle" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "chronicle0" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "date" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "plannedDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "actualDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "status" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("候補をチップとして追加・削除できる", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterPanel({
      onUserDefinedFieldsSave,
      userDefinedFields: [{ choices: ["draft"], name: "phase", type: "select" }]
    });

    fireEvent.change(screen.getByPlaceholderText("Enter a choice"), { target: { value: "review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add choice" }));

    expect(onUserDefinedFieldsSave).toHaveBeenCalledWith([
      { choices: ["draft", "review"], name: "phase", type: "select" }
    ]);

    fireEvent.click(screen.getByLabelText("Remove draft"));

    expect(onUserDefinedFieldsSave).toHaveBeenLastCalledWith([
      { choices: ["review"], name: "phase", type: "select" }
    ]);
  });

  it("テンプレート管理を表示しない", () => {
    renderFrontmatterPanel();

    expect(screen.queryByText("Frontmatter templates")).toBeNull();
    expect(screen.queryByPlaceholderText("Template name")).toBeNull();
  });
});

describe("SettingsPanel", () => {
  function renderSettingsPanel({
    featureToggles = defaultFeatureToggles,
    language = "en",
    onFeatureTogglesSave = vi.fn(),
    onSave = vi.fn(),
    platform = "darwin"
  }: {
    featureToggles?: typeof defaultFeatureToggles;
    language?: "en" | "ja";
    onFeatureTogglesSave?: (toggles: typeof defaultFeatureToggles) => void;
    onSave?: (settings: typeof defaultEditorSettings) => void;
    platform?: NodeJS.Platform;
  } = {}) {
    render(
      <I18nProvider language={language}>
        <SettingsPanel
          appInfo={{ name: "Relic", platform, version: "1.2.3" }}
          featureToggles={featureToggles}
          onFeatureTogglesSave={onFeatureTogglesSave}
          onSave={onSave}
          settings={defaultEditorSettings}
        />
      </I18nProvider>
    );
  }

  it("設定タブをセクション化して表示する", () => {
    renderSettingsPanel();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.getByText("Relic 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("macOS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repository" })).toHaveAttribute("href", "https://github.com/akihisa-dev/Relic");
    expect(screen.queryByText("darwin")).not.toBeInTheDocument();
  });

  it("アプリ情報では内部プラットフォーム名ではなくユーザー向けOS名を表示する", () => {
    renderSettingsPanel({ platform: "win32" });

    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.queryByText("win32")).not.toBeInTheDocument();
  });

  it("macOSではフォント選択肢をmacOSの元フォント名で表示する", () => {
    renderSettingsPanel({ platform: "darwin" });

    expect(screen.getByRole("button", { name: "System font" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hiragino Sans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hiragino Mincho ProN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menlo" })).toBeInTheDocument();
  });

  it("Windowsではフォント選択肢をWindowsの元フォント名で表示する", () => {
    renderSettingsPanel({ platform: "win32" });

    expect(screen.getByRole("button", { name: "System font" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yu Gothic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yu Mincho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consolas" })).toBeInTheDocument();
  });

  it("日本語UIではフォント選択肢をローカライズした元フォント名で表示する", () => {
    renderSettingsPanel({ language: "ja", platform: "win32" });

    expect(screen.getByRole("button", { name: "システムフォント" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "游ゴシック" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "游明朝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consolas" })).toBeInTheDocument();
  });

  it("設定変更時に既存のEditorSettings形式で保存する", () => {
    const onSave = vi.fn();
    renderSettingsPanel({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "Hiragino Sans" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ font: "gothic" }));

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));

    fireEvent.change(screen.getByDisplayValue("16"), { target: { value: "18" } });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 18 }));

    fireEvent.click(screen.getByRole("button", { name: "DD/MM/YYYY" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ frontmatterDateFormat: "dmy" }));
  });

  it("機能トグルを既存のFeatureToggles形式で保存する", () => {
    const onFeatureTogglesSave = vi.fn();
    renderSettingsPanel({
      featureToggles: { ...defaultFeatureToggles, chronicle: true, tools: true },
      onFeatureTogglesSave
    });

    fireEvent.click(screen.getByLabelText("File tools"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ tools: false }));

    fireEvent.click(screen.getByLabelText("Timeline"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ chronicle: false }));

    fireEvent.click(screen.getByLabelText("Right panel: Links"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ rightPanelLinks: false }));
  });
});
