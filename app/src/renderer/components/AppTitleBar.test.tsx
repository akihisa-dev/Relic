import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppTitleBar } from "./AppTitleBar";

function renderTitleBar(): void {
  render(<AppTitleBar />);
}

afterEach(() => {
  cleanup();
});

describe("AppTitleBar", () => {
  it("keeps the title bar as an OS-style drag region without app controls", () => {
    renderTitleBar();

    expect(document.querySelector(".title-bar")).toBeInTheDocument();
    expect(document.querySelector(".title-bar-drag-area")).toBeInTheDocument();
    expect(document.querySelector(".title-bar .pane-tab")).toBeNull();
    expect(document.querySelector(".title-bar .main-area-actions")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the title bar draggable and visually separate from the workspace", () => {
    const css = readFileSync("src/renderer/styles/shell-sidebar.css", "utf8");
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(css).toMatch(/\.title-bar\s*\{[^}]*-webkit-app-region:\s*drag;/s);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*grid-template-rows:\s*42px minmax\(0, 1fr\) 34px;/s);
    expect(designCss).toMatch(/\.app-shell\s*\{[^}]*grid-template-rows:\s*42px minmax\(0, 1fr\) 32px;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.title-bar-drag-area\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
    expect(css).toMatch(/\.title-bar\s*\{[^}]*z-index:\s*40;/s);
    expect(designCss).toMatch(/--title-bar-bg:\s*var\(--color-surface-alt\);/);
  });

  it("keeps pane tabs compact and inside each editor pane", () => {
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(editorCss).toMatch(/\.pane\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);/s);
    expect(editorCss).toMatch(/\.pane-tab-bar\s*\{[^}]*gap:\s*0;/s);
    expect(editorCss).toMatch(/\.pane-tab-bar\s*\{[^}]*width:\s*100%;/s);
    expect(editorCss).toMatch(/\.pane-tabs\s*\{[^}]*overflow:\s*hidden;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*flex:\s*1 1 132px;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*max-width:\s*220px;/s);
    expect(editorCss).toMatch(/\.pane-tab\s*\{[^}]*min-width:\s*64px;/s);
    expect(editorCss).toMatch(/\.pane-tab-name\s*\{[^}]*min-width:\s*0;/s);
  });

  it("manages split pane tab lanes with pane-local boundaries", () => {
    const editorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--left\.pane-tabs--has-tabs\s*\{[^}]*inset -1px 0 0 var\(--border\)/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--right\.pane-tabs--has-tabs\s*\{[^}]*inset -1px 0 0 var\(--border\)/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tab-bar-shell\s*\{[^}]*padding-inline:\s*8px;/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--left \.pane-tab-bar-shell\s*\{[^}]*padding-right:\s*10px;/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--right \.pane-tab-bar-shell\s*\{[^}]*padding-left:\s*0;/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tabs--right \.pane-tab-bar-shell\s*\{[^}]*padding-right:\s*10px;/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tab-bar\s*\{[^}]*overflow:\s*hidden;/s);
    expect(editorCss).toMatch(/\.panes-container--split \.pane-tab\s*\{[^}]*flex:\s*1 1 96px;[^}]*max-width:\s*100%;[^}]*min-width:\s*48px;/s);
  });

  it("does not render diagonal blue panel decorations", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(designCss).not.toMatch(/clip-path:\s*polygon/);
    expect(designCss).not.toMatch(/\.workspace::before/);
    expect(designCss).not.toMatch(/\.workspace::after/);
    expect(designCss).not.toMatch(/\.sidebar::after/);
    expect(designCss).not.toMatch(/\.secondary-sidebar::after/);
    expect(designCss).not.toMatch(/\.right-panel::before/);
  });

  it("keeps the right panel header compact", () => {
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(designCss).toMatch(/\.right-panel-title\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*12px 18px 9px;/s);
    expect(designCss).toMatch(/\.right-panel-content\s*\{[^}]*padding-top:\s*14px;/s);
  });
});
