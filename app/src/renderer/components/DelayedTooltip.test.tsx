import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { render, screen } from "@testing-library/react";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { DelayedTooltip } from "./DelayedTooltip";

describe("DelayedTooltip", () => {
  it("右クリックメニューのボタンと説明を共通ラッパー内へ表示する", () => {
    render(
      <DelayedTooltip className="delayed-tooltip--context-menu" label="説明">
        <button type="button">操作</button>
      </DelayedTooltip>
    );

    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(screen.getByRole("button", { name: "操作" })).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("説明");
    expect(tooltip.parentElement).toHaveClass("delayed-tooltip", "delayed-tooltip--context-menu");
  });

  it("hoverだけに表示遅延を付け、離れた時は遅延なしで隠す", () => {
    const css = readFileSync("src/renderer/styles/delayed-tooltip.css", "utf8");

    expect(css).toMatch(
      /\.delayed-tooltip-content\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateX\(-50%\) scale\(0\.85\);[^}]*transition:\s*opacity 100ms ease,\s*transform 100ms ease;/s
    );
    expect(css).toMatch(
      /\.delayed-tooltip:hover \.delayed-tooltip-content\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*translateX\(-50%\) scale\(1\);[^}]*opacity 150ms ease 400ms,\s*transform 180ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\) 400ms;/s
    );
    expect(css).toMatch(/\.delayed-tooltip:focus-within \.delayed-tooltip-content\s*\{[^}]*opacity:\s*1;[^}]*transition:\s*opacity 150ms ease,/s);
  });

  it("右クリックメニューのボタン上へ明るい吹き出しと三角を表示する", () => {
    const css = readFileSync("src/renderer/styles/delayed-tooltip.css", "utf8");

    expect(css).toMatch(/\.delayed-tooltip-content\s*\{[^}]*background:\s*var\(--color-tooltip-surface\);[^}]*border-radius:\s*12px;[^}]*bottom:\s*calc\(100% \+ 11px\);[^}]*color:\s*var\(--color-tooltip-text\);/s);
    expect(css).toMatch(/\.delayed-tooltip-content::after\s*\{[^}]*border-top:\s*7px solid var\(--color-tooltip-surface\);[^}]*top:\s*calc\(100% - 1px\);/s);
  });

  it("吹き出しと三角へ同じアウトラインを付ける", () => {
    const css = readFileSync("src/renderer/styles/delayed-tooltip.css", "utf8");

    expect(css).toMatch(/\.delayed-tooltip-content\s*\{[^}]*border:\s*1px solid var\(--color-tooltip-border\);/s);
    expect(css).toMatch(/\.delayed-tooltip-content::before\s*\{[^}]*border-top:\s*8px solid var\(--color-tooltip-border\);/s);
  });

  it("右クリックメニュー以外のボタンへ説明表示を追加しない", () => {
    const componentPaths = collectTsxFiles("src/renderer/components");

    for (const componentPath of componentPaths) {
      const fileName = basename(componentPath);
      if (fileName === "DelayedTooltip.test.tsx" || fileName === "DelayedTooltip.tsx") continue;

      const source = readFileSync(componentPath, "utf8");
      if (fileName !== "EditorContextMenu.tsx") {
        expect(source, componentPath).not.toContain("<DelayedTooltip");
      }

      if (fileName.includes("ContextMenu")) continue;

      const sourceFile = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sourceFile) === "button") {
          const hasTitle = node.attributes.properties.some(
            (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === "title"
          );
          expect(hasTitle, componentPath).toBe(false);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
  });
});

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}
