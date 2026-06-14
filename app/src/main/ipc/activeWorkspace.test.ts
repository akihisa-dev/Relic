import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/relic-user-data") }
}));

import { ipcErrorDetails } from "./activeWorkspace";

describe("ipcErrorDetails", () => {
  it("redacts sensitive values from Error messages", () => {
    expect(ipcErrorDetails(new Error(`failed ${["sk", "abcdefghijklmnopqrstuvwxyz"].join("-")}`))).toBe("failed sk-[redacted]");
  });

  it("keeps normal error messages unchanged", () => {
    expect(ipcErrorDetails(new Error("設定を読み込めませんでした。"))).toBe("設定を読み込めませんでした。");
  });
});
