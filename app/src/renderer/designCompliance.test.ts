import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DESIGN.md compliance", () => {
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");
  const settingsCss = readFileSync("src/renderer/styles/settings.css", "utf8");
  const tableCss = readFileSync("src/renderer/styles/table-view.css", "utf8");
  const motionCss = readFileSync("src/renderer/styles/theme-motion.css", "utf8");
  const workspaceEditorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-white: #fffffe;");
    expect(designCss).toContain("--color-black: #050505;");
    expect(designCss).toContain("--color-primary: var(--color-black);");
    expect(designCss).toContain("--color-bg: var(--color-white);");
    expect(designCss).toContain("--color-overlay: var(--glass-surface);");
    expect(designCss).toContain("--color-overlay-subtle: rgba(5, 5, 5, 0.06);");
    expect(designCss).toContain("--color-surface: var(--color-white);");
    expect(designCss).toContain("--color-surface-alt: rgba(5, 5, 5, 0.08);");
    expect(designCss).toContain("--color-border: rgba(5, 5, 5, 0.18);");
    expect(designCss).toContain("--color-border-strong: rgba(5, 5, 5, 0.42);");
    expect(designCss).toContain("--color-text: var(--color-black);");
    expect(designCss).toContain("--color-text-secondary: rgba(5, 5, 5, 0.72);");
    expect(designCss).toContain("--color-text-muted: rgba(5, 5, 5, 0.56);");
    expect(designCss).toContain("--glass-surface: rgba(5, 5, 5, 0.86);");
    expect(designCss).toContain("--glass-border: rgba(255, 255, 254, 0.2);");
    expect(designCss).toContain("--glass-highlight: rgba(255, 255, 254, 0.12);");
    expect(designCss).toContain("--glass-hover: rgba(255, 255, 254, 0.1);");
    expect(designCss).toContain("--glass-text: var(--color-white);");
    expect(designCss).toContain("--color-tooltip-surface: var(--glass-surface);");
    expect(designCss).toContain("--color-tooltip-text: var(--glass-text);");
    expect(designCss).toContain("--color-glass-overlay: var(--glass-surface);");
    expect(designCss).toContain("--color-glass-highlight: var(--glass-highlight);");
    expect(designCss).toContain("--color-accent-surface: var(--color-glass-overlay);");
    expect(designCss).toContain("--color-accent: var(--color-black);");
    expect(designCss).toContain("--color-accent-strong: var(--color-black);");
    expect(designCss).toContain("--color-danger: var(--color-black);");
    expect(designCss).toContain("--color-warning: var(--color-danger);");
    expect(designCss).toContain("--color-success: var(--color-black);");
    expect(designCss).toContain("--color-info: var(--color-black);");
    expect(designCss).toMatch(/:root\s*\{[^}]*color-scheme:\s*light;/s);
  });

  it("uses the Liquid Charcoal font stack with system fallback", () => {
    expect(designCss).toMatch(/--font-display:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).toMatch(/--font-body:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).toMatch(/--font-sans:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).not.toMatch(/Avenir|IBM Plex|Geist|Arial Narrow/);
  });

  it("keeps subtle corner tokens for controls while preserving structural square panels", () => {
    expect(designCss).toContain("--radius-sm: 8px;");
    expect(designCss).toContain("--radius-md: 12px;");
    expect(designCss).toContain("--radius-lg: 16px;");
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*border-radius:\s*0;/s);
  });

  it("uses black glass for operation layers and opaque white for broad panels", () => {
    expect(designCss).toMatch(/DESIGN\.md compliance overrides/);
    expect(designCss).toMatch(/\.rail\s*\{[^}]*background:\s*var\(--color-glass-overlay\);/s);
    expect(designCss).toMatch(/\.rail\s*\{[^}]*backdrop-filter:\s*blur\(10px\) saturate\(100%\)/s);
    expect(designCss).toMatch(/\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.app-shell,\s*\.workspace,\s*\.main-area,[\s\S]*?\.settings-page\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.sidebar,\s*\.right-panel\s*\{[^}]*backdrop-filter:\s*none;/s);
    expect(designCss).toMatch(/\.settings-segmented\s*\{[^}]*background:\s*var\(--color-surface-alt\);/s);
    expect(designCss).toMatch(/\.settings-segmented-indicator\s*\{[^}]*background:\s*var\(--color-glass-overlay\);/s);
    expect(designCss).toMatch(/\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("shows the active tab as inverted liquid glass", () => {
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*backdrop-filter:\s*blur\(10px\) saturate\(100%\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*background:\s*var\(--glass-surface\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*border:\s*1px solid var\(--glass-border\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*box-shadow:\s*inset 0 1px 0 var\(--glass-highlight\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*color:\s*var\(--glass-text\);/s);
  });

  it("moves settings switch knobs through the on class with elastic feedback", () => {
    expect(settingsCss).toMatch(
      /\.settings-toggle-switch \.switch-knob\s*\{[^}]*background-color 300ms var\(--ease-standard\),\s*transform 400ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\);/s
    );
    expect(settingsCss).toMatch(/\.settings-toggle-switch\.on \.switch-knob\s*\{[^}]*transform:\s*translateX\(22px\);/s);
    expect(motionCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.settings-toggle-switch,\s*\.settings-toggle-switch \.switch-knob[\s\S]*?transition-duration:\s*1ms;/s
    );
  });

  it("reduces tab and table reorder motion when requested", () => {
    expect(motionCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pane-tab,[\s\S]*?transition-duration:\s*1ms;/s
    );
    expect(workspaceEditorCss).toMatch(
      /\.pane-tab\s*\{[^}]*transform var\(--motion-normal\) var\(--ease-standard\);/s
    );
    expect(tableCss).toMatch(
      /\.table-view-cell\s*\{[^}]*transform var\(--motion-normal\) var\(--ease-standard\);/s
    );
    expect(tableCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.table-view-cell\s*\{[^}]*transition-duration:\s*1ms;/s
    );
  });

  it("does not force all surfaces to square corners globally", () => {
    expect(designCss).not.toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*border-radius:\s*0;/s);
    expect(designCss).toMatch(/button,\s*input,\s*select,\s*textarea\s*\{[^}]*border-radius:\s*var\(--radius-md\);/s);
    expect(designCss).toMatch(/\.file-tree-row,[\s\S]*?\.workspace-action-button\s*\{[^}]*border-radius:\s*var\(--radius-sm\);/s);
  });

  it("protects the primary work area at the minimum window width", () => {
    expect(designCss).toMatch(/@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.layout-resize-boundary--right-panel,\s*\.right-panel\s*\{[^}]*display:\s*none;/s);
  });

  it("applies Liquid Charcoal surfaces without noisy texture assets", () => {
    expect(designCss).not.toMatch(/radial-gradient/);
    expect(designCss).not.toMatch(/linear-gradient/);
    expect(designCss).toContain("--texture-fibers: var(--color-bg);");
    expect(designCss).toContain("--texture-stone-wash: var(--color-surface);");
    expect(designCss).toContain("--material-ink: var(--color-accent-surface);");
    expect(designCss).toContain("--material-paper: var(--color-bg);");
    expect(designCss).toContain("--material-panel: var(--color-surface);");
    expect(designCss).toMatch(/--material-concrete:\s*var\(--color-glass-overlay\);/);
    expect(designCss).toMatch(/--surface-texture:\s*var\(--material-paper\);/);
    expect(designCss).toMatch(/body\s*\{[^}]*background:\s*var\(--app-bg\);/s);
    expect(designCss).toMatch(/\.rail\s*\{[^}]*background:\s*var\(--color-glass-overlay\);/s);
    expect(designCss).toMatch(/\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.title-bar\s*\{[^}]*background:\s*var\(--color-glass-overlay\);/s);
    expect(designCss).toMatch(/\.main-area\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.primary-button\s*\{[^}]*background:\s*var\(--color-accent-surface\);[^}]*color:\s*var\(--color-on-glass\);/s);
    expect(designCss).toMatch(/\.settings-group,[\s\S]*?\.preview-file-embed\s*\{[^}]*background:\s*var\(--material-paper\);/s);
    expect(designCss).toMatch(/\.editor-surface,\s*\.panel-tab-surface,\s*\.preview,\s*\.cm-editor,\s*\.frontmatter-field-card,\s*\.frontmatter-field-add,\s*\.frontmatter-format-guide,\s*\.tool-card,\s*\.tool-section,\s*\.settings-card\s*\{[^}]*background:\s*var\(--material-limestone\);/s);
    expect(designCss).not.toMatch(/url\([^)]*noise/i);
  });
});

describe("Workspace layout CSS contracts", () => {
  const fileTreeCss = readFileSync("src/renderer/styles/file-tree-search.css", "utf8");

  it("開いているワークスペースの切り替え操作をサイドバー下部の黒い操作面として表示する", () => {
    expect(fileTreeCss).toMatch(/\.sidebar-section:has\(> \.workspace-actions\)\s*\{[^}]*min-height:\s*100%;/s);
    expect(fileTreeCss).toMatch(/\.sidebar:has\(\.workspace-actions\)::after\s*\{[^}]*display:\s*none;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*background:\s*var\(--color-primary-dark\);/s);
    expect(fileTreeCss).not.toMatch(/\.workspace-actions\s*\{[^}]*position:\s*sticky;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*margin:\s*0 -16px;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*padding:\s*6px 24px 8px;/s);
    expect(fileTreeCss).not.toMatch(/\.workspace-actions\s*\{[^}]*min-height:/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions \.workspace-action-button\s*\{[^}]*color:\s*color-mix\(in srgb, #fff 88%, var\(--color-primary-dark\) 12%\);/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions \.workspace-action-button\s*\{[^}]*min-height:\s*28px;/s);
  });

  it("ファイル作成操作は一覧スクロールから外して固定する", () => {
    expect(fileTreeCss).toMatch(/\.sidebar-body:has\(> \.files-sidebar-section\)\s*\{[^}]*overflow:\s*hidden;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-section\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-section\s*\{[^}]*height:\s*calc\(100% \+ 32px\);/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-section\s*\{[^}]*margin:\s*-16px;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-section\s*\{[^}]*padding:\s*16px 16px 0;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-fixed-controls\s*\{[^}]*position:\s*relative;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-fixed-controls\s*\{[^}]*z-index:\s*6;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-scroll-area\s*\{[^}]*min-height:\s*0;/s);
    expect(fileTreeCss).toMatch(/\.files-sidebar-scroll-area\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it("ファイルツリー行は通常時にクリック可能なカーソルを表示する", () => {
    expect(fileTreeCss).toMatch(/\.file-tree-row\s*\{[^}]*cursor:\s*pointer;/s);
    expect(fileTreeCss).toMatch(/\.file-tree-row\.dragging\s*\{[^}]*cursor:\s*grabbing;/s);
  });
});

describe("Editor title CSS contracts", () => {
  const editorShellCss = readFileSync("src/renderer/styles/editor-shell.css", "utf8");
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

  it("本文上部のファイル名表示欄は枠なしで縦幅を詰める", () => {
    expect(editorShellCss).toMatch(/\.editor-file-title-row\s*\{[^}]*grid-template-columns:\s*[^}]*minmax\(0, var\(--editor-file-title-max-width, 820px\)\)[^}]*minmax\(48px, 1fr\);/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-slot\s*\{[^}]*grid-column:\s*2;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title\s*\{[^}]*border:\s*0;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title\s*\{[^}]*padding:\s*12px 32px 8px;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*grid-column:\s*3;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*flex-direction:\s*column;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*gap:\s*6px;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*min-height:\s*84px;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*padding:\s*12px 32px 8px 8px;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions \.editor-frontmatter-add-button\s*\{[^}]*position:\s*static;/s);
    expect(editorShellCss).toMatch(/\.editor-file-title-actions \.toolbar-btn\s*\{[^}]*height:\s*32px;[^}]*width:\s*32px;/s);
    expect(designCss).toMatch(/\.editor-file-title\s*\{[^}]*padding:\s*12px 32px 8px;/s);
  });
});
