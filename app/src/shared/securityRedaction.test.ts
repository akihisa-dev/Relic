import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "./securityRedaction";

describe("redactSensitiveText", () => {
  it("redacts API keys", () => {
    expect(redactSensitiveText(`failed with ${["sk", "abcdefghijklmnopqrstuvwxyz"].join("-")}`)).toBe("failed with sk-[redacted]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSensitiveText("Authorization: Bearer abc123._~+/=-XYZ")).toBe("Authorization: Bearer [redacted]");
    expect(redactSensitiveText("Authorization: Basic dXNlcjpwYXNz")).toBe("Authorization: Basic [redacted]");
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
    expect(redactSensitiveText("npm npm_abcdefghijklmnopqrstuvwxyz123456")).toBe("npm [token redacted]");
    expect(redactSensitiveText("NPM_TOKEN=npm_abcdefghijklmnopqrstuvwxyz123456")).toBe("NPM_TOKEN=[redacted]");
    expect(redactSensitiveText("//registry.npmjs.org/:_authToken=npm_abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "//registry.npmjs.org/:_authToken=[redacted]"
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
    expect(redactSensitiveText("ENOENT: open '/Users/alice/My Project/secret note.md'")).toBe(
      "ENOENT: open '[path redacted]'"
    );
    expect(redactSensitiveText("EPERM C:/Users/alice/My Project/secret.md")).toBe(
      "EPERM [path redacted]"
    );
    expect(redactSensitiveText("EACCES \\\\server\\share\\Project Folder\\secret.md")).toBe(
      "EACCES [path redacted]"
    );
    expect(redactSensitiveText("failed /mnt/c/Users/alice/project/secret.md")).toBe(
      "failed [path redacted]"
    );
    expect(redactSensitiveText("failed /media/alice/drive/notes.md")).toBe(
      "failed [path redacted]"
    );
    expect(redactSensitiveText("failed /srv/relic/secret.md")).toBe(
      "failed [path redacted]"
    );
    expect(redactSensitiveText("failed /workspace/project/file.md")).toBe(
      "failed [path redacted]"
    );
    expect(redactSensitiveText("fetch https://example.com/docs/file.md")).toBe(
      "fetch https://example.com/docs/file.md"
    );
  });

  it("redacts connection strings and private key headers", () => {
    expect(redactSensitiveText("connect postgres://user:password@localhost/relic")).toBe(
      "connect [connection redacted]"
    );
    expect(redactSensitiveText("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe("[private key redacted]");
  });

  it("keeps normal Japanese error messages unchanged", () => {
    expect(redactSensitiveText("設定を読み込めませんでした。")).toBe("設定を読み込めませんでした。");
  });
});
