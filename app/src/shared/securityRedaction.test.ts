import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "./securityRedaction";

describe("redactSensitiveText", () => {
  it("redacts OpenAI API keys", () => {
    expect(redactSensitiveText("failed with sk-abcdefghijklmnopqrstuvwxyz")).toBe("failed with sk-[redacted]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSensitiveText("Authorization: Bearer abc123._~+/=-XYZ")).toBe("Authorization: Bearer [redacted]");
  });

  it("redacts OPENAI_API_KEY assignments", () => {
    expect(redactSensitiveText("OPENAI_API_KEY=sk-secret-value")).toBe("OPENAI_API_KEY=[redacted]");
  });

  it("redacts generic API key fields", () => {
    expect(redactSensitiveText("request failed apiKey: secret-value")).toBe("request failed apiKey=[redacted]");
  });

  it("keeps normal Japanese error messages unchanged", () => {
    expect(redactSensitiveText("AI Workspaceを読み込めませんでした。")).toBe("AI Workspaceを読み込めませんでした。");
  });
});
