import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("DESIGN.md compliance", () => {
  const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-primary: #3261a1;");
    expect(designCss).toContain("--color-accent: #6c8bb7;");
    expect(designCss).toContain("--color-bg: #f2f1ee;");
    expect(designCss).toContain("--color-surface: #e7e7e7;");
    expect(designCss).toContain("--color-surface-alt: #dddedf;");
    expect(designCss).toContain("--color-border: #c3c8ce;");
    expect(designCss).toContain("--color-border-strong: #a4aebd;");
    expect(designCss).toContain("--color-text: #232b36;");
    expect(designCss).toContain("--color-text-secondary: #89909a;");
    expect(designCss).toContain("--color-text-muted: #89909a;");
  });

  it("does not select brand fonts for the app design tokens", () => {
    expect(designCss).toMatch(/--font-display:\s*system-ui,\s*sans-serif;/);
    expect(designCss).toMatch(/--font-body:\s*system-ui,\s*sans-serif;/);
    expect(designCss).toMatch(/--font-sans:\s*system-ui,\s*sans-serif;/);
    expect(designCss).not.toMatch(/Avenir|IBM Plex|Inter|Geist|Arial Narrow/);
  });

  it("keeps the DESIGN.md radius scale as the design token source", () => {
    expect(designCss).toContain("--radius-sm: 4px;");
    expect(designCss).toContain("--radius-md: 6px;");
    expect(designCss).toContain("--radius-lg: 8px;");
  });

  it("adds a final low-gloss compliance layer for chrome and panels", () => {
    expect(designCss).toMatch(/DESIGN\.md compliance overrides/);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.secondary-sidebar,\s*\.right-panel\s*\{[^}]*backdrop-filter:\s*none;/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.secondary-sidebar,\s*\.right-panel\s*\{[^}]*border-radius:\s*var\(--radius-lg\);/s);
    expect(designCss).toMatch(/\.settings-segmented,\s*\.settings-segmented-indicator\s*\{[^}]*background:\s*var\(--surface-texture\);/s);
    expect(designCss).toMatch(/\.setting-row input\[type="checkbox"\],\s*\.setting-row input\[type="checkbox"\]::after\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("applies subtle lithomorphic surface texture without image noise assets", () => {
    expect(designCss).toMatch(/--texture-grain:\s*[\s\S]*radial-gradient/);
    expect(designCss).toMatch(/--texture-fibers:\s*[\s\S]*linear-gradient/);
    expect(designCss).toMatch(/--texture-stone-wash:\s*[\s\S]*linear-gradient/);
    expect(designCss).toMatch(/--surface-texture:\s*[\s\S]*var\(--texture-stone-wash\),[\s\S]*var\(--texture-grain\),[\s\S]*var\(--color-surface-elevated\);/);
    expect(designCss).toMatch(/body\s*\{[^}]*background:\s*var\(--app-bg\);/s);
    expect(designCss).toMatch(/\.rail,\s*\.sidebar,\s*\.secondary-sidebar,\s*\.right-panel\s*\{[^}]*background:\s*var\(--surface-texture-subtle\);/s);
    expect(designCss).toMatch(/\.editor-surface,\s*\.panel-tab-surface,\s*\.preview,\s*\.cm-editor,\s*\.frontmatter-field-card,\s*\.frontmatter-field-add,\s*\.frontmatter-format-guide,\s*\.tool-card,\s*\.tool-section,\s*\.settings-card\s*\{[^}]*background-image:\s*var\(--texture-stone-wash\), var\(--texture-grain\);/s);
    expect(designCss).not.toMatch(/url\([^)]*noise/i);
  });
});
