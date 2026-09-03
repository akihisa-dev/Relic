import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readCssEntry } from "../test/cssTestUtils";

type Rgb = readonly [number, number, number];

function hexRgb(value: string): Rgb {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return [channels[0]!, channels[1]!, channels[2]!];
}

function blend(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  const channel = (index: number) => Math.round(foreground[index]! * alpha + background[index]! * (1 - alpha));
  return [channel(0), channel(1), channel(2)];
}

function contrastRatio(left: Rgb, right: Rgb): number {
  const luminance = (color: Rgb) => {
    const channels = color.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const bright = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (bright + 0.05) / (dark + 0.05);
}

function cssDeclarations(rule: string): Map<string, string> {
  return new Map([...rule.matchAll(/^\s*(--[\w-]+|background|color):\s*([^;]+);/gm)]
    .map((match) => [match[1]!, match[2]!.trim()]));
}

function resolveCssValue(value: string, tokens: ReadonlyMap<string, string>): string {
  let resolved = value;
  for (let depth = 0; depth < 12; depth += 1) {
    const variable = resolved.match(/^var\((--[\w-]+)\)$/);
    if (!variable) return resolved;
    resolved = tokens.get(variable[1]!) ?? "";
  }
  return resolved;
}

function cssColorRgb(value: string, background: Rgb): Rgb {
  if (value.startsWith("#")) return hexRgb(value);
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (!rgba) throw new Error(`Unsupported CSS color in test: ${value}`);
  return blend([Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], Number(rgba[4]), background);
}

function listCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
  });
}

