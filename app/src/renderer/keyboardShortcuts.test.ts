import { describe, expect, it } from "vitest";

import { formatShortcut, isMacPlatform } from "./keyboardShortcuts";

describe("keyboardShortcuts", () => {
  it("Mac系のプラットフォームを判定する", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("iPad")).toBe(true);
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform("Linux x86_64")).toBe(false);
  });

  it("ショートカット表記をMacとWindows向けに出し分ける", () => {
    expect(formatShortcut(["mod", "shift", "P"], "MacIntel")).toBe("⌘⇧P");
    expect(formatShortcut(["mod", "shift", "P"], "Win32")).toBe("Ctrl+Shift+P");
    expect(formatShortcut(["mod", "\\"], "MacIntel")).toBe("⌘\\");
    expect(formatShortcut(["mod", "\\"], "Win32")).toBe("Ctrl+\\");
  });
});
