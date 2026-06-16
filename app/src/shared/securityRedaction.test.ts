import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "./securityRedaction";

describe("redactSensitiveText", () => {
  it("redacts API keys", () => {
    expect(redactSensitiveText(`failed with ${["sk", "abcdefghijklmnopqrstuvwxyz"].join("-")}`)).toBe("failed with sk-[redacted]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSensitiveText("Authorization: Bearer abc123._~+/=-XYZ")).toBe("Authorization: Bearer [redacted]");
  });

  it("redacts API_KEY assignments", () => {
    expect(redactSensitiveText(`SERVICE_API_KEY=${["sk", "secret", "value"].join("-")}`)).toBe("SERVICE_API_KEY=[redacted]");
  });

  it("redacts generic API key fields", () => {
    expect(redactSensitiveText("request failed apiKey: secret-value")).toBe("request failed apiKey=[redacted]");
  });

  it("redacts common service token formats", () => {
    expect(redactSensitiveText(`github token ${["ghp", "abcdefghijklmnopqrstuvwxyz123456"].join("_")}`)).toBe(
      "github token [token redacted]"
    );
    expect(redactSensitiveText(`pat ${["github", "pat", "abcdefghijklmnopqrstuvwxyz123456"].join("_")}`)).toBe(
      "pat [token redacted]"
    );
    expect(redactSensitiveText(`slack ${["xoxb", "1234567890", "abcdefghijklmnop"].join("-")}`)).toBe(
      "slack [token redacted]"
    );
  });

  it("redacts absolute filesystem paths", () => {
    expect(redactSensitiveText("ENOENT: open '/Users/akihisa/Dev/Relic/secret.md'")).toBe(
      "ENOENT: open '[path redacted]'"
    );
    expect(redactSensitiveText("failed /home/alice/project/secret.md")).toBe(
      "failed [path redacted]"
    );
    expect(redactSensitiveText("EPERM C:\\Users\\alice\\project\\secret.md")).toBe(
      "EPERM [path redacted]"
    );
  });

  it("keeps normal Japanese error messages unchanged", () => {
    expect(redactSensitiveText("設定を読み込めませんでした。")).toBe("設定を読み込めませんでした。");
  });
});