describe("DESIGN.md compliance", () => {
  const designCss = readCssEntry("src/renderer/styles/architectural-design.css");
  const settingsCss = readFileSync("src/renderer/styles/settings.css", "utf8");
  const shellLayoutCss = readFileSync("src/renderer/styles/shell-layout.css", "utf8");
  const tableCss = readFileSync("src/renderer/styles/table-view.css", "utf8");
  const motionCss = readFileSync("src/renderer/styles/theme-motion.css", "utf8");
  const bubbleCss = readFileSync("src/renderer/styles/bubble.css", "utf8");
  const editorShellCss = readFileSync("src/renderer/styles/editor-shell.css", "utf8");
  const previewMarkdownCss = readFileSync("src/renderer/styles/preview-markdown-content.css", "utf8");
  const rightPanelCss = readCssEntry("src/renderer/styles/right-panel.css");
  const workspaceEditorCss = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");
  const styleEntryCss = readFileSync("src/renderer/styles.css", "utf8");

  it("uses the DESIGN.md color tokens", () => {
    expect(designCss).toContain("--color-white: #fffffe;");
    expect(designCss).toContain("--color-black: #050505;");
    expect(designCss).toContain("--color-dark-bg: #10110f;");
    expect(designCss).toContain("--color-dark-surface: #171815;");
    expect(designCss).toContain("--color-dark-surface-elevated: #1e1f1b;");
    expect(designCss).toContain("--color-dark-text: #f2f3ed;");
    expect(designCss).toContain("--color-primary: var(--color-black);");
    expect(designCss).toContain("--color-bg: var(--color-white);");
    expect(designCss).toContain("--color-overlay: var(--glass-surface);");
    expect(designCss).toContain("--color-overlay-subtle: rgba(5, 5, 5, 0.06);");
    expect(designCss).toContain("--color-surface: var(--color-white);");
    expect(designCss).toContain("--color-surface-alt: rgba(5, 5, 5, 0.08);");
    expect(designCss).toContain("--color-border: rgba(5, 5, 5, 0.2);");
    expect(designCss).toContain("--color-border-strong: rgba(5, 5, 5, 0.46);");
    expect(designCss).toContain("--color-text: var(--color-black);");
    expect(designCss).toContain("--color-text-secondary: rgba(5, 5, 5, 0.74);");
    expect(designCss).toContain("--color-text-muted: rgba(5, 5, 5, 0.6);");
    expect(designCss).toContain("--glass-surface: rgba(18, 18, 16, 0.94);");
    expect(designCss).toContain("--glass-border: rgba(255, 255, 254, 0.24);");
    expect(designCss).toContain("--glass-highlight: rgba(255, 255, 254, 0.1);");
    expect(designCss).toContain("--glass-hover: rgba(255, 255, 254, 0.09);");
    expect(designCss).toContain("--glass-text: var(--color-white);");
    expect(designCss).toContain("--tab-active-text-secondary: var(--glass-text-secondary);");
    expect(designCss).toContain("--tab-active-text-muted: var(--glass-text-muted);");
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

  it("tunes dark surfaces independently instead of inverting light colors", () => {
    const darkTheme = designCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(darkTheme).toContain("--color-bg: var(--color-dark-bg);");
    expect(darkTheme).toContain("--color-surface: var(--color-dark-surface);");
    expect(darkTheme).toContain("--color-surface-elevated: var(--color-dark-surface-elevated);");
    expect(darkTheme).toContain("--glass-surface: rgba(21, 22, 19, 0.96);");
    expect(darkTheme).toContain("--glass-text: var(--color-dark-text);");
    expect(darkTheme).toContain("--color-on-primary: var(--color-dark-bg);");
    expect(darkTheme).not.toContain("--glass-surface: rgba(255, 255, 254");
  });

  it("keeps readable text contrast on work, glass, and action surfaces", () => {
    const white = hexRgb("#fffffe");
    const black = hexRgb("#050505");
    const darkBackground = hexRgb("#10110f");
    const darkText = hexRgb("#f2f3ed");
    const lightGlass = blend(hexRgb("#121210"), 0.94, white);
    const darkGlass = blend(hexRgb("#151613"), 0.96, darkBackground);
    const lightAction = white;
    const lightActionText = black;
    const darkAction = darkText;
    const darkActionText = darkBackground;

    expect(contrastRatio(black, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkText, darkBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(white, lightGlass)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkText, darkGlass)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightActionText, lightAction)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkActionText, darkAction)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every semantic foreground readable on its light and dark surface", () => {
    const rootTokens = cssDeclarations(designCss.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "");
    const darkTokens = new Map([
      ...rootTokens,
      ...cssDeclarations(designCss.match(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "")
    ]);
    const surfaces: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      ["work", "--color-bg", ["--color-text", "--color-text-secondary", "--color-text-muted"]],
      ["surface", "--color-surface", ["--color-text", "--color-text-secondary", "--color-text-muted"]],
      ["elevated", "--color-surface-elevated", ["--color-text", "--color-text-secondary", "--color-text-muted"]],
      ["selection", "--color-selection-bg", ["--color-selection-text"]],
      ["glass", "--glass-surface", ["--glass-text", "--glass-text-secondary", "--glass-text-muted"]],
      ["active tab", "--tab-active-bg", ["--tab-active-text", "--tab-active-text-secondary", "--tab-active-text-muted"]],
      ["card preview", "--card-preview-bg", ["--card-preview-text", "--card-preview-text-secondary", "--card-preview-text-muted"]],
      ["glass action", "--glass-action-bg", ["--glass-action-text"]],
      ["tooltip", "--color-tooltip-surface", ["--color-tooltip-text"]]
    ];

    for (const [theme, tokens, fallback] of [
      ["light", rootTokens, hexRgb("#fffffe")],
      ["dark", darkTokens, hexRgb("#10110f")]
    ] as const) {
      const workSurface = cssColorRgb(resolveCssValue("var(--color-bg)", tokens), fallback);
      for (const [surfaceName, surfaceToken, foregroundTokens] of surfaces) {
        const surface = cssColorRgb(resolveCssValue(`var(${surfaceToken})`, tokens), workSurface);
        for (const foregroundToken of foregroundTokens) {
          const foreground = cssColorRgb(resolveCssValue(`var(${foregroundToken})`, tokens), surface);
          expect(
            contrastRatio(foreground, surface),
            `${theme} ${foregroundToken} on ${surfaceName}`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
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

  it("shows the active tab with a dedicated surface and persistent indicator", () => {
    const darkTheme = designCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(designCss).toContain("--tab-active-bg: var(--glass-surface);");
    expect(designCss).toContain("--tab-active-text: var(--glass-text);");
    expect(darkTheme).toContain("--tab-active-bg: #2b2d28;");
    expect(darkTheme).toContain("--tab-active-text: var(--color-dark-text);");
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*background:\s*var\(--tab-active-bg\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*border:\s*1px solid var\(--tab-active-border\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*box-shadow:\s*inset 0 -3px 0 var\(--tab-active-indicator\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*color:\s*var\(--tab-active-text\);/s);
    expect(designCss).toMatch(/\.pane-tab--active\s*\{[^}]*font-weight:\s*750;/s);
    expect(contrastRatio(hexRgb("#fffffe"), blend(hexRgb("#121210"), 0.94, hexRgb("#fffffe"))))
      .toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexRgb("#f2f3ed"), hexRgb("#2b2d28"))).toBeGreaterThanOrEqual(4.5);
    expect(styleEntryCss).toContain(
      "@layer relic-vendor, relic-foundation, relic-shell, relic-feature, relic-theme, relic-refinements;"
    );
    expect(styleEntryCss.indexOf('@import "./styles/architectural-design.css" layer(relic-refinements);'))
      .toBeGreaterThan(styleEntryCss.indexOf('@import "./styles/workspace-editor.css" layer(relic-shell);'));
  });

  it("keeps outline labels clear of their hierarchy guides", () => {
    const outlineButtonRefinement = designCss.match(/\.outline-item-button\s*\{([^}]*)\}/)?.[1] ?? "";
    const guidePositions = new Map([...rightPanelCss.matchAll(
      /\.outline-item--h(\d)\s*\{[^}]*--outline-guide-position:\s*([^;]+);/gs
    )].map((match) => [Number(match[1]), [...match[2]!.matchAll(/(\d+)px/g)].map((position) => Number(position[1]))]));
    const labelInsets = new Map([...rightPanelCss.matchAll(
      /\.outline-item--h(\d) \.outline-item-button\s*\{\s*padding:\s*\d+px\s+\d+px\s+\d+px\s+(\d+)px;\s*\}/g
    )].map((match) => [Number(match[1]), Number(match[2])]));

    expect(outlineButtonRefinement).toContain("padding-block: 8px;");
    expect(outlineButtonRefinement).toContain("padding-right: 12px;");
    expect(outlineButtonRefinement).not.toMatch(/^\s*padding(?:\s*:|-left\s*:|-inline(?:-start|-end)?\s*:)/m);

    for (let level = 2; level <= 6; level += 1) {
      expect(labelInsets.get(level)).toBeGreaterThan(Math.max(...(guidePositions.get(level) ?? [])));
    }
  });

  it("resolves the final active tab foreground and background as a contrasting pair", () => {
    const rootTokens = designCss.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const darkTokens = designCss.match(/:root\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const originalActiveTab = workspaceEditorCss.match(/\.pane-tab--active\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const finalActiveTab = designCss.match(/\.pane-tab--active\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const lightTokens = cssDeclarations(rootTokens);
    const resolvedDarkTokens = new Map([...lightTokens, ...cssDeclarations(darkTokens)]);
    const activeDeclarations = new Map([
      ...cssDeclarations(originalActiveTab),
      ...cssDeclarations(finalActiveTab)
    ]);
    const lightActiveTokens = new Map([...lightTokens, ...activeDeclarations]);
    const darkActiveTokens = new Map([...resolvedDarkTokens, ...activeDeclarations]);
    const lightBackground = resolveCssValue(activeDeclarations.get("background") ?? "", lightTokens);
    const lightText = resolveCssValue(activeDeclarations.get("color") ?? "", lightTokens);
    const darkBackground = resolveCssValue(activeDeclarations.get("background") ?? "", resolvedDarkTokens);
    const darkText = resolveCssValue(activeDeclarations.get("color") ?? "", resolvedDarkTokens);

    expect(lightBackground).toBe("rgba(18, 18, 16, 0.94)");
    expect(lightText).toBe("#fffffe");
    expect(darkBackground).toBe("#2b2d28");
    expect(darkText).toBe("#f2f3ed");
    expect(contrastRatio(cssColorRgb(lightText, hexRgb("#fffffe")), cssColorRgb(lightBackground, hexRgb("#fffffe"))))
      .toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cssColorRgb(darkText, hexRgb("#10110f")), cssColorRgb(darkBackground, hexRgb("#10110f"))))
      .toBeGreaterThanOrEqual(4.5);
    for (const activeForeground of ["--text", "--text-2", "--text-3"]) {
      const lightForeground = resolveCssValue(`var(${activeForeground})`, lightActiveTokens);
      const darkForeground = resolveCssValue(`var(${activeForeground})`, darkActiveTokens);
      expect(contrastRatio(cssColorRgb(lightForeground, hexRgb("#fffffe")), cssColorRgb(lightBackground, hexRgb("#fffffe"))))
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(cssColorRgb(darkForeground, hexRgb("#10110f")), cssColorRgb(darkBackground, hexRgb("#10110f"))))
        .toBeGreaterThanOrEqual(4.5);
    }
    expect(designCss).toMatch(/\.pane-tab--active \.pane-tab-close\s*\{[^}]*color:\s*var\(--tab-active-text-muted\);/s);
    expect(designCss).toMatch(/\.pane-tab--active \.pane-tab-close:hover\s*\{[^}]*color:\s*var\(--tab-active-text\);/s);
  });

  it("scopes all foreground states to dark operation surfaces", () => {
    const operationContext = designCss.match(/:where\(\s*\.title-bar,[\s\S]*?\.toast\s*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    for (const declaration of [
      "--color-text: var(--glass-text);",
      "--color-text-secondary: var(--glass-text-secondary);",
      "--color-text-muted: var(--glass-text-muted);",
      "--color-danger: var(--glass-text);",
      "--error: var(--glass-text);",
      "--focus-ring: var(--glass-text);",
      "--text: var(--glass-text);",
      "--text-2: var(--glass-text-secondary);",
      "--text-3: var(--glass-text-muted);"
    ]) {
      expect(operationContext).toContain(declaration);
    }
    expect(designCss).toMatch(/\.app-shell :is\(button, input, select, textarea\):disabled\s*\{[^}]*color:\s*var\(--text-3\);[^}]*cursor:\s*not-allowed;[^}]*opacity:\s*1;/s);
    expect(shellLayoutCss).toMatch(/\.sw-7 \.track\s*\{[^}]*background:\s*var\(--off\);[^}]*border:\s*1px solid var\(--border\);/s);
  });

  it("keeps keyboard focus visible on tabs, menus, and canvas views", () => {
    expect(workspaceEditorCss).toMatch(/\.pane-tab:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent-ring\);/s);
    expect(workspaceEditorCss).toMatch(/\.tab-context-menu-item:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent-ring\);/s);
    expect(bubbleCss).toMatch(/\.bubble-view-canvas:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-primary\);/s);
  });

  it("uses theme-aware syntax foregrounds instead of the vendor light palette", () => {
    expect(previewMarkdownCss).toMatch(/:where\(\.preview-body, \.page-preview-body\) \.hljs\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--text\);/s);
    expect(previewMarkdownCss).toMatch(/\.hljs-comment,[\s\S]*?color:\s*var\(--text-3\);/s);
    expect(previewMarkdownCss).toMatch(/\.hljs-addition, \.hljs-deletion\)\s*\{[^}]*background:\s*var\(--selection\);[^}]*color:\s*var\(--text\);/s);
  });

  it("keeps the line-number gutter on the current theme surface", () => {
    expect(designCss).toMatch(/\.cm-editor-shell \.cm-editor-container \.cm-gutters\s*\{[^}]*background-color:\s*var\(--bg\) !important;[^}]*color:\s*var\(--color-text-muted\) !important;/s);
    expect(designCss).toMatch(/\.cm-editor-shell \.cm-editor-container \.cm-activeLineGutter\s*\{[^}]*background-color:\s*var\(--bg\) !important;/s);
  });

  it("keeps transient dialog controls readable on glass", () => {
    expect(designCss).toMatch(/\.frontmatter-add-dialog,[\s\S]*?\.toast\s*\{[^}]*--btn-bg:\s*var\(--glass-control-bg\);[^}]*--text:\s*var\(--color-on-glass\);/s);
    expect(designCss).toMatch(/:where\(\.frontmatter-add-dialog-actions, \.workspace-input-dialog-actions\) > button\s*\{[^}]*background:\s*var\(--glass-control-bg\);[^}]*color:\s*var\(--glass-text\);/s);
    expect(designCss).toMatch(/:where\(\.frontmatter-add-dialog-actions, \.workspace-input-dialog-actions\) > button:last-child\s*\{[^}]*background:\s*var\(--glass-action-bg\);[^}]*color:\s*var\(--glass-action-text\);/s);
  });

  it("does not bypass theme tokens in component foregrounds and surfaces", () => {
    const directColor = /^\s*(?:color|background(?:-color)?|border-color):\s*(?:white|black|#[\da-f]{3,8}|rgba?\()/gim;
    const violations = listCssFiles("src/renderer/styles")
      .filter((file) => !file.endsWith("architectural-design/foundation-variables.css"))
      .flatMap((file) => [...readFileSync(file, "utf8").matchAll(directColor)]
        .map((match) => `${file}:${match[0].trim()}`));
    expect(violations).toEqual([]);
  });

  it("defines every semantic color alias referenced by renderer styles", () => {
    const allCss = listCssFiles("src/renderer/styles").map((file) => readFileSync(file, "utf8")).join("\n");
    const definitions = new Set([...allCss.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]!));
    const semanticColorAlias = /^--(?:color-|glass-|tab-active-|card-preview-|text(?:-|$)|bg$|surface(?:-|$)|border(?:-|$)|btn-bg$|hover(?:-|$)|accent(?:-|$)|attention(?:-|$)|highlight$|error(?:-|$)|success$|focus(?:-|$)|input-bg$|link$|popup-bg$|rail-bg$|sidebar-bg$|title-bar-bg$|chrome-)/;
    const missing = [...new Set([...allCss.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]!))]
      .filter((variable) => semanticColorAlias.test(variable) && !definitions.has(variable))
      .sort();

    expect(missing).toEqual([]);
    expect(editorShellCss).not.toContain("var(--text-1)");
    expect(settingsCss).not.toContain("var(--text-muted)");
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
  const fileTreeCss = readCssEntry("src/renderer/styles/file-tree-search.css");

  it("開いているワークスペースの切り替え操作をサイドバー下部の黒い操作面として表示する", () => {
    expect(fileTreeCss).toMatch(/\.sidebar-section:has\(> \.workspace-actions\)\s*\{[^}]*min-height:\s*100%;/s);
    expect(fileTreeCss).toMatch(/\.sidebar:has\(\.workspace-actions\)::after\s*\{[^}]*display:\s*none;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*background:\s*var\(--glass-surface\);/s);
    expect(fileTreeCss).not.toMatch(/\.workspace-actions\s*\{[^}]*position:\s*sticky;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*margin:\s*0 -16px;/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions\s*\{[^}]*padding:\s*6px 24px 8px;/s);
    expect(fileTreeCss).not.toMatch(/\.workspace-actions\s*\{[^}]*min-height:/s);
    expect(fileTreeCss).toMatch(/\.workspace-actions \.workspace-action-button\s*\{[^}]*color:\s*var\(--glass-text-secondary\);/s);
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
  const designCss = readCssEntry("src/renderer/styles/architectural-design.css");

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
