import { describe, expect, it } from "vitest";

import { errorDetails } from "./fileSystem";

describe("errorDetails", () => {
  it("秘密情報らしい値を伏せ字にする", () => {
    expect(errorDetails(new Error("write failed with SERVICE_API_KEY=sk-secret-value"))).toBe(
      "write failed with SERVICE_API_KEY=[redacted]"
    );
  });

  it("通常のエラーメッセージは維持する", () => {
    expect(errorDetails(new Error("Permission denied"))).toBe("Permission denied");
  });
});
