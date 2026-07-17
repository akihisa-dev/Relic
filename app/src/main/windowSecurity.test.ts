import { describe, expect, it } from "vitest";

import {
  isAllowedDevelopmentNavigation,
  isAllowedExternalUrl,
  isAllowedPackagedAppNavigation
} from "./windowSecurity";

describe("isAllowedExternalUrl", () => {
  it("allows only explicit https external link destinations", () => {
    expect(isAllowedExternalUrl("https://github.com")).toBe(true);
    expect(isAllowedExternalUrl("https://docs.github.com/actions")).toBe(true);

    expect(isAllowedExternalUrl("http://github.com")).toBe(false);
    expect(isAllowedExternalUrl("https://platform.openai.com")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.com")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.example")).toBe(false);
    expect(isAllowedExternalUrl("https://evilgithub.com")).toBe(false);
    expect(isAllowedExternalUrl("not a url")).toBe(false);
  });
});

describe("isAllowedPackagedAppNavigation", () => {
  it("allows only the packaged renderer entry file and its hash navigation", () => {
    const indexUrl = "file:///Applications/Relic.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html";

    expect(isAllowedPackagedAppNavigation(indexUrl, indexUrl)).toBe(true);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}#settings`, indexUrl)).toBe(true);

    expect(isAllowedPackagedAppNavigation("file:///etc/passwd", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("javascript:alert(1)", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("data:text/html,<script>alert(1)</script>", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("https://github.com/akihisa-dev/Relic", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}.evil`, indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}?next=file:///etc/passwd`, indexUrl)).toBe(false);
  });
});

describe("isAllowedDevelopmentNavigation", () => {
  const allowedUrls = [
    "http://localhost:5173/",
    "http://127.0.0.1:5173/",
    "http://[::1]:5173/"
  ];

  it.each(allowedUrls)("許可したループバックoriginを許可する: %s", (url) => {
    expect(isAllowedDevelopmentNavigation(`${url}notes?view=preview#top`, allowedUrls)).toBe(true);
  });

  it.each([
    "http://localhost:5173@evil.example/",
    "http://localhost.evil.example:5173/",
    "https://localhost:5173/",
    "http://localhost:4173/",
    "http:\\\\localhost:5173\\evil",
    "http://user@localhost:5173/",
    "http://user%40name@localhost:5173/",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/index.html",
    "not a url"
  ])("許可originに見せかけた遷移を拒否する: %s", (url) => {
    expect(isAllowedDevelopmentNavigation(url, allowedUrls)).toBe(false);
  });
});
