import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { AppStatusBar } from "./AppStatusBar";

describe("AppStatusBar", () => {
  it("日本語ではJPを表示し、英語への切り替えを保存する", () => {
    const onLanguageChange = vi.fn();

    render(
      <I18nProvider language="ja">
        <AppStatusBar
          activeFileTab={null}
          language="ja"
          onLanguageChange={onLanguageChange}
        />
      </I18nProvider>
    );

    const languageSwitch = screen.getByRole("checkbox", { name: "英語に切り替える" });
    expect(languageSwitch).not.toBeChecked();
    expect(screen.getByText("JP")).toBeInTheDocument();

    fireEvent.click(languageSwitch);

    expect(onLanguageChange).toHaveBeenCalledWith("en");
  });

  it("英語ではENを表示し、日本語への切り替えを保存する", () => {
    const onLanguageChange = vi.fn();

    render(
      <I18nProvider language="en">
        <AppStatusBar
          activeFileTab={null}
          language="en"
          onLanguageChange={onLanguageChange}
        />
      </I18nProvider>
    );

    const languageSwitch = screen.getByRole("checkbox", { name: "Switch to Japanese" });
    expect(languageSwitch).toBeChecked();
    expect(screen.getByText("EN")).toBeInTheDocument();

    fireEvent.click(languageSwitch);

    expect(onLanguageChange).toHaveBeenCalledWith("ja");
  });
});
