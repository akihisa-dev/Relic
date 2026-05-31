import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/relic-user-data") }
}));

import { ipcErrorDetails } from "./activeWorkspace";

describe("ipcErrorDetails", () => {
  it("redacts sensitive values from Error messages", () => {
    expect(ipcErrorDetails(new Error("failed sk-abcdefghijklmnopqrstuvwxyz"))).toBe("failed sk-[redacted]");
  });

  it("keeps normal error messages unchanged", () => {
    expect(ipcErrorDetails(new Error("Coworkを読み込めませんでした。"))).toBe("Coworkを読み込めませんでした。");
  });
});
