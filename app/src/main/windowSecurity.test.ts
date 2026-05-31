import { describe, expect, it } from "vitest";

import { isAllowedExternalUrl } from "./windowSecurity";

describe("isAllowedExternalUrl", () => {
  it("allows only explicit https external link destinations", () => {
    expect(isAllowedExternalUrl("https://github.com")).toBe(true);
    expect(isAllowedExternalUrl("https://platform.openai.com")).toBe(true);

    expect(isAllowedExternalUrl("http://github.com")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.com")).toBe(false);
    expect(isAllowedExternalUrl("https://evilgithub.com")).toBe(false);
  });
});
