import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel", () => {
  function renderSettingsPanel({
    language = "en",
    onSave = vi.fn()
  }: {
    language?: "en" | "ja";
    onSave?: (settings: typeof defaultEditorSettings) => void;
  } = {}) {
    render(
      <I18nProvider language={language}>
        <SettingsPanel
          appInfo={{ name: "Relic", version: "1.2.3" }}
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
    expect(screen.queryByText("Features")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Bubble" })).not.toBeInTheDocument();
    expect(screen.getByText("App Info")).toBeInTheDocument();
    expect(screen.getByText("Relic 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("macOS")).toBeInTheDocument();
    const repositoryLink = screen.getByRole("link", { name: "GitHub: https://github.com/akihisa-dev/Relic" });
    expect(repositoryLink).toHaveAttribute("href", "https://github.com/akihisa-dev/Relic");
    expect(repositoryLink.querySelector("svg.settings-repository-icon[aria-hidden='true']")).not.toBeNull();
    expect(screen.queryByText("darwin")).not.toBeInTheDocument();
  });

  it("英語のmacOSでは英語向けフォントを表示する", () => {
    renderSettingsPanel();

    expect(screen.getByRole("button", { name: "System font" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menlo" })).toBeInTheDocument();
  });

  it("日本語UIではフォント選択肢をローカライズした元フォント名で表示する", () => {
    renderSettingsPanel({ language: "ja" });

    expect(screen.getByRole("button", { name: "システムフォント" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ヒラギノ角ゴシック" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ヒラギノ明朝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menlo" })).toBeInTheDocument();
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

});
