import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "./securityRedaction";

describe("redactSensitiveText", () => {
  it("redacts API keys", () => {
    expect(redactSensitiveText("failed with sk-abcdefghijklmnopqrstuvwxyz")).toBe("failed with sk-[redacted]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSensitiveText("Authorization: Bearer abc123._~+/=-XYZ")).toBe("Authorization: Bearer [redacted]");
  });

  it("redacts API_KEY assignments", () => {
    expect(redactSensitiveText("SERVICE_API_KEY=sk-secret-value")).toBe("SERVICE_API_KEY=[redacted]");
  });

  it("redacts generic API key fields", () => {
    expect(redactSensitiveText("request failed apiKey: secret-value")).toBe("request failed apiKey=[redacted]");
  });

  it("keeps normal Japanese error messages unchanged", () => {
    expect(redactSensitiveText("設定を読み込めませんでした。")).toBe("設定を読み込めませんでした。");
  });
});
