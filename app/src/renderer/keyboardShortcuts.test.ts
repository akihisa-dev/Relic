import { describe, expect, it } from "vitest";

import { formatShortcut } from "./keyboardShortcuts";

describe("keyboardShortcuts", () => {
  it("macOSのショートカット表記を生成する", () => {
    expect(formatShortcut(["mod", "shift", "P"])).toBe("⌘⇧P");
    expect(formatShortcut(["mod", "\\"])).toBe("⌘\\");
  });
});
