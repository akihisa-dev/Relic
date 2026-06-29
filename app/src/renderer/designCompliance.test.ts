import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DESIGN.md compliance", () => {
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-primary: #111111;");
    expect(designCss).toContain("--color-accent: #5f6368;");
    expect(designCss).toContain("--color-bg: #ffffff;");
    expect(designCss).toContain("--color-surface: #fafafa;");
    expect(designCss).toContain("--color-surface-alt: #f3f3f2;");
    expect(designCss).toContain("--color-border: #dedede;");
    expect(designCss).toContain("--color-border-strong: #b8b8b8;");
    expect(designCss).toContain("--color-text: #111111;");
    expect(designCss).toContain("--color-text-secondary: #5f6368;");
    expect(designCss).toContain("--color-text-muted: #9a9a9a;");
  });

  it("uses the Liquid Charcoal font stack with system fallback", () => {
    expect(designCss).toMatch(/--font-display:\s*Inter,\s*"Noto Sans JP",\s*system-ui,\s*sans-serif;/);
    expect(designCss).toMatch(/--font-body:\s*Inter,\s*"Noto Sans JP",\s*system-ui,\s*sans-serif;/);
    expect(designCss).toMatch(/--font-sans:\s*Inter,\s*"Noto Sans JP",\s*system-ui,\s*sans-serif;/);
    expect(designCss).not.toMatch(/Avenir|IBM Plex|Geist|Arial Narrow/);
  });

  it("keeps subtle corner tokens for controls while preserving structural square panels", () => {
    expect(designCss).toContain("--radius-sm: 4px;");
    expect(designCss).toContain("--radius-md: 6px;");
    expect(designCss).toContain("--radius-lg: 8px;");
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*border-radius:\s*0;/s);
  });

  it("adds a final low-gloss compliance layer for chrome and panels", () => {
    expect(designCss).toMatch(/DESIGN\.md compliance overrides/);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*backdrop-filter:\s*none;/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*box-shadow:\s*none;/s);
    expect(designCss).toMatch(/\.settings-segmented,\s*\.settings-segmented-indicator\s*\{[^}]*background:\s*var\(--surface-texture\);/s);
    expect(designCss).toMatch(/\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("does not force all surfaces to square corners globally", () => {
    expect(designCss).not.toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*border-radius:\s*0;/s);
    expect(designCss).toMatch(/button,\s*input,\s*select,\s*textarea\s*\{[^}]*border-radius:\s*var\(--radius-md\);/s);
    expect(designCss).toMatch(/\.file-tree-row,[\s\S]*?\.workspace-action-button\s*\{[^}]*border-radius:\s*var\(--radius-sm\);/s);
  });

  it("applies Liquid Charcoal surfaces without noisy texture assets", () => {
    expect(designCss).not.toMatch(/radial-gradient/);
    expect(designCss).toMatch(/--texture-fibers:\s*[\s\S]*linear-gradient/);
    expect(designCss).toMatch(/--texture-stone-wash:\s*[\s\S]*linear-gradient/);
    expect(designCss).toMatch(/--material-ink:\s*linear-gradient\(180deg,\s*#1b1b1b 0%,\s*#000000 100%\);/);
    expect(designCss).toMatch(/--material-paper:\s*linear-gradient\(180deg,\s*#ffffff 0%,\s*#fbfbfa 100%\);/);
    expect(designCss).toMatch(/--material-panel:\s*linear-gradient\(180deg,\s*#fafafa 0%,\s*#f5f5f4 100%\);/);
    expect(designCss).toMatch(/--material-concrete:\s*[\s\S]*var\(--color-surface-alt\);/);
    expect(designCss).toMatch(/--surface-texture:\s*var\(--material-paper\);/);
    expect(designCss).toMatch(/body\s*\{[^}]*background:\s*var\(--app-bg\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--surface-texture-subtle\);/s);
    expect(designCss).toMatch(/\.title-bar\s*\{[^}]*background:\s*var\(--color-surface-elevated\);/s);
    expect(designCss).toMatch(/\.main-area\s*\{[^}]*background:\s*var\(--color-bg\);/s);
    expect(designCss).toMatch(/\.primary-button\s*\{[^}]*background:\s*var\(--material-ink\);/s);
    expect(designCss).toMatch(/\.settings-group,[\s\S]*?\.preview-file-embed\s*\{[^}]*background:\s*var\(--material-paper\);/s);
    expect(designCss).toMatch(/\.editor-surface,\s*\.panel-tab-surface,\s*\.preview,\s*\.cm-editor,\s*\.frontmatter-field-card,\s*\.frontmatter-field-add,\s*\.frontmatter-format-guide,\s*\.tool-card,\s*\.tool-section,\s*\.settings-card\s*\{[^}]*background:\s*var\(--material-limestone\);/s);
    expect(designCss).not.toMatch(/url\([^)]*noise/i);
  });
});
