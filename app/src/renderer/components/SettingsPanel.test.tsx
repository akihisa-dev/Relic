import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles
} from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { SettingsPanel } from "./SettingsPanel";

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
    expect(screen.queryByText("Appearance")).not.toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    expect(screen.queryByText("Theme")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Graph" })).toBeInTheDocument();
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

  it("英語のmacOSでは英語向けフォントを表示する", () => {
    renderSettingsPanel({ platform: "darwin" });

    expect(screen.getByRole("button", { name: "System font" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menlo" })).toBeInTheDocument();
  });

  it("英語のWindowsでは英語向けフォントを表示する", () => {
    renderSettingsPanel({ platform: "win32" });

    expect(screen.getByRole("button", { name: "System font" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Georgia" })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Arial" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ font: "gothic" }));

    fireEvent.change(screen.getByDisplayValue("16"), { target: { value: "18" } });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 18 }));

    fireEvent.click(screen.getByRole("switch", { name: "Show line numbers" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ showLineNumbers: true }));

    fireEvent.click(screen.getByRole("switch", { name: "Spell check" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ spellCheck: false }));

    fireEvent.click(screen.getByRole("button", { name: "DD/MM/YYYY" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ frontmatterDateFormat: "dmy" }));
  });

  it("機能トグルを既存のFeatureToggles形式で保存する", () => {
    const onFeatureTogglesSave = vi.fn();
    renderSettingsPanel({
      featureToggles: { ...defaultFeatureToggles, chronicle: true, tools: true },
      onFeatureTogglesSave
    });

    expect(screen.queryByRole("switch", { name: "File tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Right panel: Links" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Graph"));
    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ graph: true, tools: true }));

    fireEvent.click(screen.getByLabelText("Cards"));
    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({ cards: true }));
  });

  it("役割のないフロントマタートグルを表示せずテーブルを切り替える", () => {
    const onFeatureTogglesSave = vi.fn();
    renderSettingsPanel({
      featureToggles: { ...defaultFeatureToggles, table: true },
      onFeatureTogglesSave
    });

    expect(screen.queryByRole("switch", { name: "Frontmatter" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Table" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("switch", { name: "Table" }));
    expect(onFeatureTogglesSave).toHaveBeenCalledWith(expect.objectContaining({
      frontmatter: false,
      table: false
    }));
  });
});
