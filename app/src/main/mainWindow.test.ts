import { describe, expect, it } from "vitest";

import { isAllowedMainWindowNavigation } from "./mainWindow";

describe("isAllowedMainWindowNavigation", () => {
  it("配布版では固定したrenderer entryだけを許可する", () => {
    const entry = "file:///Applications/Relic.app/renderer/index.html";

    expect(isAllowedMainWindowNavigation(entry, entry)).toBe(true);
    expect(isAllowedMainWindowNavigation("file:///tmp/index.html", entry)).toBe(false);
    expect(isAllowedMainWindowNavigation("https://example.com", entry)).toBe(false);
  });

  it("開発版では候補loopback URLだけを許可する", () => {
    const entry = "file:///Applications/Relic.app/renderer/index.html";
    const devServer = "http://localhost:5173";

    expect(isAllowedMainWindowNavigation("http://localhost:5173/", entry, devServer)).toBe(true);
    expect(isAllowedMainWindowNavigation("http://127.0.0.1:5173/", entry, devServer)).toBe(true);
    expect(isAllowedMainWindowNavigation("http://localhost:4173/", entry, devServer)).toBe(false);
  });
});
