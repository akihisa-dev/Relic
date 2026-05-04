import { describe, expect, it } from "vitest";

import { fail, ok } from "./result";

describe("RelicResult", () => {
  it("success result carries a typed value", () => {
    expect(ok({ name: "Relic" })).toEqual({
      ok: true,
      value: { name: "Relic" }
    });
  });

  it("failure result carries a user-facing error", () => {
    expect(fail("TEST_ERROR", "処理できませんでした。")).toEqual({
      ok: false,
      error: {
        code: "TEST_ERROR",
        message: "処理できませんでした。",
        details: undefined
      }
    });
  });
});
