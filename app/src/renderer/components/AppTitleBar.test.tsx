import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { AppTitleBar } from "./AppTitleBar";

function renderTitleBar({
  canNavigateBack = false,
  canNavigateForward = false,
  isDarkTheme = false
} = {}) {
  const onNavigateBack = vi.fn();
  const onNavigateForward = vi.fn();
  const onThemeChange = vi.fn();
  render(
    <I18nProvider language="ja">
      <AppTitleBar
        canNavigateBack={canNavigateBack}
        canNavigateForward={canNavigateForward}
        isDarkTheme={isDarkTheme}
        onNavigateBack={onNavigateBack}
        onNavigateForward={onNavigateForward}
        onThemeChange={onThemeChange}
      />
    </I18nProvider>
  );
  return { onNavigateBack, onNavigateForward, onThemeChange };
}

afterEach(() => {
  cleanup();
});

describe("AppTitleBar", () => {
  it("shows the light theme state beside the macOS window controls", () => {
    renderTitleBar();

    expect(document.querySelector(".title-bar")).toBeInTheDocument();
    expect(document.querySelector(".title-bar-drag-area")).toBeInTheDocument();
    expect(document.querySelector(".title-bar .pane-tab")).toBeNull();
    expect(document.querySelector(".title-bar .main-area-actions")).toBeNull();
    const toggle = screen.getByRole("checkbox", { name: "ダークテーマに切り替える" });
    expect(toggle).not.toBeChecked();
    expect(document.querySelector(".title-bar-theme-switch .track .thumb")).toBeInTheDocument();
    const historyControls = screen.getByRole("group", { name: "閲覧履歴" });
    expect(toggle.closest("label")?.nextElementSibling).toBe(historyControls);
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "進む" })).toBeDisabled();
  });

  it("switches from the current theme to the other fixed theme", () => {
    const { onThemeChange } = renderTitleBar({ isDarkTheme: true });

    const toggle = screen.getByRole("checkbox", { name: "ライトテーマに切り替える" });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(onThemeChange).toHaveBeenCalledWith("light");
  });

  it("moves backward and forward when the corresponding history exists", () => {
    const { onNavigateBack, onNavigateForward } = renderTitleBar({
      canNavigateBack: true,
      canNavigateForward: true
    });

    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    fireEvent.click(screen.getByRole("button", { name: "進む" }));

    expect(onNavigateBack).toHaveBeenCalledTimes(1);
    expect(onNavigateForward).toHaveBeenCalledTimes(1);
  });

  it("can host header actions without making them part of the drag area", () => {
    render(
      <I18nProvider language="ja">
        <AppTitleBar
          canNavigateBack={false}
          canNavigateForward={false}
          isDarkTheme={false}
          onNavigateBack={vi.fn()}
          onNavigateForward={vi.fn()}
          onThemeChange={vi.fn()}
        >
          <div className="main-area-actions">
            <button type="button">Action</button>
          </div>
        </AppTitleBar>
      </I18nProvider>
    );

    expect(document.querySelector(".title-bar .main-area-actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("keeps the title bar draggable and visually separate from the workspace", () => {
    const css = readFileSync("src/renderer/styles/shell-layout.css", "utf8");
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(css).toMatch(/\.title-bar\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*grid-template-rows:\s*42px minmax\(0, 1fr\) 34px;/s);
    expect(designCss).toMatch(/\.app-shell\s*\{[^}]*grid-template-rows:\s*42px minmax\(0, 1fr\) 32px;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
    expect(css).toMatch(/\.title-bar-drag-area\s*\{[^}]*grid-column:\s*1;/s);
    expect(css).toMatch(/\.title-bar-navigation--after-theme\s*\{[^}]*left:\s*150px;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*z-index:\s*40;/s);
    expect(designCss).toMatch(/--chrome-top-bg:\s*var\(--title-bar-bg\);/);
    expect(designCss).toMatch(/\.title-bar\s*\{[^}]*box-shadow:\s*inset 0 -1px 0 var\(--chrome-top-border, var\(--border\)\);/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*background:\s*var\(--chrome-top-bg, var\(--title-bar-bg\)\);/s);
  });

  it("keeps pane tab sizing controlled by shared tab tokens", () => {
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(editorCss).toMatch(/--pane-tab-lane-height:\s*42px;/);
    expect(editorCss).toMatch(/--pane-tab-width:\s*220px;/);
    expect(editorCss).toMatch(/--pane-tab-split-width:\s*180px;/);
    expect(editorCss).toMatch(/--pane-tab-min-width:\s*64px;/);
    expect(editorCss).toMatch(/--pane-tab-split-min-width:\s*48px;/);
    expect(editorCss).toMatch(/--pane-tab-drop-indicator-width:\s*3px;/);
    expect(editorCss).toMatch(/\.pane-tab-bar-shell\s*\{[^}]*align-items:\s*flex-start;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*flex:\s*1 1 var\(--pane-tab-width\);/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*max-width:\s*var\(--pane-tab-width\);/s);
    expect(editorCss).toMatch(/\.pane-tab--closing\s*\{[^}]*flex-basis:\s*0;[^}]*flex-grow:\s*0;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar--drop-end::after\s*\{[^}]*position:\s*static;/s);
  });

  it("manages split pane tab lanes with pane-local boundaries", () => {
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--left\.pane-tabs--has-tabs\s*\{[^}]*inset -1px 0 0 var\(--chrome-top-border, var\(--border\)\)/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--right\.pane-tabs--has-tabs\s*\{[^}]*inset -1px 0 0 var\(--chrome-top-border, var\(--border\)\)/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tab-bar-shell\s*\{[^}]*padding-inline:\s*var\(--pane-tab-inline-padding\);/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tab\s*\{[^}]*flex:\s*1 1 var\(--pane-tab-split-width\);[^}]*max-width:\s*var\(--pane-tab-split-width\);[^}]*min-width:\s*var\(--pane-tab-split-min-width\);/s);
  });

  it("does not render diagonal blue panel decorations", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(designCss).not.toMatch(/clip-path:\s*polygon/);
    expect(designCss).not.toMatch(/\.workspace::before/);
    expect(designCss).not.toMatch(/\.workspace::after/);
    expect(designCss).not.toMatch(/\.sidebar::after/);
    expect(designCss).not.toMatch(/\.right-panel::before/);
  });

  it("keeps the right panel header compact", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(designCss).toMatch(/\.right-panel-title\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*12px 18px 9px;/s);
    expect(designCss).toMatch(/\.right-panel-content\s*\{[^}]*padding-top:\s*14px;/s);
  });
});
