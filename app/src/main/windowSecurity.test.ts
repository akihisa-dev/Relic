import { describe, expect, it } from "vitest";

import { isAllowedExternalUrl, isAllowedPackagedAppNavigation } from "./windowSecurity";

describe("isAllowedExternalUrl", () => {
  it("allows only explicit https external link destinations", () => {
    expect(isAllowedExternalUrl("https://github.com")).toBe(true);

    expect(isAllowedExternalUrl("http://github.com")).toBe(false);
    expect(isAllowedExternalUrl("https://platform.openai.com")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.com")).toBe(false);
    expect(isAllowedExternalUrl("https://evilgithub.com")).toBe(false);
  });
});

describe("isAllowedPackagedAppNavigation", () => {
  it("allows only the packaged renderer entry file and its hash navigation", () => {
    const indexUrl = "file:///Applications/Relic.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html";

    expect(isAllowedPackagedAppNavigation(indexUrl, indexUrl)).toBe(true);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}#settings`, indexUrl)).toBe(true);

    expect(isAllowedPackagedAppNavigation("file:///etc/passwd", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}.evil`, indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}?next=file:///etc/passwd`, indexUrl)).toBe(false);
  });
});
