import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  type AIProvider,
  type OpenAIWorkspaceModel,
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
    expect(screen.getByText("status: [note]")).toBeInTheDocument();
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

  it("aliasesとtagsとstatusとchronicle0〜9と計画/実行dateを固定プロパティとして表示し、カスタムプロパティには追加しない", () => {
    const onUserDefinedFieldsSave = vi.fn();

    renderFrontmatterPanel({ onUserDefinedFieldsSave });

    expect(screen.getByText("Fixed properties")).not.toBeNull();
    expect(screen.getByText("Custom properties")).not.toBeNull();
    expect(screen.getByText("aliases")).not.toBeNull();
    expect(screen.getByText("tags")).not.toBeNull();
    expect(screen.getByText("status")).not.toBeNull();
    expect(screen.getByRole("button", { name: "chronicle0-chronicle9 10 fields" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("chronicle0")).toBeNull();
    expect(screen.queryByText("chronicle9")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "chronicle0-chronicle9 10 fields" }));
    expect(screen.getByRole("button", { name: "chronicle0-chronicle9 10 fields" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("chronicle0")).not.toBeNull();
    expect(screen.getByText("chronicle9")).not.toBeNull();
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
    expect(screen.getByText("The status of this file for date chart workflows. Choose exactly one fixed option and write it as a one-item inline array.")).toBeInTheDocument();
    expect(screen.getByText("status: [未着手]")).toBeInTheDocument();
    expect(screen.queryByText("status: [進行中, 完了]")).toBeNull();
    expect(screen.getAllByText("Places this file on the timeline as a single year or range. Write a single year or range as the same one-line array.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chronicle0: [1185]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("chronicle0: [1185, 1333]").length).toBeGreaterThan(0);
    expect(screen.getByText("The planned date or date range for this file. Write dates without times as the same one-line array for a single day or range.")).toBeInTheDocument();
    expect(screen.getByText("plannedDate: [2026-05-12]")).toBeInTheDocument();
    expect(screen.getByText("plannedDate: [2026-05-12, 2026-05-20]")).toBeInTheDocument();
    expect(screen.getByText("The actual date or date range for this file. Write dates without times as the same one-line array for a single day or range.")).toBeInTheDocument();
    expect(screen.getByText("actualDate: [2026-05-12]")).toBeInTheDocument();
    expect(screen.getByText("actualDate: [2026-05-12, 2026-05-20]")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "aliases" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "tags" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "chronicle0" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "date" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "plannedDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "actualDate" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Field name"), { target: { value: "status" } });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
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
    onDeleteOpenAIAPIKey = vi.fn(),
    onFeatureTogglesSave = vi.fn(),
    onSaveAIModel = vi.fn(),
    onSaveAIProvider = vi.fn(),
    onSaveOpenAIAPIKey = vi.fn(),
    onSave = vi.fn(),
    onTestOpenAIAPIKey = vi.fn(),
    platform = "darwin",
    aiProvider = "codex-app-server"
  }: {
    aiProvider?: AIProvider;
    featureToggles?: typeof defaultFeatureToggles;
    language?: "en" | "ja";
    onDeleteOpenAIAPIKey?: () => void;
    onFeatureTogglesSave?: (toggles: typeof defaultFeatureToggles) => void;
    onSaveAIModel?: (model: OpenAIWorkspaceModel) => void;
    onSaveAIProvider?: (provider: AIProvider) => void;
    onSaveOpenAIAPIKey?: (apiKey: string) => void;
    onSave?: (settings: typeof defaultEditorSettings) => void;
    onTestOpenAIAPIKey?: () => void;
    platform?: NodeJS.Platform;
  } = {}) {
    render(
      <I18nProvider language={language}>
        <SettingsPanel
          appInfo={{ name: "Relic", platform, version: "1.2.3" }}
          aiSettings={{ aiProvider, model: "gpt-5.4-mini", openAIAPIKeyConfigured: false, secureStorageAvailable: true }}
          aiSettingsStatus={null}
          featureToggles={featureToggles}
          onDeleteOpenAIAPIKey={onDeleteOpenAIAPIKey}
          onFeatureTogglesSave={onFeatureTogglesSave}
          onSaveAIModel={onSaveAIModel}
          onSaveAIProvider={onSaveAIProvider}
          onSaveOpenAIAPIKey={onSaveOpenAIAPIKey}
          onSave={onSave}
          onTestOpenAIAPIKey={onTestOpenAIAPIKey}
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
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.getByText("Relic 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("macOS")).toBeInTheDocument();
    expect(screen.queryByText("darwin")).not.toBeInTheDocument();
  });

  it("OpenAI APIキーを設定から保存できる", () => {
    const onSaveOpenAIAPIKey = vi.fn();
    renderSettingsPanel({ aiProvider: "openai-api", onSaveOpenAIAPIKey });

    fireEvent.change(screen.getByPlaceholderText("sk-..."), { target: { value: "sk-test-key-12345678901234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveOpenAIAPIKey).toHaveBeenCalledWith("sk-test-key-12345678901234567890");
  });

  it("OpenAIモデルを実モデル名で選べる", () => {
    const onSaveAIModel = vi.fn();
    renderSettingsPanel({ aiProvider: "openai-api", onSaveAIModel });

    const modelSelect = screen.getByLabelText("OpenAI model");
    expect(modelSelect).toHaveDisplayValue("gpt-5.4-mini");
    expect(screen.getByRole("option", { name: "gpt-5.5" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gpt-5.4" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gpt-5.4-mini" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gpt-5.4-nano" })).toBeInTheDocument();

    fireEvent.change(modelSelect, { target: { value: "gpt-5.5" } });

    expect(onSaveAIModel).toHaveBeenCalledWith("gpt-5.5");
  });

  it("OpenAI APIキー画面へのリンクを表示する", () => {
    renderSettingsPanel({ aiProvider: "openai-api" });

    expect(screen.getByRole("link", { name: "Open OpenAI API key page" })).toHaveAttribute(
      "href",
      "https://platform.openai.com/api-keys"
    );
  });

  it("AI接続方式を選べる", () => {
    const onSaveAIProvider = vi.fn();
    renderSettingsPanel({ onSaveAIProvider });

    fireEvent.click(screen.getByRole("button", { name: "OpenAI API" }));

    expect(onSaveAIProvider).toHaveBeenCalledWith("openai-api");
  });

  it("Codex App Server方式ではOpenAI APIキー欄を隠す", () => {
    renderSettingsPanel({ aiProvider: "codex-app-server" });

    expect(screen.getByText("Use the Codex app for AI coworking. No OpenAI API key is required.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("sk-...")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open OpenAI API key page" })).not.toBeInTheDocument();
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
      featureToggles: { ...defaultFeatureToggles, ai: true, chronicle: true, tools: true },
      onFeatureTogglesSave
    });

    fireEvent.click(screen.getByLabelText("File tools"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ tools: false }));

    fireEvent.click(screen.getByLabelText("Cowork"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ ai: false }));

    fireEvent.click(screen.getByLabelText("Timeline"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ chronicle: false }));

    fireEvent.click(screen.getByLabelText("Right panel: Links"));

    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ rightPanelLinks: false }));
  });
});
