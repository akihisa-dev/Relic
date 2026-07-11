import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DESIGN.md compliance", () => {
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-primary: #1c1c1a;");
    expect(designCss).toContain("--color-bg: #ffffff;");
    expect(designCss).toContain("--color-overlay: rgba(255, 255, 255, 0.36);");
    expect(designCss).toContain("--color-overlay-subtle: rgba(28, 28, 26, 0.06);");
    expect(designCss).toContain("--color-surface: #fafaf8;");
    expect(designCss).toContain("--color-surface-alt: #f2f2ee;");
    expect(designCss).toContain("--color-border: #dadad4;");
    expect(designCss).toContain("--color-border-strong: #bdbdb4;");
    expect(designCss).toContain("--color-text: #1c1c1a;");
    expect(designCss).toContain("--color-text-secondary: #5f5f59;");
    expect(designCss).toContain("--color-text-muted: #74746d;");
    expect(designCss).toContain("--color-danger: #d92d20;");
    expect(designCss).not.toContain("--color-accent:");
  });

  it("uses the Liquid Charcoal font stack with system fallback", () => {
    expect(designCss).toMatch(/--font-display:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).toMatch(/--font-body:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).toMatch(/--font-sans:\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
    expect(designCss).not.toMatch(/Avenir|IBM Plex|Geist|Arial Narrow/);
  });

  it("keeps subtle corner tokens for controls while preserving structural square panels", () => {
    expect(designCss).toContain("--radius-sm: 4px;");
    expect(designCss).toContain("--radius-md: 6px;");
    expect(designCss).toContain("--radius-lg: 8px;");
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*border-radius:\s*0;/s);
  });

  it("uses translucent chrome while keeping borders and shadows restrained", () => {
    expect(designCss).toMatch(/DESIGN\.md compliance overrides/);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*backdrop-filter:\s*blur\(14px\)/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*box-shadow:\s*none;/s);
    expect(designCss).toMatch(/\.settings-segmented,\s*\.settings-segmented-indicator\s*\{[^}]*background:\s*var\(--surface-texture\);/s);
    expect(designCss).toMatch(/\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*box-shadow:\s*none;/s);
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
    expect(designCss).toContain("--material-ink: var(--color-primary);");
    expect(designCss).toContain("--material-paper: var(--color-bg);");
    expect(designCss).toContain("--material-panel: var(--color-surface);");
    expect(designCss).toMatch(/--material-concrete:\s*[\s\S]*var\(--color-surface-alt\);/);
    expect(designCss).toMatch(/--surface-texture:\s*var\(--material-paper\);/);
    expect(designCss).toMatch(/body\s*\{[^}]*background:\s*var\(--app-bg\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.title-bar\s*\{[^}]*background:\s*var\(--color-overlay\);/s);
    expect(designCss).toMatch(/\.main-area\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.primary-button\s*\{[^}]*background:\s*var\(--material-ink\);/s);
    expect(designCss).toMatch(/\.settings-group,[\s\S]*?\.preview-file-embed\s*\{[^}]*background:\s*var\(--material-paper\);/s);
    expect(designCss).toMatch(/\.editor-surface,\s*\.panel-tab-surface,\s*\.preview,\s*\.cm-editor,\s*\.frontmatter-field-card,\s*\.frontmatter-field-add,\s*\.frontmatter-format-guide,\s*\.tool-card,\s*\.tool-section,\s*\.settings-card\s*\{[^}]*background:\s*var\(--material-limestone\);/s);
    expect(designCss).not.toMatch(/url\([^)]*noise/i);
  });
});
