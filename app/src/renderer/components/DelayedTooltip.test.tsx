import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelayedTooltip } from "./DelayedTooltip";

describe("DelayedTooltip", () => {
  it("ボタンと説明を共通ラッパー内へ表示する", () => {
    render(
      <DelayedTooltip label="説明">
        <button type="button">操作</button>
      </DelayedTooltip>
    );

    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(screen.getByRole("button", { name: "操作" })).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("説明");
    expect(tooltip.parentElement).toHaveClass("delayed-tooltip");
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
});
