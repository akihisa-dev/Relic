import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles
} from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { FrontmatterPanel } from "./FrontmatterPanel";
import { SettingsPanel } from "./SettingsPanel";

function renderFrontmatterPanel({
  categoryChoices = [],
  onCategoryChoicesSave = vi.fn()
}: {
  categoryChoices?: string[];
  onCategoryChoicesSave?: (choices: string[]) => void;
} = {}) {
  render(
    <I18nProvider language="en">
      <FrontmatterPanel
        categoryChoices={categoryChoices}
        onCategoryChoicesSave={onCategoryChoicesSave}
      />
    </I18nProvider>
  );
}

describe("FrontmatterPanel", () => {
  it("固定プロパティとcategory候補を先に表示する", () => {
    renderFrontmatterPanel({
      categoryChoices: ["War", "Politics"]
    });

    expect(screen.getByText("Review fixed properties and manage category choices.")).toBeInTheDocument();
    expect(screen.getByLabelText("Frontmatter settings counts")).toBeInTheDocument();
    expect(screen.getByText("Review fixed properties")).toBeInTheDocument();
    expect(screen.getByText("Manage category choices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "aliases Fixed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tags Fixed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "category Fixed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "chronicle Fixed" })).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("固定プロパティは名前を常時表示し、説明と書き方だけを展開する", () => {
    renderFrontmatterPanel();

    expect(screen.getByRole("button", { name: "aliases Fixed" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "tags Fixed" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "category Fixed" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "chronicle Fixed" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Alternative names that can link to this file. Used for link resolution and file name search. Write one or many values as the same one-line array.")).toBeNull();
    expect(screen.queryByText("aliases: [Capital]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "aliases Fixed" }));

    expect(screen.getByRole("button", { name: "aliases Fixed" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Alternative names that can link to this file. Used for link resolution and file name search. Write one or many values as the same one-line array.")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital]")).toBeInTheDocument();
    expect(screen.getByText("aliases: [Capital, Old Capital]")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "chronicle Fixed" }));

    expect(screen.getByRole("button", { name: "chronicle Fixed" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Alternative names that can link to this file. Used for link resolution and file name search. Write one or many values as the same one-line array.")).toBeNull();
    expect(screen.getByText("Places this file on the timeline with one or more calendar ranges. Each range stores a calendar name and start/end year-month points.")).toBeInTheDocument();
    expect(screen.getByText("chronicle: [[Main calendar, [[1185, null], [1185, null]]]]")).toBeInTheDocument();
    expect(screen.getByText("chronicle: [[Main calendar, [[1185, 5], [1333, 8]]]]")).toBeInTheDocument();
  });

  it("YAML書式ガイドは補助情報として必要な時だけ開く", () => {
    renderFrontmatterPanel();

    expect(screen.queryByText("At the very top of the Markdown file, make a settings block that starts with --- and ends with ---. Write each property inside that block on its own line.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "YAML writing guide Reference" }));

    expect(screen.getByText("At the very top of the Markdown file, make a settings block that starts with --- and ends with ---. Write each property inside that block on its own line.")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "CODE" && element.textContent === "---\nproperty: [value]\n---\nStart writing here")).toBeInTheDocument();
  });

  it("カスタムプロパティ管理を表示しない", () => {
    renderFrontmatterPanel();

    expect(screen.queryByText("Add custom properties")).toBeNull();
    expect(screen.queryByPlaceholderText("Field name")).toBeNull();
    expect(screen.queryByLabelText("Input type")).toBeNull();
    expect(screen.queryByText("No custom fields yet.")).toBeNull();
  });

  it("category候補を追加・削除できる", () => {
    const onCategoryChoicesSave = vi.fn();

    renderFrontmatterPanel({
      categoryChoices: ["War"],
      onCategoryChoicesSave
    });

    expect(screen.getAllByText("category choices").length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByPlaceholderText("Enter a choice")[0], { target: { value: "Politics" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add choice" })[0]);

    expect(onCategoryChoicesSave).toHaveBeenCalledWith(["War", "Politics"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove War" }));
    expect(onCategoryChoicesSave).toHaveBeenCalledWith([]);
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
    expect(screen.getByRole("link", { name: "GitHub: https://github.com/akihisa-dev/Relic" })).toHaveAttribute("href", "https://github.com/akihisa-dev/Relic");
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
