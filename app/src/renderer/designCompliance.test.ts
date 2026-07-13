import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DESIGN.md compliance", () => {
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");
  const settingsCss = readFileSync("src/renderer/styles/settings.css", "utf8");
  const motionCss = readFileSync("src/renderer/styles/theme-motion.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-primary: #1a1b17;");
    expect(designCss).toContain("--color-bg: #f4f0e6;");
    expect(designCss).toContain("--color-overlay: rgba(255, 255, 255, 0.44);");
    expect(designCss).toContain("--color-overlay-subtle: rgba(26, 27, 23, 0.06);");
    expect(designCss).toContain("--color-surface: #faf7f0;");
    expect(designCss).toContain("--color-surface-alt: #ebe5d9;");
    expect(designCss).toContain("--color-border: #d8d0c1;");
    expect(designCss).toContain("--color-border-strong: #b8af9f;");
    expect(designCss).toContain("--color-text: #1a1b17;");
    expect(designCss).toContain("--color-text-secondary: #62625b;");
    expect(designCss).toContain("--color-text-muted: #76756c;");
    expect(designCss).toContain("--color-accent-surface: rgba(242, 105, 27, 0.84);");
    expect(designCss).toContain("--color-accent: #f2691b;");
    expect(designCss).toContain("--color-accent-strong: #d95711;");
    expect(designCss).toContain("--color-danger: #e23b30;");
    expect(designCss).toContain("--color-warning: var(--color-danger);");
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

  it("uses translucent chrome while keeping borders and shadows restrained", () => {
    expect(designCss).toMatch(/DESIGN\.md compliance overrides/);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*backdrop-filter:\s*blur\(8px\)/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*box-shadow:\s*none;/s);
    expect(designCss).toMatch(/\.settings-segmented\s*\{[^}]*background:\s*var\(--color-surface-alt\);/s);
    expect(designCss).toMatch(/\.settings-segmented-indicator\s*\{[^}]*background:\s*var\(--color-accent\);/s);
    expect(designCss).toMatch(/\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("moves settings switch knobs with restrained elastic feedback", () => {
    expect(settingsCss).toMatch(
      /\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*background-color 300ms var\(--ease-standard\),\s*transform 400ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\);/s
    );
    expect(motionCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after[\s\S]*?transition-duration:\s*1ms;/s
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
    expect(designCss).toMatch(/--material-concrete:\s*[\s\S]*var\(--color-surface-alt\);/);
    expect(designCss).toMatch(/--surface-texture:\s*var\(--material-paper\);/);
    expect(designCss).toMatch(/body\s*\{[^}]*background:\s*var\(--app-bg\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.title-bar\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.main-area\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.primary-button\s*\{[^}]*background:\s*var\(--color-accent-surface\);/s);
    expect(designCss).toMatch(/\.settings-group,[\s\S]*?\.preview-file-embed\s*\{[^}]*background:\s*var\(--material-paper\);/s);
    expect(designCss).toMatch(/\.editor-surface,\s*\.panel-tab-surface,\s*\.preview,\s*\.cm-editor,\s*\.frontmatter-field-card,\s*\.frontmatter-field-add,\s*\.frontmatter-format-guide,\s*\.tool-card,\s*\.tool-section,\s*\.settings-card\s*\{[^}]*background:\s*var\(--material-limestone\);/s);
    expect(designCss).not.toMatch(/url\([^)]*noise/i);
  });
});
